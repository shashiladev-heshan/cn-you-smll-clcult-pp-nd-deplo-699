'use strict';

const expressionEl = document.getElementById('expression');
const resultEl = document.getElementById('result');

const state = {
  current: '0',
  previous: null,
  operator: null,
  shouldResetCurrent: false,
  expression: '',
};

function updateDisplay() {
  resultEl.textContent = formatNumber(state.current);
  expressionEl.textContent = state.expression;
}

function formatNumber(value) {
  if (value === 'Error') return 'Error';
  const num = parseFloat(value);
  if (isNaN(num)) return '0';

  // Handle very large or very small numbers
  if (Math.abs(num) >= 1e10 || (Math.abs(num) < 1e-6 && num !== 0)) {
    return num.toExponential(4);
  }

  // Format with commas, preserving trailing decimal point/zeros
  const parts = value.split('.');
  const intPart = parseFloat(parts[0]).toLocaleString('en-US');
  if (parts.length > 1) {
    return intPart + '.' + parts[1];
  }
  return intPart;
}

function handleNumber(digit) {
  if (state.shouldResetCurrent) {
    state.current = digit;
    state.shouldResetCurrent = false;
  } else {
    if (state.current === '0' && digit !== '.') {
      state.current = digit;
    } else {
      if (state.current.replace('.', '').replace('-', '').length >= 12) return;
      state.current += digit;
    }
  }
  updateDisplay();
}

function handleDecimal() {
  if (state.shouldResetCurrent) {
    state.current = '0.';
    state.shouldResetCurrent = false;
    updateDisplay();
    return;
  }
  if (!state.current.includes('.')) {
    state.current += '.';
    updateDisplay();
  }
}

function setActiveOperatorBtn(op) {
  document.querySelectorAll('.btn-equals-op').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === op);
  });
}

function handleOperator(op) {
  if (state.operator && !state.shouldResetCurrent) {
    calculate();
  }

  state.previous = state.current;
  state.operator = op;
  state.shouldResetCurrent = true;

  const opSymbol = { '+': '+', '-': '−', '*': '×', '/': '÷' }[op];
  state.expression = formatNumber(state.current) + ' ' + opSymbol;
  setActiveOperatorBtn(op);
  updateDisplay();
}

function calculate() {
  if (state.operator === null || state.previous === null) return;

  const prev = parseFloat(state.previous);
  const curr = parseFloat(state.current);
  let result;

  switch (state.operator) {
    case '+':
      result = prev + curr;
      break;
    case '-':
      result = prev - curr;
      break;
    case '*':
      result = prev * curr;
      break;
    case '/':
      if (curr === 0) {
        state.current = 'Error';
        state.expression = '';
        state.operator = null;
        state.previous = null;
        state.shouldResetCurrent = true;
        updateDisplay();
        return;
      }
      result = prev / curr;
      break;
    default:
      return;
  }

  // Fix floating point imprecision
  result = parseFloat(result.toPrecision(12));

  const opSymbol = { '+': '+', '-': '−', '*': '×', '/': '÷' }[state.operator];
  state.expression =
    formatNumber(state.previous) + ' ' + opSymbol + ' ' + formatNumber(state.current) + ' =';

  state.current = String(result);
  state.operator = null;
  state.previous = null;
  state.shouldResetCurrent = true;
  setActiveOperatorBtn(null);
  updateDisplay();
}

function handleClear() {
  state.current = '0';
  state.previous = null;
  state.operator = null;
  state.shouldResetCurrent = false;
  state.expression = '';
  setActiveOperatorBtn(null);
  updateDisplay();
}

function handleSign() {
  if (state.current === '0' || state.current === 'Error') return;
  state.current = state.current.startsWith('-')
    ? state.current.slice(1)
    : '-' + state.current;
  updateDisplay();
}

function handlePercent() {
  if (state.current === 'Error') return;
  const num = parseFloat(state.current);
  state.current = String(num / 100);
  updateDisplay();
}

// Button click handler
document.querySelector('.buttons').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const value = btn.dataset.value;

  switch (action) {
    case 'number':
      handleNumber(value);
      break;
    case 'decimal':
      handleDecimal();
      break;
    case 'operator':
      handleOperator(value);
      break;
    case 'equals':
      if (state.operator) {
        calculate();
      }
      break;
    case 'clear':
      handleClear();
      break;
    case 'sign':
      handleSign();
      break;
    case 'percent':
      handlePercent();
      break;
  }
});

// Keyboard support
document.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9') handleNumber(e.key);
  else if (e.key === '.') handleDecimal();
  else if (e.key === '+') handleOperator('+');
  else if (e.key === '-') handleOperator('-');
  else if (e.key === '*') handleOperator('*');
  else if (e.key === '/') { e.preventDefault(); handleOperator('/'); }
  else if (e.key === 'Enter' || e.key === '=') { if (state.operator) calculate(); }
  else if (e.key === 'Escape') handleClear();
  else if (e.key === 'Backspace') {
    if (state.current.length > 1) {
      state.current = state.current.slice(0, -1);
    } else {
      state.current = '0';
    }
    updateDisplay();
  }
});

// Initial render
updateDisplay();
