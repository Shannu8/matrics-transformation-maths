import assert from 'assert';
import { MathExpressionParser, ExpressionError } from '../frontend/src/math/expressionParser.js';

console.log('================================================================');
console.log('  Math Expression Parser Verification Suite                     ');
console.log('================================================================\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`[FAIL] ${name}:`, e);
    throw e;
  }
}

// 1. Constants
test('Evaluates pi and π', () => {
  assert.strictEqual(MathExpressionParser.evaluate('pi'), Math.PI);
  assert.strictEqual(MathExpressionParser.evaluate('π'), Math.PI);
  assert.strictEqual(MathExpressionParser.evaluate('PI'), Math.PI);
});

test('Evaluates e', () => {
  assert.strictEqual(MathExpressionParser.evaluate('e'), Math.E);
});

// 2. Variables (theta, θ)
test('Evaluates theta and θ from scope', () => {
  assert.strictEqual(MathExpressionParser.evaluate('theta', { theta: Math.PI / 4 }), Math.PI / 4);
  assert.strictEqual(MathExpressionParser.evaluate('θ', { theta: Math.PI / 4 }), Math.PI / 4);
  assert.strictEqual(MathExpressionParser.evaluate('theta', { 'θ': Math.PI / 2 }), Math.PI / 2);
});

// 3. Basic Arithmetic and Operators
test('Standard operators (+, -, *, /, ^)', () => {
  assert.strictEqual(MathExpressionParser.evaluate('2 + 3 * 4'), 14);
  assert.strictEqual(MathExpressionParser.evaluate('(2 + 3) * 4'), 20);
  assert.strictEqual(MathExpressionParser.evaluate('10 / 2 - 3'), 2);
  assert.strictEqual(MathExpressionParser.evaluate('2 ^ 3'), 8);
  assert.strictEqual(MathExpressionParser.evaluate('2 ^ 3 ^ 2'), 512); // Right-associative 2^(3^2)
});

test('Unary operators and negative numbers', () => {
  assert.strictEqual(MathExpressionParser.evaluate('-5'), -5);
  assert.strictEqual(MathExpressionParser.evaluate('+5'), 5);
  assert.strictEqual(MathExpressionParser.evaluate('-(-5)'), 5);
  assert.strictEqual(MathExpressionParser.evaluate('-2^2'), -4);
  assert.strictEqual(MathExpressionParser.evaluate('(-2)^2'), 4);
  assert.strictEqual(MathExpressionParser.evaluate('-pi/4'), -Math.PI / 4);
});

// 4. Fractions with pi and theta
test('Evaluates pi/2, pi/4, theta/2', () => {
  assert.strictEqual(MathExpressionParser.evaluate('pi/2'), Math.PI / 2);
  assert.strictEqual(MathExpressionParser.evaluate('pi/4'), Math.PI / 4);
  assert.strictEqual(MathExpressionParser.evaluate('theta/2', { theta: Math.PI / 4 }), Math.PI / 8);
});

// 5. Implicit Multiplication
test('Evaluates implicit multiplication (2pi, 2theta, 2*pi, 2(3+4))', () => {
  assert.strictEqual(MathExpressionParser.evaluate('2pi'), 2 * Math.PI);
  assert.strictEqual(MathExpressionParser.evaluate('2*pi'), 2 * Math.PI);
  assert.strictEqual(MathExpressionParser.evaluate('2theta', { theta: 0.5 }), 1.0);
  assert.strictEqual(MathExpressionParser.evaluate('2*theta', { theta: 0.5 }), 1.0);
  assert.strictEqual(MathExpressionParser.evaluate('2(3+4)'), 14);
  assert.strictEqual(MathExpressionParser.evaluate('(1+2)(3+4)'), 21);
});

// 6. Trigonometric Functions
test('Evaluates sin(theta), cos(theta), tan(theta)', () => {
  const scope = { theta: Math.PI / 4 };
  assert.ok(Math.abs(MathExpressionParser.evaluate('sin(theta)', scope) - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(MathExpressionParser.evaluate('cos(theta)', scope) - Math.SQRT1_2) < 1e-12);
  assert.strictEqual(MathExpressionParser.evaluate('tan(theta)', scope), 1);
});

test('Evaluates sin(pi/4) and cos(pi/3)', () => {
  assert.ok(Math.abs(MathExpressionParser.evaluate('sin(pi/4)') - Math.SQRT1_2) < 1e-12);
  assert.strictEqual(MathExpressionParser.evaluate('cos(pi/3)'), 0.5);
  assert.strictEqual(MathExpressionParser.evaluate('sin(pi/6)'), 0.5);
  assert.strictEqual(MathExpressionParser.evaluate('sin(pi)'), 0); // Exact cleanup
  assert.strictEqual(MathExpressionParser.evaluate('cos(pi/2)'), 0); // Exact cleanup
  assert.strictEqual(MathExpressionParser.evaluate('cos(pi)'), -1);
});

test('Evaluates sqrt(2) and expressions with sqrt', () => {
  assert.strictEqual(MathExpressionParser.evaluate('sqrt(2)'), Math.SQRT2);
  assert.strictEqual(MathExpressionParser.evaluate('sqrt(4)'), 2);
  assert.strictEqual(MathExpressionParser.evaluate('sqrt(2)/2'), Math.SQRT1_2);
});

test('Evaluates nested expressions: 2*cos(theta/2) and 2cos(theta)', () => {
  const scope = { theta: Math.PI / 2 };
  assert.strictEqual(MathExpressionParser.evaluate('2cos(theta)', scope), 0);
  assert.ok(Math.abs(MathExpressionParser.evaluate('2*cos(theta/2)', scope) - 2 * Math.SQRT1_2) < 1e-12);
});

// 7. Error Handling & Safety
test('Rejects division by zero', () => {
  assert.throws(() => MathExpressionParser.evaluate('1 / 0'), /Division by zero/);
  assert.throws(() => MathExpressionParser.evaluate('5 / (2 - 2)'), /Division by zero/);
});

test('Rejects undefined variables', () => {
  assert.throws(() => MathExpressionParser.evaluate('alpha + 1'), /Undefined variable "alpha"/);
});

test('Rejects malformed expressions', () => {
  assert.throws(() => MathExpressionParser.evaluate(''), /empty/);
  assert.throws(() => MathExpressionParser.evaluate('(1 + 2'), /Unexpected end of expression/);
  assert.throws(() => MathExpressionParser.evaluate('1 + * 2'), /Unexpected/);
  assert.throws(() => MathExpressionParser.evaluate('sin'), /must be followed by parentheses/);
  assert.throws(() => MathExpressionParser.evaluate('sqrt(-1)'), /Square root of negative/);
});

test('validate() helper returns error object instead of throwing', () => {
  const v1 = MathExpressionParser.validate('cos(pi/4)');
  assert.strictEqual(v1.valid, true);
  assert.ok(Math.abs(v1.value - Math.SQRT1_2) < 1e-12);
  assert.strictEqual(v1.error, null);

  const v2 = MathExpressionParser.validate('sin(invalid_var)');
  assert.strictEqual(v2.valid, false);
  assert.strictEqual(v2.value, null);
  assert.ok(v2.error.includes('Undefined variable'));
});

console.log('\n----------------------------------------------------------------');
console.log(`Summary: Passed: ${passed} | Failed: ${total - passed}`);
console.log('================================================================\n');
