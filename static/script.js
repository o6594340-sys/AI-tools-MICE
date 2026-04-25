/* ── State ── */
let currentMode = 'brief';
let lastPayload = null;
let rawOutput = '';

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initOtherGoal();
  document.getElementById('btn-generate').addEventListener('click', generate);
  document.getElementById('btn-copy').addEventListener('click', copyText);
  document.getElementById('btn-again').addEventListener('click', () => generate(true));
});

/* ── Tabs ── */
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.mode-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      currentMode = tab.dataset.mode;
      document.getElementById('form-' + currentMode).classList.add('active');
      resetOutput();
    });
  });
}

/* ── "Other" goal checkbox in supplier mode ── */
function initOtherGoal() {
  const cb = document.getElementById('other-goal-cb');
  const group = document.getElementById('custom-goal-group');
  if (cb) {
    cb.addEventListener('change', () => {
      group.style.display = cb.checked ? 'block' : 'none';
    });
  }
}

/* ── Collect form data per mode ── */
function collectData() {
  if (currentMode === 'brief') {
    return {
      mode: 'brief',
      brief_text: val('brief-text'),
      language: val('brief-language'),
    };
  }

  if (currentMode === 'objection') {
    return {
      mode: 'objection',
      objection_text: val('objection-text'),
      objection_type: checkedRadio('obj-type'),
      context: val('objection-context'),
      language: val('objection-language'),
    };
  }

  if (currentMode === 'supplier') {
    const goals = [...document.querySelectorAll('input[name="supplier-goal"]:checked')]
      .map(cb => cb.value)
      .filter(v => v !== 'other');
    return {
      mode: 'supplier',
      context: val('supplier-context'),
      goals,
      custom_goal: val('custom-goal'),
      tone: checkedRadio('supplier-tone'),
    };
  }

  if (currentMode === 'dmc') {
    return {
      mode: 'dmc',
      dmc_text: val('dmc-text'),
      tone: checkedRadio('dmc-tone'),
    };
  }

  if (currentMode === 'followup') {
    return {
      mode: 'followup',
      proposal: val('followup-proposal'),
      days: checkedRadio('followup-days'),
      tone: checkedRadio('followup-tone'),
      language: val('followup-language'),
    };
  }

  if (currentMode === 'concept') {
    return {
      mode: 'concept',
      brief: val('concept-brief'),
      dmc_program: val('concept-dmc'),
    };
  }

  return { mode: currentMode };
}

/* ── Validate required fields ── */
function validate(data) {
  const required = {
    brief: 'brief_text',
    objection: 'objection_text',
    supplier: 'context',
    dmc: 'dmc_text',
    followup: null,
    concept: 'brief',
  };
  const field = required[data.mode];
  if (field && !data[field]?.trim()) {
    return false;
  }
  return true;
}

/* ── Main generate function ── */
async function generate(isRetry = false) {
  const data = isRetry && lastPayload ? lastPayload : collectData();

  if (!validate(data)) {
    showError('Пожалуйста, заполните обязательное поле.');
    return;
  }

  lastPayload = data;
  rawOutput = '';

  showLoading();

  const btn = document.getElementById('btn-generate');
  btn.disabled = true;

  try {
    const response = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    showOutputPanel();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const outputEl = document.getElementById('output-text');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break;

        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) {
            showError(parsed.error);
            return;
          }
          if (parsed.chunk) {
            rawOutput += parsed.chunk;
            outputEl.textContent = rawOutput;
          }
        } catch (_) { /* partial JSON line, skip */ }
      }
    }

    /* Final render with markdown */
    const outputTextEl = document.getElementById('output-text');
    outputTextEl.innerHTML = marked.parse(rawOutput);
    showOutputActions();

  } catch (err) {
    showError('Ошибка соединения: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

/* ── Copy plain text ── */
function copyText() {
  const text = document.getElementById('output-text').innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-copy');
    btn.textContent = 'Скопировано ✓';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Копировать текст';
      btn.classList.remove('copied');
    }, 2000);
  });
}

/* ── UI helpers ── */
function showLoading() {
  hide('output-placeholder');
  hide('output-content');
  hide('output-error');
  show('output-loading');
}

function showOutputPanel() {
  hide('output-loading');
  hide('output-placeholder');
  hide('output-error');
  show('output-content');
  hide('output-actions-inner');
}

function showOutputActions() {
  const actions = document.querySelector('.output-actions');
  if (actions) actions.style.display = 'flex';
}

function showError(msg) {
  hide('output-loading');
  hide('output-content');
  hide('output-placeholder');
  const el = document.getElementById('output-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function resetOutput() {
  hide('output-content');
  hide('output-loading');
  hide('output-error');
  show('output-placeholder');
  rawOutput = '';
}

function show(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = '';
}

function hide(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function checkedRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}
