'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {SCENARIOS, BASE, STAGES, evaluate} = require('../engine.js');
const session = (exports = 0, enabled = true) => ({completedExports: exports, exportBudget: 2, temporalEnabled: enabled});
const patch = (fields) => ({...BASE, ...fields});
const verdict = (request, state = session()) => evaluate(request, state);

test('all six canonical scenarios have the expected initial outcome', () => {
  const expected = {
    authorized: [ 'ALLOW', null ], context: ['BLOCK', 'cap'],
    claims: ['BLOCK', 'cgc'], exfil: ['BLOCK', 'pcl'],
    wrongrole: ['BLOCK', 'gate'], session: ['ALLOW', null]
  };
  assert.equal(SCENARIOS.length, 6);
  for (const entry of SCENARIOS) {
    const result = verdict(entry.request);
    assert.deepEqual([result.verdict, result.rejectedBy], expected[entry.id], entry.id);
    assert.deepEqual(result.stages.map(s => s.id), STAGES.map(s => s.id));
  }
});

test('fail-fast marks all stages after a rejection as skipped', () => {
  for (const [request, expectedStage] of [
    [patch({issuer:'unknown_source'}),'cap'],
    [patch({delegationClaim:false}),'cgc'],
    [patch({action:'delete', boundAction:'delete', delegationAction:'delete'}),'pcl'],
    [patch({role:'no_such_role'}),'gate']
  ]) {
    const result = verdict(request);
    assert.equal(result.rejectedBy, expectedStage);
    const i = STAGES.findIndex(s => s.id === expectedStage);
    assert.ok(result.stages.slice(0, i).every(s=>s.status === 'PASS'));
    assert.equal(result.stages[i].status, 'BLOCK');
    assert.ok(result.stages.slice(i+1).every(s=>s.status === 'SKIPPED'));
  }
});

test('CAP rejects stale or unbound evidence', () => {
  for (const fields of [
    {issuer:'unknown_source'}, {ageMinutes:31}, {ageMinutes:-1},
    {ageMinutes:Infinity}, {boundTarget:'mortgage_file'}, {boundAction:'read'}
  ]) assert.equal(verdict(patch(fields)).rejectedBy,'cap',JSON.stringify(fields));
});

test('CGC rejects absent or non-composing claim evidence', () => {
  for (const fields of [
    {identityClaim:false}, {delegationClaim:false},
    {identityTarget:'audit_log'}, {delegationTarget:'audit_log'},
    {delegationAction:'read'}
  ]) assert.equal(verdict(patch(fields)).rejectedBy,'cgc',JSON.stringify(fields));
});

test('PCL blocks forbidden operations and destinations even with aligned evidence', () => {
  const baseExport=patch({action:'export', boundAction:'export', delegationAction:'export'});
  for (const action of ['review','read','export']) {
    const x=patch({action,boundAction:action,delegationAction:action,destination:'external'});
    assert.equal(verdict(x).rejectedBy, 'pcl',`external ${action}`);
  }
  assert.equal(verdict(patch({action:'delete', boundAction:'delete', delegationAction:'delete'})).rejectedBy,'pcl');
  assert.equal(verdict({...baseExport,target:'audit_log',boundTarget:'audit_log',identityTarget:'audit_log',delegationTarget:'audit_log'}).rejectedBy,'pcl');
  assert.equal(verdict({...baseExport,destination:'approved_partner'}).rejectedBy,'pcl');
});

test('Gate rejects a role/target mismatch even when upstream claims compose', () => {
  assert.equal(verdict(patch({target:'mortgage_file',boundTarget:'mortgage_file',identityTarget:'mortgage_file',delegationTarget:'mortgage_file'})).rejectedBy,'gate');
});

test('two allowed synthetic exports followed by session veto; toggle is illustrative', () => {
  const r=SCENARIOS.find(s=>s.id==='session').request;
  assert.deepEqual([0,1,2].map(n=>verdict(r,session(n)).verdict),['ALLOW','ALLOW','BLOCK']);
  assert.equal(verdict(r,session(2)).rejectedBy,'srm');
  assert.equal(verdict(r,session(2,false)).verdict,'ALLOW');
});

test('exhaustive representative input combinations never allow forbidden destinations or roles', () => {
  let count=0;
  for (const role of ['kyc_analyst','mortgage_assistant','operations_agent','unknown'])
  for (const action of ['read','review','export','delete'])
  for (const target of ['kyc_case','mortgage_file','audit_log'])
  for (const destination of ['internal','approved_partner','external','bogus'])
  for (const issuer of ['trusted_registry','unknown_source']) {
    const r=patch({role,action,target,destination,issuer,
      boundAction:action,boundTarget:target,identityTarget:target,delegationAction:action,delegationTarget:target});
    const result=verdict(r);
    count++;
    if (result.verdict==='ALLOW') {
      assert.equal(issuer,'trusted_registry');
      assert.notEqual(action,'delete');
      assert.notEqual(destination,'external');
      assert.notEqual(destination,'bogus');
      assert.notEqual(role,'unknown');
      if(action!=='export')assert.equal(destination,'internal');
      if(target==='audit_log')assert.notEqual(action,'export');
      if(target==='kyc_case'&&action==='export')assert.equal(destination,'internal');
    }
  }
  assert.equal(count, 384);
});
