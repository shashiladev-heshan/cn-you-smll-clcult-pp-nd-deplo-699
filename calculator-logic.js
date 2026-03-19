'use strict';

/**
 * Pure calculator logic – no DOM dependencies.
 * All functions operate on a plain state object and return the next state.
 */

function createState() {
  return {
    current: '0',
    previous: null,
    operator: null,
    shouldResetCurrent: false,
    expression: '',
  };
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

function handleNumber(state, digit) {
  const next = Object.assign({}, state);
  if (next.shouldResetCurrent) {
    next.current = digit;
    next.shouldResetCurrent = false;
  } else {
    if (next.current === '0' && digit !== '.') {
      next.current = digit;
    } else {
      if (next.current.replace('.', '').replace('-', '').length >= 12) return next;
      next.current += digit;
    }
  }
  return next;
}

function handleDecimal(state) {
  const next = Object.assign({}, state);
  if (next.shouldResetCurrent) {
    next.current = '0.';
    next.shouldResetCurrent = false;
    return next;
  }
  if (!next.current.includes('.')) {
    next.current += '.';
  }
  return next;
}

function handleOperator(state, op) {
  let next = Object.assign({}, state);

  if (next.operator && !next.shouldResetCurrent) {
    next = calculate(next);
  }

  next.previous = next.current;
  next.operator = op;
  next.shouldResetCurrent = true;

  const opSymbol = { '+': '+', '-': '−', '*': '×', '/': '÷' }[op];
  next.expression = formatNumber(next.current) + ' ' + opSymbol;
  return next;
}

function calculate(state) {
  if (state.operator === null || state.previous === null) return state;

  const next = Object.assign({}, state);
  const prev = parseFloat(next.previous);
  const curr = parseFloat(next.current);
  let result;

  switch (next.operator) {
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
        next.current = 'Error';
        next.expression = '';
        next.operator = null;
        next.previous = null;
        next.shouldResetCurrent = true;
        return next;
      }
      result = prev / curr;
      break;
    default:
      return next;
  }

  // Fix floating point imprecision
  result = parseFloat(result.toPrecision(12));

  const opSymbol = { '+': '+', '-': '−', '*': '×', '/': '÷' }[next.operator];
  next.expression =
    formatNumber(next.previous) + ' ' + opSymbol + ' ' + formatNumber(next.current) + ' =';

  next.current = String(result);
  next.operator = null;
  next.previous = null;
  next.shouldResetCurrent = true;
  return next;
}

function handleClear() {
  return createState();
}

function handleSign(state) {
  if (state.current === '0' || state.current === 'Error') return state;
  const next = Object.assign({}, state);
  next.current = next.current.startsWith('-')
    ? next.current.slice(1)
    : '-' + next.current;
  return next;
}

function handlePercent(state) {
  if (state.current === 'Error') return state;
  const next = Object.assign({}, state);
  const num = parseFloat(next.current);
  next.current = String(num / 100);
  return next;
}

function handleBackspace(state) {
  const next = Object.assign({}, state);
  if (next.current.length > 1) {
    next.current = next.current.slice(0, -1);
  } else {
    next.current = '0';
  }
  return next;
}

module.exports = {
  createState,
  formatNumber,
  handleNumber,
  handleDecimal,
  handleOperator,
  calculate,
  handleClear,
  handleSign,
  handlePercent,
  handleBackspace,
};
