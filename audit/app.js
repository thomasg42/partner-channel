'use strict';
(() => {
  const form = document.querySelector('#audit-form');
  const fields = [...form.querySelectorAll('[name]')];
  const key = 'fgai-partner-audit-v1';
  const unknown = 'UNCONFIRMED';
  const approves = '[THOMAS APPROVES]';
  const promisedDefault = 'Free bottleneck audit. No price.';
  const optional = ['partner', 'extras', 'minutes_per_case', 'cases_per_month', 'error_rate', 'lead_response', 'missed_calls'];
  const filters = [
    ['f_frequent', 'Pain is frequent and measurable'],
    ['f_safe', 'A safe automation can improve it'],
    ['f_data', 'Required data and permissions exist'],
    ['f_fund', 'The outcome matters enough to fund'],
    ['f_poc', 'A small proof-of-concept can validate it']
  ];
  let step = 0;
  let changed = false;
  const el = id => document.getElementById(id);
  const localNow = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const value = name => form.elements.namedItem(name).value.trim();
  const data = () => Object.fromEntries(fields.map(f => [f.name, f.value.trim()]));
  const baseline = () => value('baseline') || unknown;
  const partner = () => value('partner') || unknown;
  const say = text => { el('action-status').textContent = text; };
  const storageError = message => {
    el('storage-error').hidden = false;
    el('storage-error').textContent = message;
  };
  function showStep(n, focus = false) {
    step = n;
    document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = Number(p.dataset.panel) !== n; });
    document.querySelectorAll('[data-step]').forEach(b => {
      if (Number(b.dataset.step) === n) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    el('page-count').textContent = `${n + 1} / 4`;
    el('previous').disabled = n === 0;
    el('continue').disabled = n === 3;
    if (focus) document.querySelector(`[data-panel="${n}"] h2`).focus();
  }
  function render() {
    const d = data();
    el('recap-client').textContent = d.client || 'This audit';
    el('recap-partner').textContent = [partner(), d.partner_type].filter(v => v && v !== unknown).join(' / ') || unknown;
    document.querySelectorAll('[data-recap]').forEach(node => {
      node.textContent = d[node.dataset.recap] || 'Not recorded';
    });
    el('recap-numbers').textContent = `${baseline()} → ${d.target || 'Not recorded'}`;
    const pending = baseline().toUpperCase() === unknown;
    el('baseline-state').textContent = pending ? 'Before number: UNCONFIRMED · audit incomplete' : 'Before number entered · verify source';
    el('terms-state').textContent = `Partner fee: ${d.terms || approves}`;
    renderPrint();
  }
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(data()));
      el('save-status').textContent = 'Saved on this browser · nothing sent';
    } catch {
      el('save-status').textContent = 'Draft NOT saved';
      storageError('Browser storage is unavailable or full. Keep this page open and export or copy the markdown before closing.');
    }
  }
  function reset() {
    form.reset();
    fields.forEach(f => { f.value = ''; f.setCustomValidity(''); });
    form.elements.date.value = localNow();
    form.elements.baseline.value = unknown;
    form.elements.terms.value = approves;
    form.elements.promised.value = promisedDefault;
    changed = false;
    render();
    showStep(0);
  }
  function restore() {
    reset();
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return;
      const d = JSON.parse(stored);
      if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Invalid draft');
      fields.forEach(f => {
        if (typeof d[f.name] === 'string') f.value = d[f.name];
      });
      form.elements.baseline.value ||= unknown;
      form.elements.terms.value ||= approves;
      form.elements.promised.value ||= promisedDefault;
      changed = fields.some(f => !['date', 'baseline', 'terms', 'promised'].includes(f.name) && f.value);
      el('save-status').textContent = 'Draft restored on this browser · nothing sent';
      render();
    } catch {
      storageError('The saved draft could not be read. It has not been replaced. Check your last exported audit before editing.');
    }
  }
  const numeric = s => /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s) && Number.isFinite(Number(s));
  // The partner fee is Thomas's to write. A percentage must never reach a file, a print, or a partner.
  const share = s => /%|\bper\s*cent\b|\bpercent(?:age)?\b|\brev(?:enue)?\s*share\b|\bcommission\b|\bcut\s+of\b/i.test(s);
  function validate() {
    for (const f of fields) {
      f.setCustomValidity('');
      f.value = f.value.trim();
    }
    form.elements.baseline.value ||= unknown;
    form.elements.terms.value ||= approves;
    if (value('baseline').toUpperCase() === unknown) form.elements.baseline.value = unknown;
    if (baseline() !== unknown && !numeric(baseline())) form.elements.baseline.setCustomValidity('Enter a non-negative number or UNCONFIRMED. Include units in KPI name.');
    if (value('target') && (!Number.isFinite(Number(value('target'))) || Number(value('target')) < 0 || Math.abs(Number(value('target'))) > 1e12)) form.elements.target.setCustomValidity('Enter a finite non-negative target up to one trillion. Use KPI name for units.');
    if (share(value('terms'))) form.elements.terms.setCustomValidity('No percentage or revenue share. Thomas writes the partner fee before anyone is promised money. Use [THOMAS APPROVES] or UNCONFIRMED.');
    if (share(value('promised')) || /\$\s*\d/.test(value('promised'))) form.elements.promised.setCustomValidity('The audit is free and no price was promised to get this meeting. Remove the amount or the share.');
    for (const f of fields) if (f.maxLength > 0 && f.value.length > f.maxLength) f.setCustomValidity(`Limit this field to ${f.maxLength} characters.`);
    for (const f of fields) if (!optional.includes(f.name) && !f.value) f.setCustomValidity('Required for export. Use “None” if there is nothing to record.');
    const noFilter = filters.some(([name]) => value(name) === 'No');
    if (noFilter && value('verdict') === 'Build') form.elements.verdict.setCustomValidity('A No on the opportunity filter means do not force a build. Choose Defer or No-fit, or resolve the No first.');
    if (value('next') === 'Proposal on named V1' && (!value('v1') || ['Not AI — hire or operations', 'Hold — need the paid Diagnosis Hour'].includes(value('v1')))) form.elements.next.setCustomValidity('A proposal needs a named build. Choose Partner recap only, Diagnosis Hour, or Not ready.');
    if (value('verdict') === 'No-fit' && value('next') === 'Proposal on named V1') form.elements.next.setCustomValidity('No-fit means no proposal. Close the audit cleanly and send the partner recap.');
    if (value('pipe') === 'Not AI / hire-first' && value('v1') !== 'Not AI — hire or operations') form.elements.v1.setCustomValidity('Hire-first means Not AI — hire or operations. Revisit the pipe if the evidence changed.');
    const invalid = fields.find(f => !f.validity.valid);
    render(); save();
    if (invalid) {
      showStep(Number(invalid.closest('[data-panel]').dataset.panel));
      invalid.focus(); invalid.reportValidity();
      say('Complete the highlighted field. No file exported or copied.');
      return false;
    }
    return true;
  }
  // Quote metadata as YAML scalars. Escape user text so notes remain data, not Markdown/HTML structure.
  const md = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}\[\]()#+.!|~-])/g, '\\$1').replace(/\r?\n/g, '\n  ');
  const slug = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const roi = () => [
    ['Minutes per case', value('minutes_per_case')],
    ['Cases per month', value('cases_per_month')],
    ['Error / rework rate', value('error_rate')],
    ['Lead response time', value('lead_response')],
    ['Missed calls / leads', value('missed_calls')]
  ];
  function markdown() {
    const d = data();
    const b = baseline();
    const flags = d.flags.split(/\r?\n/).filter(Boolean).map(s => `- ${md(s)}`);
    if (b === unknown) flags.push('- Baseline UNCONFIRMED. Count this week. The audit is incomplete until the before number is recorded.');
    if (partner() === unknown) flags.push('- Partner not named in this record. Name the introducer before the recap goes out.');
    flags.push(`- Partner fee: ${md(d.terms)}. No percentage exists until Thomas writes the term.`);
    return `---
partner: ${JSON.stringify(partner())}
partner_type: ${JSON.stringify(d.partner_type)}
client: ${JSON.stringify(d.client)}
owner: ${JSON.stringify(d.owner)}
trade: ${JSON.stringify(d.trade)}
date: ${JSON.stringify(d.date)}
pipe: ${JSON.stringify(d.pipe)}
verdict: ${JSON.stringify(d.verdict)}
status: in-progress
audit_cost: "Free"
commercial_terms: ${JSON.stringify(d.terms)}
outreach_authorized: No
---

## Key decisions
- Introduced by: ${md(partner())} (${md(d.partner_type)})
- What the client was promised: ${md(d.promised)}
- Pipe: ${md(d.pipe)}
- First process that breaks: ${md(d.clog)}
- Why this comes first: ${md(d.why_first)}
- KPI: ${md(d.kpi)}
- Baseline: ${md(b)}
- Target: ${md(d.target)}
- Verdict: ${md(d.verdict)}
- Recommended V1: ${md(d.v1)}
- Next step: ${md(d.next)}
- Thomas notes: ${md(d.notes)}

## Q&A log
### Q: Why did the partner introduce us?
**A:** ${md(d.why_intro)}
**Key highlight:** ${md(d.clog)}

### Q: Why did you take the intro?
**A:** ${md(d.why_took)}
**Key highlight:** ${md(d.clog)}

### Q: If tomorrow you got 300 jobs that wanted your services, what process would break first?
**A:** ${md(d.three_hundred)}
**Key highlight:** ${md(d.clog)}

### Q: Demand or supply?
**A:** ${md(d.pipe)}
**Key highlight:** ${md(d.why_first)}

### Q: Current state
**A:** ${md(d.extras || 'None recorded')}
**Key highlight:** ${md(d.clog)}

### Q: What number proves this worked?
**A:** ${md(d.kpi)}: ${md(b)} → ${md(d.target)}
**Key highlight:** Owner target for review, not a measured result.

## Audit output
- First process to fix: ${md(d.clog)}
- Why this comes first: ${md(d.why_first)}
- Baseline metric: ${md(d.kpi)} = ${md(b)}
- Proposed 30-day outcome: ${md(d.outcome_30)}
- Smallest valid proof-of-concept: ${md(d.poc)}
- Dependencies / risks: see Open flags
- Verdict: ${md(d.verdict)}

## Opportunity filter
${filters.map(([name, label]) => `- ${label}: ${md(d[name])}`).join('\n')}

## ROI fields
${roi().map(([label, v]) => `- ${label}: ${v ? md(v) : 'blank'}`).join('\n')}

## Open flags
${flags.join('\n')}

## Receipts
- Before number: ${md(b)}
- Day 7: (fill after V1)
- Day 30: (fill after V1)
- After number: (fill after V1, not during this audit)
- Referral ask earned: Pending. Ask only after a day-30 receipt.
`;
  }
  function renderPrint() {
    const d = data();
    el('print-client').textContent = d.client || 'Audit not complete';
    el('print-owner').textContent = [d.owner, d.trade, d.date.replace('T', ' ')].filter(Boolean).join(' / ');
    const entries = [
      ['Introduced by', [partner(), d.partner_type].filter(v => v && v !== unknown).join(' / ') || unknown],
      ['First process that breaks', d.clog],
      ['Why this comes first', d.why_first],
      ['KPI', d.kpi],
      ['Baseline → target', `${baseline()} → ${d.target || 'Not recorded'}`],
      ['30-day outcome', d.outcome_30],
      ['Smallest proof-of-concept', d.poc],
      ['Verdict', d.verdict],
      ['Recommended V1', d.v1],
      ['Next step', d.next]
    ];
    el('print-details').replaceChildren();
    for (const [label, text] of entries) {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = text || 'Not recorded';
      el('print-details').append(dt, dd);
    }
  }
  form.addEventListener('submit', e => e.preventDefault());
  for (const event of ['input', 'change']) form.addEventListener(event, e => {
    if (e.target.name) e.target.setCustomValidity('');
    changed = true; render(); save();
  });
  form.elements.baseline.addEventListener('blur', () => {
    if (!value('baseline')) { form.elements.baseline.value = unknown; render(); save(); }
  });
  form.elements.terms.addEventListener('blur', () => {
    if (!value('terms')) { form.elements.terms.value = approves; render(); save(); }
  });
  document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => showStep(Number(b.dataset.step), true)));
  el('previous').addEventListener('click', () => showStep(Math.max(0, step - 1), true));
  el('continue').addEventListener('click', () => showStep(Math.min(3, step + 1), true));
  el('export').addEventListener('click', () => {
    if (!validate()) return;
    const who = value('partner') ? slug(value('partner')) : '';
    const filename = `${value('date').slice(0, 10)}-${who || 'unconfirmed-partner'}-${slug(value('client')) || 'client'}.md`;
    const url = URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    say(`Download requested: ${filename}. Save it in partners/ and open it to verify. ${baseline() === unknown ? 'Baseline still UNCONFIRMED.' : ''}`);
  });
  el('copy').addEventListener('click', async () => {
    if (!validate()) return;
    const text = markdown();
    try { await navigator.clipboard.writeText(text); say('Markdown copied. Paste into a local partner file. Nothing sent.'); }
    catch { el('copy-fallback').value = text; el('copy-dialog').showModal(); el('copy-fallback').select(); say('Select and copy the markdown in the dialog.'); }
  });
  el('copy-close').addEventListener('click', () => el('copy-dialog').close());
  el('print').addEventListener('click', () => { if (validate()) { renderPrint(); window.print(); say('Print dialog requested. Review the single-page recap before saving or printing.'); } });
  window.addEventListener('beforeprint', renderPrint);
  el('new').addEventListener('click', () => {
    if (changed && !window.confirm('Start a new audit? This clears the current browser draft. Export it first if you need to keep it.')) return;
    reset(); save(); say('New audit. Previous draft cleared. Baseline is UNCONFIRMED and the partner fee is [THOMAS APPROVES].');
    form.elements.client.focus();
  });
  restore();
})();
