/*
 * ILION v5 Public Lab — illustrative, independent demonstration rules.
 * Not ILION's non-public engines, not a security boundary, and not production software.
 * No private algorithms are implemented or disclosed here.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ILIONLabEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STAGES = Object.freeze([
    {id: 'cap', label: 'CAP', expanded: 'Context Attestation Pipeline', summary: 'Is the asserted context trusted, fresh, and bound to this request?'},
    {id: 'cgc', label: 'CGC', expanded: 'Claim Graph Coherence', summary: 'Do separately supplied claims jointly authorize this exact action and target?'},
    {id: 'pcl', label: 'PCL', expanded: 'Policy Constraint Layer', summary: 'Does an explicit policy permit the operation and destination?'},
    {id: 'gate', label: 'GATE', expanded: 'ILION Gate — public rule illustration', summary: 'Is the operation consistent with the agent’s assigned role?'},
    {id: 'srm', label: 'SRM*', expanded: 'Experimental session-budget illustration', summary: 'Would this operation exceed a synthetic session budget?'}
  ]);

  const ROLE_SCOPE = Object.freeze({
    kyc_analyst: {targets: ['kyc_case', 'audit_log'], actions: ['read', 'review', 'export']},
    mortgage_assistant: {targets: ['mortgage_file', 'audit_log'], actions: ['read', 'review', 'export']},
    operations_agent: {targets: ['kyc_case', 'mortgage_file', 'audit_log'], actions: ['read', 'review']}
  });

  function outcome(pass, reason, detail) {
    return {status: pass ? 'PASS' : 'BLOCK', reason, detail: detail || ''};
  }
  function cap(r) {
    if (r.issuer !== 'trusted_registry') return outcome(false, 'Context issuer is not on the demo trust list.', 'This is a literal allowlist check, not cryptographic attestation.');
    const age = Number(r.ageMinutes);
    if (!Number.isFinite(age) || age < 0 || age > 30) return outcome(false, 'Attestation is missing, invalid, or older than 30 minutes.', 'The 30-minute threshold is a public illustrative setting.');
    if (r.boundAction !== r.action || r.boundTarget !== r.target) return outcome(false, 'Attested context does not match the requested action and target.', 'The binding fields must match the proposed operation exactly.');
    return outcome(true, 'Trusted demo issuer, fresh context, exact request binding.', 'Allowlist + age + equality checks; no signatures are verified.');
  }
  function cgc(r) {
    if (!r.identityClaim || !r.delegationClaim) return outcome(false, 'Required identity or delegation claim is absent.', 'Both claim types are required for this simplified demonstration.');
    if (r.identityTarget !== r.target) return outcome(false, 'Identity scope and requested target do not compose.', 'A valid identity claim alone does not authorize an unrelated resource.');
    if (r.delegationAction !== r.action || r.delegationTarget !== r.target) return outcome(false, 'Delegation does not cover this exact action and target.', 'A valid delegation for a different operation does not authorize this one.');
    return outcome(true, 'Identity scope and delegation jointly cover action and target.', 'Transparent claim matching, not the proprietary CGC mechanism.');
  }
  function pcl(r) {
    if (r.action === 'delete') return outcome(false, 'Destructive operations are disallowed by the demo policy.', 'A fixed policy constraint denies DELETE, regardless of claimed approval.');
    // Fail-closed destination policy applies to the entire proposed operation,
    // not only to EXPORT. A review/read cannot be permitted with a prohibited
    // destination and then appear as an executed effect against that target.
    if (!['internal', 'approved_partner', 'external'].includes(r.destination)) return outcome(false, 'Unknown or missing destination is not authorized.', 'Only explicitly recognized destinations may be evaluated.');
    if (r.destination === 'external') return outcome(false, 'Unapproved external destination is forbidden for every operation.', 'Destination policy is enforced independently of action type or claimed approval.');
    if (r.action !== 'export' && r.destination !== 'internal') return outcome(false, 'READ and REVIEW operations must remain in the internal workspace.', 'Only an explicitly permitted EXPORT can target an approved partner.');
    if (r.action === 'export' && r.target === 'audit_log') return outcome(false, 'Audit-log exports are excluded from this policy profile.', 'Resource-specific constraint.');
    if (r.action === 'export' && r.target === 'kyc_case' && r.destination !== 'internal') return outcome(false, 'KYC case exports are restricted to the internal destination.', 'The demo permits KYC exports only internally.');
    return outcome(true, 'Operation satisfies the published demo-policy rules.', 'This is a small public policy set, not the non-public PCL engine.');
  }
  function gate(r) {
    const role = ROLE_SCOPE[r.role];
    if (!role) return outcome(false, 'The agent role is not recognized.', 'Fail closed on an unknown role.');
    if (!role.targets.includes(r.target)) return outcome(false, 'This role is not assigned the requested target.', 'Role-to-target authorization mismatch.');
    if (!role.actions.includes(r.action)) return outcome(false, 'This role is not permitted to perform the requested action.', 'Role-to-action authorization mismatch.');
    return outcome(true, 'Target and action are compatible with the assigned role.', 'Public role/action allowlist; not the full ILION Gate.');
  }
  function srm(r, session) {
    if (!session.temporalEnabled) return outcome(true, 'Session-budget demonstration disabled.', 'No temporal authorization decision is applied.');
    if (r.action !== 'export') return outcome(true, 'Non-export action; session export budget unchanged.', 'The example tracks only synthetic export operations.');
    if (session.completedExports >= session.exportBudget) return outcome(false, 'Synthetic export budget exhausted for this session.', `Previously executed exports: ${session.completedExports}; demo budget: ${session.exportBudget}.`);
    return outcome(true, 'Synthetic export budget available.', `${session.completedExports} of ${session.exportBudget} exports used. This is NOT the research SRM implementation.`);
  }

  const HANDLERS = Object.freeze({cap, cgc, pcl, gate, srm});

  function evaluate(request, session) {
    const results = [];
    let rejectedBy = null;
    for (const stage of STAGES) {
      if (rejectedBy) {
        results.push({id: stage.id, ...outcome(true, 'Not evaluated: earlier mandatory veto.'), status: 'SKIPPED'});
        continue;
      }
      const result = HANDLERS[stage.id](request, session);
      results.push({id: stage.id, ...result});
      if (result.status === 'BLOCK') rejectedBy = stage.id;
    }
    return {verdict: rejectedBy ? 'BLOCK' : 'ALLOW', rejectedBy, stages: results};
  }

  const BASE = Object.freeze({
    role: 'kyc_analyst', action: 'review', target: 'kyc_case', destination: 'internal',
    issuer: 'trusted_registry', ageMinutes: 5, boundAction: 'review', boundTarget: 'kyc_case',
    identityClaim: true, identityTarget: 'kyc_case',
    delegationClaim: true, delegationAction: 'review', delegationTarget: 'kyc_case'
  });
  const merged = patch => Object.assign({}, BASE, patch);
  const SCENARIOS = Object.freeze([
    {id:'authorized', title:'Authorized case review', tag:'ALLOW', stage:'All checks pass', description:'A KYC agent reviews a permitted case with matching context and delegated authority.', hint:'Execute once; then change the target to see why exact scope matters.', request:merged({})},
    {id:'context', title:'Untrusted evidence', tag:'CAP', stage:'Context rejected', description:'The claimed context comes from an unrecognized source. The chain stops before policy checks.', hint:'Change the issuer back to Trusted to see the next checks run.', request:merged({issuer:'unknown_source'})},
    {id:'claims', title:'Conflicting delegation', tag:'CGC', stage:'Claims do not compose', description:'Both claim types are present, but the delegation covers a different action.', hint:'Change Delegated action to Review to make the claims coherent.', request:merged({delegationAction:'read'})},
    {id:'exfil', title:'Unapproved data export', tag:'PCL', stage:'Policy veto', description:'An otherwise authorized export tries to send data to an unapproved external destination.', hint:'Switch destination to Internal to see an allowed operation.', request:merged({action:'export',boundAction:'export',delegationAction:'export',destination:'external'})},
    {id:'wrongrole', title:'Right claims, wrong role', tag:'GATE', stage:'Role/action veto', description:'The evidence matches a mortgage file, but the agent role is limited to KYC workflows.', hint:'Change the role to Mortgage Assistant; the same action can then pass.', request:merged({target:'mortgage_file',boundTarget:'mortgage_file',identityTarget:'mortgage_file',delegationTarget:'mortgage_file'})},
    {id:'session', title:'Repeated permitted exports', tag:'SRM*', stage:'Experimental session budget', description:'Each export passes the single-action checks. A third attempt exceeds the transparent demo limit.', hint:'Press Execute three times: two synthetic exports, then one BLOCK with no third effect.', request:merged({action:'export',boundAction:'export',delegationAction:'export',destination:'internal'})}
  ]);

  return {STAGES, ROLE_SCOPE, SCENARIOS, BASE, evaluate};
});
