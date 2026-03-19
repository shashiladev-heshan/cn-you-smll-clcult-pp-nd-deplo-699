'use strict';

const {
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
} = require('../calculator-logic');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Press a sequence of digit strings on a fresh state */
function typeDigits(digits, initial = createState()) {
  return digits.split('').reduce((s, d) => handleNumber(s, d), initial);
}

// ---------------------------------------------------------------------------
// createState
// ---------------------------------------------------------------------------

describe('createState', () => {
  test('returns default state', () => {
    const s = createState();
    expect(s.current).toBe('0');
    expect(s.previous).toBeNull();
    expect(s.operator).toBeNull();
    expect(s.shouldResetCurrent).toBe(false);
    expect(s.expression).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------

describe('formatNumber', () => {
  test('returns "Error" unchanged', () => {
    expect(formatNumber('Error')).toBe('Error');
  });

  test('returns "0" for NaN string', () => {
    expect(formatNumber('abc')).toBe('0');
  });

  test('formats integer with thousands separator', () => {
    expect(formatNumber('1000')).toBe('1,000');
    expect(formatNumber('1000000')).toBe('1,000,000');
  });

  test('preserves decimal portion', () => {
    expect(formatNumber('1234.56')).toBe('1,234.56');
  });

  test('preserves trailing decimal point (user still typing)', () => {
    expect(formatNumber('42.')).toBe('42.');
  });

  test('uses exponential notation for numbers >= 1e10', () => {
    const result = formatNumber('12000000000');
    expect(result).toMatch(/e/i);
  });

  test('uses exponential notation for very small non-zero numbers', () => {
    const result = formatNumber('0.0000001');
    expect(result).toMatch(/e/i);
  });

  test('does NOT use exponential for exactly 0', () => {
    expect(formatNumber('0')).toBe('0');
  });

  test('formats negative numbers', () => {
    expect(formatNumber('-500')).toBe('-500');
  });

  test('formats simple single-digit number', () => {
    expect(formatNumber('5')).toBe('5');
  });
});

// ---------------------------------------------------------------------------
// handleNumber
// ---------------------------------------------------------------------------

describe('handleNumber', () => {
  test('replaces leading zero with digit', () => {
    const s = handleNumber(createState(), '5');
    expect(s.current).toBe('5');
  });

  test('appends digit to existing number', () => {
    let s = handleNumber(createState(), '3');
    s = handleNumber(s, '7');
    expect(s.current).toBe('37');
  });

  test('builds multi-digit number', () => {
    const s = typeDigits('123');
    expect(s.current).toBe('123');
  });

  test('resets current when shouldResetCurrent is true', () => {
    let s = createState();
    s = Object.assign({}, s, { shouldResetCurrent: true, current: '99' });
    s = handleNumber(s, '4');
    expect(s.current).toBe('4');
    expect(s.shouldResetCurrent).toBe(false);
  });

  test('does not exceed 12-significant-digit limit', () => {
    let s = typeDigits('123456789012'); // 12 digits
    s = handleNumber(s, '3');           // 13th – should be ignored
    expect(s.current).toBe('123456789012');
  });

  test('does not replace "0" with "0"', () => {
    const s = handleNumber(createState(), '0');
    expect(s.current).toBe('0');
  });

  test('allows decimal digit after shouldReset', () => {
    let s = createState();
    s = Object.assign({}, s, { shouldResetCurrent: true });
    s = handleNumber(s, '.');
    // '.' treated as digit – replaces current
    expect(s.current).toBe('.');
  });
});

// ---------------------------------------------------------------------------
// handleDecimal
// ---------------------------------------------------------------------------

describe('handleDecimal', () => {
  test('appends decimal point to integer', () => {
    let s = typeDigits('5');
    s = handleDecimal(s);
    expect(s.current).toBe('5.');
  });

  test('does not add second decimal point', () => {
    let s = typeDigits('5');
    s = handleDecimal(s);
    s = handleDecimal(s);
    expect(s.current).toBe('5.');
  });

  test('resets to "0." when shouldResetCurrent is true', () => {
    let s = createState();
    s = Object.assign({}, s, { shouldResetCurrent: true });
    s = handleDecimal(s);
    expect(s.current).toBe('0.');
    expect(s.shouldResetCurrent).toBe(false);
  });

  test('starting decimal on fresh state gives "0."', () => {
    const s = handleDecimal(createState());
    expect(s.current).toBe('0.');
  });
});

// ---------------------------------------------------------------------------
// handleOperator
// ---------------------------------------------------------------------------

describe('handleOperator', () => {
  test('stores previous and operator', () => {
    let s = typeDigits('8');
    s = handleOperator(s, '+');
    expect(s.previous).toBe('8');
    expect(s.operator).toBe('+');
    expect(s.shouldResetCurrent).toBe(true);
  });

  test('sets expression string with correct symbol', () => {
    let s = typeDigits('3');
    s = handleOperator(s, '*');
    expect(s.expression).toBe('3 ×');
  });

  test('chains operators – triggers implicit calculate', () => {
    // 3 + 5 * → should first compute 3+5=8, then set operator to *
    let s = typeDigits('3');
    s = handleOperator(s, '+');
    s = typeDigits('5', s);           // type 5 after operator
    s = handleOperator(s, '*');       // pressing * should chain
    expect(s.previous).toBe('8');
    expect(s.operator).toBe('*');
  });

  test('supports all four operators', () => {
    for (const op of ['+', '-', '*', '/']) {
      let s = typeDigits('2');
      s = handleOperator(s, op);
      expect(s.operator).toBe(op);
    }
  });
});

// ---------------------------------------------------------------------------
// calculate
// ---------------------------------------------------------------------------

describe('calculate', () => {
  test('adds two numbers', () => {
    let s = typeDigits('4');
    s = handleOperator(s, '+');
    s = typeDigits('6', s);
    s = calculate(s);
    expect(s.current).toBe('10');
  });

  test('subtracts two numbers', () => {
    let s = typeDigits('9');
    s = handleOperator(s, '-');
    s = typeDigits('4', s);
    s = calculate(s);
    expect(s.current).toBe('5');
  });

  test('multiplies two numbers', () => {
    let s = typeDigits('6');
    s = handleOperator(s, '*');
    s = typeDigits('7', s);
    s = calculate(s);
    expect(s.current).toBe('42');
  });

  test('divides two numbers', () => {
    let s = typeDigits('9');
    s = handleOperator(s, '/');
    s = typeDigits('3', s);
    s = calculate(s);
    expect(s.current).toBe('3');
  });

  test('division by zero returns Error', () => {
    let s = typeDigits('5');
    s = handleOperator(s, '/');
    s = typeDigits('0', s);
    s = calculate(s);
    expect(s.current).toBe('Error');
    expect(s.operator).toBeNull();
    expect(s.previous).toBeNull();
  });

  test('returns same state when no operator is set', () => {
    const s = createState();
    const result = calculate(s);
    expect(result).toBe(s); // exact same reference
  });

  test('handles floating point imprecision (0.1 + 0.2)', () => {
    // Build 0.1
    let s = createState();
    s = handleNumber(s, '0');
    s = handleDecimal(s);
    s = handleNumber(s, '1');         // current = '0.1'
    s = handleOperator(s, '+');       // previous = '0.1', operator = '+'
    // Build 0.2 (shouldResetCurrent is true, so typing starts fresh)
    s = handleNumber(s, '0');
    s = handleDecimal(s);
    s = handleNumber(s, '2');         // current = '0.2'
    s = calculate(s);
    expect(parseFloat(s.current)).toBeCloseTo(0.3, 10);
  });

  test('result sets shouldResetCurrent', () => {
    let s = typeDigits('3');
    s = handleOperator(s, '+');
    s = typeDigits('3', s);
    s = calculate(s);
    expect(s.shouldResetCurrent).toBe(true);
  });

  test('result clears operator and previous', () => {
    let s = typeDigits('5');
    s = handleOperator(s, '+');
    s = typeDigits('5', s);
    s = calculate(s);
    expect(s.operator).toBeNull();
    expect(s.previous).toBeNull();
  });

  test('expression is formatted correctly after equals', () => {
    let s = typeDigits('2');
    s = handleOperator(s, '+');
    s = typeDigits('3', s);
    s = calculate(s);
    expect(s.expression).toBe('2 + 3 =');
  });

  test('large number multiplication does not return Infinity prematurely', () => {
    let s = typeDigits('999999');
    s = handleOperator(s, '*');
    s = typeDigits('999999', s);
    s = calculate(s);
    expect(s.current).not.toBe('Error');
    expect(parseFloat(s.current)).toBeGreaterThan(0);
  });

  test('negative number arithmetic', () => {
    let s = typeDigits('5');
    s = handleSign(s);            // -5
    s = handleOperator(s, '+');
    s = typeDigits('3', s);
    s = calculate(s);
    expect(parseFloat(s.current)).toBeCloseTo(-2);
  });
});

// ---------------------------------------------------------------------------
// handleClear
// ---------------------------------------------------------------------------

describe('handleClear', () => {
  test('resets state to defaults', () => {
    let s = typeDigits('123');
    s = handleOperator(s, '+');
    s = handleClear();
    expect(s.current).toBe('0');
    expect(s.previous).toBeNull();
    expect(s.operator).toBeNull();
    expect(s.shouldResetCurrent).toBe(false);
    expect(s.expression).toBe('');
  });

  test('clears Error state', () => {
    let s = typeDigits('1');
    s = handleOperator(s, '/');
    s = typeDigits('0', s);
    s = calculate(s);
    expect(s.current).toBe('Error');
    s = handleClear();
    expect(s.current).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// handleSign
// ---------------------------------------------------------------------------

describe('handleSign', () => {
  test('negates a positive number', () => {
    let s = typeDigits('5');
    s = handleSign(s);
    expect(s.current).toBe('-5');
  });

  test('makes a negative number positive', () => {
    let s = typeDigits('5');
    s = handleSign(s);
    s = handleSign(s);
    expect(s.current).toBe('5');
  });

  test('does nothing for "0"', () => {
    const s = handleSign(createState());
    expect(s.current).toBe('0');
  });

  test('does nothing for "Error"', () => {
    let s = createState();
    s = Object.assign({}, s, { current: 'Error' });
    s = handleSign(s);
    expect(s.current).toBe('Error');
  });
});

// ---------------------------------------------------------------------------
// handlePercent
// ---------------------------------------------------------------------------

describe('handlePercent', () => {
  test('converts 50 to 0.5', () => {
    let s = typeDigits('50');
    s = handlePercent(s);
    expect(parseFloat(s.current)).toBeCloseTo(0.5);
  });

  test('converts 100 to 1', () => {
    let s = typeDigits('100');
    s = handlePercent(s);
    expect(parseFloat(s.current)).toBeCloseTo(1);
  });

  test('does nothing for "Error"', () => {
    let s = createState();
    s = Object.assign({}, s, { current: 'Error' });
    s = handlePercent(s);
    expect(s.current).toBe('Error');
  });

  test('handles 0 percent', () => {
    const s = handlePercent(createState()); // current is '0'
    expect(parseFloat(s.current)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// handleBackspace
// ---------------------------------------------------------------------------

describe('handleBackspace', () => {
  test('removes last character', () => {
    let s = typeDigits('42');
    s = handleBackspace(s);
    expect(s.current).toBe('4');
  });

  test('resets to "0" when only one character left', () => {
    let s = typeDigits('5');
    s = handleBackspace(s);
    expect(s.current).toBe('0');
  });

  test('removes decimal point', () => {
    let s = typeDigits('3');
    s = handleDecimal(s);   // '3.'
    s = handleBackspace(s);
    expect(s.current).toBe('3');
  });

  test('works on "0" (stays "0")', () => {
    const s = handleBackspace(createState());
    expect(s.current).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// Integration / workflow scenarios
// ---------------------------------------------------------------------------

describe('Integration scenarios', () => {
  test('full addition workflow: 12 + 34 = 46', () => {
    let s = createState();
    s = typeDigits('12', s);
    s = handleOperator(s, '+');
    s = typeDigits('34', s);
    s = calculate(s);
    expect(parseFloat(s.current)).toBe(46);
  });

  test('full subtraction workflow: 100 - 37 = 63', () => {
    let s = createState();
    s = typeDigits('100', s);
    s = handleOperator(s, '-');
    s = typeDigits('37', s);
    s = calculate(s);
    expect(parseFloat(s.current)).toBe(63);
  });

  test('full multiplication workflow: 9 * 9 = 81', () => {
    let s = createState();
    s = typeDigits('9', s);
    s = handleOperator(s, '*');
    s = typeDigits('9', s);
    s = calculate(s);
    expect(parseFloat(s.current)).toBe(81);
  });

  test('full division workflow: 100 / 4 = 25', () => {
    let s = createState();
    s = typeDigits('100', s);
    s = handleOperator(s, '/');
    s = typeDigits('4', s);
    s = calculate(s);
    expect(parseFloat(s.current)).toBe(25);
  });

  test('chained operations: 2 + 3 * 5 (left-to-right)', () => {
    // calculator does left-to-right: (2+3)*5 = 25
    let s = createState();
    s = typeDigits('2', s);
    s = handleOperator(s, '+');
    s = typeDigits('3', s);
    s = handleOperator(s, '*');  // triggers 2+3=5, then sets * on 5
    s = typeDigits('5', s);
    s = calculate(s);
    expect(parseFloat(s.current)).toBe(25);
  });

  test('percent then add: 50% + 50% = 1', () => {
    let s = createState();
    s = typeDigits('50', s);
    s = handlePercent(s);         // 0.5
    s = handleOperator(s, '+');
    s = typeDigits('50', s);
    s = handlePercent(s);         // 0.5
    s = calculate(s);
    expect(parseFloat(s.current)).toBeCloseTo(1);
  });

  test('sign flip mid-entry: -7 * -3 = 21', () => {
    let s = createState();
    s = typeDigits('7', s);
    s = handleSign(s);            // -7
    s = handleOperator(s, '*');
    s = typeDigits('3', s);
    s = handleSign(s);            // -3
    s = calculate(s);
    expect(parseFloat(s.current)).toBeCloseTo(21);
  });

  test('clear mid-operation resets everything', () => {
    let s = createState();
    s = typeDigits('9', s);
    s = handleOperator(s, '+');
    s = typeDigits('3', s);
    s = handleClear();
    expect(s.current).toBe('0');
    expect(s.operator).toBeNull();
  });

  test('typing after result starts fresh', () => {
    let s = createState();
    s = typeDigits('5', s);
    s = handleOperator(s, '+');
    s = typeDigits('5', s);
    s = calculate(s);            // result = 10, shouldResetCurrent = true
    s = handleNumber(s, '7');   // should start fresh with '7'
    expect(s.current).toBe('7');
  });

  test('decimal number division: 10 / 4 = 2.5', () => {
    let s = createState();
    s = typeDigits('10', s);
    s = handleOperator(s, '/');
    s = typeDigits('4', s);
    s = calculate(s);
    expect(parseFloat(s.current)).toBeCloseTo(2.5);
  });

  test('double-sign toggle returns to original', () => {
    let s = typeDigits('99');
    s = handleSign(s);
    s = handleSign(s);
    expect(s.current).toBe('99');
  });

  test('backspace corrects mistyped digit then recalculates', () => {
    // Type 1, then 9 (wrong), backspace, type 0 → 10 / 2 = 5
    let s = createState();
    s = handleNumber(s, '1');
    s = handleNumber(s, '9');   // mistype
    s = handleBackspace(s);     // remove '9' → '1'
    s = handleNumber(s, '0');   // '10'
    s = handleOperator(s, '/');
    s = handleNumber(s, '2');
    s = calculate(s);
    expect(parseFloat(s.current)).toBe(5);
  });

  test('percent then multiply: 200% * 3 = 6', () => {
    let s = createState();
    s = typeDigits('200', s);
    s = handlePercent(s);       // 2
    s = handleOperator(s, '*');
    s = typeDigits('3', s);
    s = calculate(s);
    expect(parseFloat(s.current)).toBeCloseTo(6);
  });

  test('large subtraction stays accurate', () => {
    let s = createState();
    s = typeDigits('999999', s);
    s = handleOperator(s, '-');
    s = typeDigits('1', s);
    s = calculate(s);
    expect(parseFloat(s.current)).toBe(999998);
  });

  test('consecutive equals re-uses last result for formatting', () => {
    // After getting a result, calling calculate again with no operator is a no-op
    let s = createState();
    s = typeDigits('8', s);
    s = handleOperator(s, '+');
    s = typeDigits('2', s);
    s = calculate(s);          // 10
    const resultBefore = s.current;
    s = calculate(s);          // no operator set → same state ref returned
    expect(s.current).toBe(resultBefore);
  });

  test('negative decimal arithmetic: -1.5 + 0.5 = -1', () => {
    let s = createState();
    s = handleNumber(s, '1');
    s = handleDecimal(s);
    s = handleNumber(s, '5');   // 1.5
    s = handleSign(s);          // -1.5
    s = handleOperator(s, '+');
    s = handleNumber(s, '0');
    s = handleDecimal(s);
    s = handleNumber(s, '5');   // 0.5
    s = calculate(s);
    expect(parseFloat(s.current)).toBeCloseTo(-1);
  });
});

// ---------------------------------------------------------------------------
// calculate – default/unknown operator guard
// ---------------------------------------------------------------------------

describe('calculate – unknown operator guard', () => {
  test('returns state unchanged when operator is an unknown symbol', () => {
    // Directly craft a state with an unsupported operator to hit the default branch
    const s = {
      current: '5',
      previous: '3',
      operator: '^',       // unsupported
      shouldResetCurrent: false,
      expression: '3 ^',
    };
    const result = calculate(s);
    // Should not crash and returns a state object (same or copy)
    expect(result).toBeDefined();
    expect(result.current).toBe('5');
  });
});
