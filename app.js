function initILIONLabUI() {
  'use strict';
  const {SCENARIOS, STAGES, evaluate} = window.ILIONLabEngine;
  const form = document.querySelector('#request-form');
  const scenarioList = document.querySelector('#scenario-list');
  const stack = document.querySelector('#pipeline-stack');
  const ledgerList = document.querySelector('#ledger-list');
  const $ = (id) => document.getElementById(id);
  const state = {
    selectedId: 'authorized', latest: null,
    effects: [], attempts: [], completedExports: 0,
    blockedAttempts: 0, temporalEnabled: true, exportBudget: 2
  };
  let runNumber = 0;

  function showScenarioList() {
    scenarioList.replaceChildren();
    SCENARIOS.forEach((s) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scenario-button' + (s.id === state.selectedId ? ' is-active' : '');
      button.setAttribute('aria-pressed', String(s.id === state.selectedId));
      const top = document.createElement('span'); top.className='scenario-top';
      const name = document.createElement('span'); name.className='scenario-title'; name.textContent=s.title;
      const tag=document.createElement('span'); tag.className='scenario-tag'; tag.textContent=s.tag;
      top.append(name,tag);
      const sub=document.createElement('small'); sub.className='scenario-subtitle'; sub.textContent=s.stage;
      button.append(top,sub);
      button.addEventListener('click',()=>selectScenario(s.id));
      scenarioList.append(button);
    });
  }

  function putFields(request) {
    for (const [key, value] of Object.entries(request)) {
      if (!form.elements[key]) continue;
      form.elements[key].value=String(value);
    }
  }
  function readFields() {
    const fd = new FormData(form);
    const r = {};
    for (const [k, value] of fd.entries()) {
      if (k === 'ageMinutes') r[k] = Number(value);
      else if (k === 'identityClaim' || k === 'delegationClaim') r[k] = value === 'true';
      else r[k] = value;
    }
    return r;
  }
  function sessionSnapshot() {
    return {temporalEnabled:state.temporalEnabled,exportBudget:state.exportBudget,completedExports:state.completedExports};
  }
  function resetSession() {
    state.effects = [];state.attempts=[];state.completedExports=0;state.blockedAttempts=0;runNumber=0;
    renderLedger();
  }
  function selectScenario(id) {
    const selected = SCENARIOS.find(s=>s.id===id);
    if (!selected) return;
    state.selectedId=id;
    resetSession();
    putFields(selected.request);
    $('current-scenario-title').textContent=selected.title;
    $('current-scenario-tag').textContent=selected.tag === 'ALLOW' ? 'BASELINE SCENARIO' : `TEST ${selected.tag}`;
    $('scenario-description').textContent=selected.description;
    $('scenario-hint').textContent=selected.hint;
    $('evidence-box').open=(id==='context' || id==='claims');
    state.latest=null;
    renderDecision();
    showScenarioList();
  }
  function renderDecision() {
    const b=$('decision-banner');
    b.className='decision-banner '+(!state.latest?'idle':state.latest.verdict==='ALLOW'?'allowed':'blocked');
    if(!state.latest){
      $('trace-indicator').textContent='AWAITING RUN';
      $('decision-verdict').textContent='READY';
      $('decision-reason').textContent='Run the controls to generate a verdict.';
      $('decision-symbol').textContent='◇';
      $('reason-detail').textContent='Each evaluated layer returns a reason. Mandatory failure stops the remaining checks.';
    } else {
      const v=state.latest;
      $('trace-indicator').textContent=`RUN ${String(runNumber).padStart(2,'0')} / ${v.rejectedBy?'VETO':'CLEAR'}`;
      $('decision-verdict').textContent=v.verdict;
      $('decision-reason').textContent=v.verdict==='ALLOW'?'The synthetic operation has been recorded in the effects ledger.':'Mandatory veto. No synthetic execution effect has been recorded.';
      $('decision-symbol').textContent=v.verdict==='ALLOW'?'✓':'✕';
      const decisive=v.stages.find(x=>x.status==='BLOCK') || v.stages[v.stages.length-1];
      $('reason-detail').textContent=decisive.reason+' '+(decisive.detail||'');
    }
    stack.replaceChildren();
    STAGES.forEach((stage,i)=>{
      const entry=state.latest?.stages[i];
      const row=document.createElement('div');row.className='stage';
      const idx=document.createElement('span');idx.className='stage-index';idx.textContent=String(i+1).padStart(2,'0');
      const desc=document.createElement('div');const title=document.createElement('h4');title.textContent=stage.label;
      const sub=document.createElement('p');sub.textContent=entry ? entry.reason : stage.summary;
      desc.append(title,sub);
      const status=document.createElement('span'); status.className='stage-state';status.textContent='READY';
      if(entry){status.textContent=entry.status;status.classList.add(entry.status.toLowerCase());}
      row.append(idx,desc,status);stack.append(row);
    });
  }

  function renderLedger(){
    $('metric-effects').textContent=String(state.effects.length);
    $('metric-blocks').textContent=String(state.blockedAttempts);
    $('metric-exports').textContent=`${state.completedExports} / ${state.exportBudget}`;
    ledgerList.replaceChildren();
    if(state.effects.length===0){const empty=document.createElement('p');empty.className='empty-ledger';empty.textContent='No synthetic execution effects yet. A BLOCK will not create an entry here.';ledgerList.append(empty);return;}
    state.effects.slice().reverse().forEach(event=>{
      const row=document.createElement('div');row.className='ledger-entry';
      const info=document.createElement('div');const strong=document.createElement('strong');strong.textContent=`#${event.attempt} · ${event.action.toUpperCase()} / ${event.target}`;
      const sub=document.createElement('small');sub.textContent=`${event.role} → ${event.destination} · in-browser synthetic effect`;
      info.append(strong,sub);
      const chip=document.createElement('em');chip.textContent='EXECUTED';row.append(info,chip);ledgerList.append(row);
    });
  }

  function run(){
    const request=readFields(); const before=state.effects.length;
    const result=evaluate(request,sessionSnapshot());
    runNumber+=1;
    state.latest=result;
    const attempt={attempt:runNumber,scenario:state.selectedId,verdict:result.verdict,rejectedBy:result.rejectedBy,request:{...request},stages:result.stages};
    state.attempts.push(attempt);
    if(result.verdict==='ALLOW'){
      state.effects.push({attempt:runNumber,action:request.action,target:request.target,role:request.role,destination:request.destination,synthetic:true});
      if(request.action==='export')state.completedExports++;
    } else state.blockedAttempts++;
    if(result.verdict==='BLOCK'&&state.effects.length!==before)throw new Error('Containment invariant violated: a blocked attempt created an effect.');
    renderDecision();renderLedger();
  }
  // A previous authorization verdict applies only to the exact request that was evaluated.
  // Any subsequent field edit invalidates the displayed verdict without changing the session ledger.
  function invalidateVerdictForEdit() {
    state.latest = null;
    $('current-scenario-tag').textContent = 'MODIFIED REQUEST';
    renderDecision();
  }
  form.addEventListener('input', invalidateVerdictForEdit);
  form.addEventListener('change', invalidateVerdictForEdit);
  form.addEventListener('submit',e=>{e.preventDefault();run();});
  $('reset-request').addEventListener('click',()=>selectScenario(state.selectedId));
  $('reset-session').addEventListener('click',()=>{resetSession();state.latest=null;renderDecision();});
  $('sync-evidence').addEventListener('click',()=>{
    const r=readFields();
    putFields({...r,issuer:'trusted_registry',ageMinutes:5,boundAction:r.action,boundTarget:r.target,identityClaim:true,identityTarget:r.target,delegationClaim:true,delegationAction:r.action,delegationTarget:r.target});
    $('evidence-box').open=true;
    invalidateVerdictForEdit();
  });
  $('temporal-enabled').addEventListener('change',e=>{state.temporalEnabled=Boolean(e.target.checked);state.latest=null;renderDecision();});
  $('download-log').addEventListener('click',()=>{
    const data={lab:'ILION v5 public demonstration',disclaimer:'Synthetic, non-production data; this is not the non-public ILION v5 engine.',configuration:{exportBudget:state.exportBudget,temporalEnabled:state.temporalEnabled},attempts:state.attempts,effects:state.effects};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='ilion-public-lab-session.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  selectScenario('authorized');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initILIONLabUI, {once: true});
} else {
  initILIONLabUI();
}
