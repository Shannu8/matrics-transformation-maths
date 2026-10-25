/**
 * Safe Mathematical Expression Parser and Evaluator
 * 
 * - Strictly NO eval() or Function() constructor.
 * - Recursive-descent AST parser with operator precedence.
 * - Supports arithmetic (+, -, *, /, ^), unary (+, -), parentheses.
 * - Supports implicit multiplication: 2pi, 2theta, 2*pi, 2cos(theta), 2(1+3).
 * - Supports mathematical constants: pi, π, e.
 * - Supports angle variable: theta, θ (and user-defined scopes).
 * - Supports standard mathematical functions: sin, cos, tan, asin, acos, atan, sqrt, abs, ln, log, exp.
 * - Numerical clean-up: avoids floating point artifacts for known values (e.g. sin(pi) = 0).
 * - Comprehensive syntax and domain validation (division by zero, negative sqrt, non-finite results).
 */

export class ExpressionError extends Error {
  constructor(message, position = null) {
    super(message);
    this.name = 'ExpressionError';
    this.position = position;
  }
}

export class MathExpressionParser {
  static CONSTANTS = {
    pi: Math.PI,
    'π': Math.PI,
    e: Math.E,
    'e': Math.E
  };

  static FUNCTIONS = {
    sin: (x) => {
      const res = Math.sin(x);
      return Math.abs(res) < 1e-15 ? 0 : res;
    },
    cos: (x) => {
      const res = Math.cos(x);
      return Math.abs(res) < 1e-15 ? 0 : res;
    },
    tan: (x) => {
      const cosVal = Math.cos(x);
      if (Math.abs(cosVal) < 1e-15) {
        throw new ExpressionError(`tan(${x}) is undefined (division by zero at asymptote).`);
      }
      const res = Math.tan(x);
      return Math.abs(res) < 1e-15 ? 0 : res;
    },
    asin: (x) => {
      if (x < -1.00000000001 || x > 1.00000000001) {
        throw new ExpressionError(`asin(${x}) is undefined for |x| > 1.`);
      }
      const clamped = Math.max(-1, Math.min(1, x));
      return Math.asin(clamped);
    },
    acos: (x) => {
      if (x < -1.00000000001 || x > 1.00000000001) {
        throw new ExpressionError(`acos(${x}) is undefined for |x| > 1.`);
      }
      const clamped = Math.max(-1, Math.min(1, x));
      return Math.acos(clamped);
    },
    atan: (x) => Math.atan(x),
    atan2: (y, x) => Math.atan2(y, x),
    sqrt: (x) => {
      if (x < -1e-14) {
        throw new ExpressionError(`Square root of negative number (${x}) is undefined in real numbers.`);
      }
      return Math.sqrt(Math.max(0, x));
    },
    abs: (x) => Math.abs(x),
    ln: (x) => {
      if (x <= 0) throw new ExpressionError(`Natural logarithm ln(${x}) is undefined for non-positive numbers.`);
      return Math.log(x);
    },
    log: (x) => {
      if (x <= 0) throw new ExpressionError(`Logarithm log(${x}) is undefined for non-positive numbers.`);
      return Math.log10 ? Math.log10(x) : Math.log(x) / Math.LN10;
    },
    exp: (x) => Math.exp(x),
    deg2rad: (deg) => deg * (Math.PI / 180.0),
    rad2deg: (rad) => rad * (180.0 / Math.PI)
  };

  /**
   * Tokenizes a mathematical expression string.
   */
  static tokenize(input) {
    if (typeof input !== 'string') {
      throw new ExpressionError('Input expression must be a string.');
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      throw new ExpressionError('Expression is empty.');
    }

    const tokens = [];
    let i = 0;
    const len = input.length;

    while (i < len) {
      const ch = input[i];

      // 1. Skip whitespace
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // 2. Numbers (integers, decimals, scientific notation e.g. 1e-3)
      if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(input[i + 1]))) {
        let numStr = ch;
        i++;
        while (i < len && /[0-9.]/.test(input[i])) {
          numStr += input[i];
          i++;
        }
        // Scientific notation: 1e3, 2.5e-4
        if (i < len && (input[i] === 'e' || input[i] === 'E')) {
          if (i + 1 < len && (/[0-9]/.test(input[i + 1]) || input[i + 1] === '+' || input[i + 1] === '-')) {
            numStr += input[i];
            i++;
            if (input[i] === '+' || input[i] === '-') {
              numStr += input[i];
              i++;
            }
            while (i < len && /[0-9]/.test(input[i])) {
              numStr += input[i];
              i++;
            }
          }
        }
        const val = parseFloat(numStr);
        if (isNaN(val) || !Number.isFinite(val)) {
          throw new ExpressionError(`Invalid number format: "${numStr}"`, i);
        }
        tokens.push({ type: 'NUMBER', value: val, pos: i - numStr.length });
        continue;
      }

      // 3. Operators and Parentheses
      if (ch === '+') { tokens.push({ type: 'PLUS', value: '+', pos: i++ }); continue; }
      if (ch === '-') { tokens.push({ type: 'MINUS', value: '-', pos: i++ }); continue; }
      if (ch === '*') { tokens.push({ type: 'MUL', value: '*', pos: i++ }); continue; }
      if (ch === '/') { tokens.push({ type: 'DIV', value: '/', pos: i++ }); continue; }
      if (ch === '^') { tokens.push({ type: 'POW', value: '^', pos: i++ }); continue; }
      if (ch === '(') { tokens.push({ type: 'LPAREN', value: '(', pos: i++ }); continue; }
      if (ch === ')') { tokens.push({ type: 'RPAREN', value: ')', pos: i++ }); continue; }
      if (ch === ',') { tokens.push({ type: 'COMMA', value: ',', pos: i++ }); continue; }

      // 4. Unicode symbols: π and θ
      if (ch === 'π') {
        tokens.push({ type: 'IDENT', value: 'π', pos: i++ });
        continue;
      }
      if (ch === 'θ') {
        tokens.push({ type: 'IDENT', value: 'θ', pos: i++ });
        continue;
      }

      // 5. Identifiers (variables, functions, constants e.g. sin, cos, theta, pi)
      if (/[a-zA-Z_]/.test(ch)) {
        let ident = ch;
        const startPos = i;
        i++;
        while (i < len && /[a-zA-Z0-9_]/.test(input[i])) {
          ident += input[i];
          i++;
        }
        tokens.push({ type: 'IDENT', value: ident.toLowerCase(), original: ident, pos: startPos });
        continue;
      }

      throw new ExpressionError(`Unexpected character "${ch}" at position ${i + 1}.`, i);
    }

    // Insert implicit multiplication:
    // e.g. [NUMBER, IDENT] -> [NUMBER, MUL, IDENT] (e.g. 2pi, 2theta, 2sin)
    // e.g. [NUMBER, LPAREN] -> [NUMBER, MUL, LPAREN] (e.g. 2(3+4))
    // e.g. [RPAREN, LPAREN] -> [RPAREN, MUL, LPAREN]
    // e.g. [RPAREN, IDENT] -> [RPAREN, MUL, IDENT]
    // e.g. [IDENT(const/var), IDENT] -> [IDENT, MUL, IDENT] (e.g. pi theta)
    const expanded = [];
    for (let k = 0; k < tokens.length; k++) {
      const cur = tokens[k];
      expanded.push(cur);

      if (k + 1 < tokens.length) {
        const next = tokens[k + 1];
        const curIsVal = cur.type === 'NUMBER' || cur.type === 'RPAREN' ||
          (cur.type === 'IDENT' && !this.FUNCTIONS[cur.value]);
        const nextCanMultiply = next.type === 'LPAREN' || next.type === 'IDENT' ||
          (next.type === 'NUMBER' && cur.type === 'RPAREN');

        if (curIsVal && nextCanMultiply) {
          expanded.push({ type: 'MUL', value: '*', pos: cur.pos, implicit: true });
        }
      }
    }

    return expanded;
  }

  /**
   * Evaluates an expression with a given variable scope.
   * @param {string|number} input Expression string or direct number
   * @param {Object} scope Variable dictionary (e.g. { theta: Math.PI / 4 })
   * @returns {number} Evaluated numerical result
   */
  static evaluate(input, scope = {}) {
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) throw new ExpressionError('Non-finite numerical input.');
      return input;
    }

    const tokens = this.tokenize(input);
    let index = 0;

    // Normalizing scope keys (support both theta, θ, pi, π)
    const normalizedScope = {};
    if (scope) {
      for (const [k, v] of Object.entries(scope)) {
        normalizedScope[k.toLowerCase()] = v;
        if (k.toLowerCase() === 'theta') normalizedScope['θ'] = v;
        if (k === 'θ') normalizedScope['theta'] = v;
      }
    }

    // Helper: peek and consume tokens
    const peek = () => tokens[index] || null;
    const consume = (expectedType = null) => {
      const tok = peek();
      if (!tok) {
        throw new ExpressionError('Unexpected end of expression.');
      }
      if (expectedType && tok.type !== expectedType) {
        throw new ExpressionError(`Expected ${expectedType} but found "${tok.value}" at position ${tok.pos + 1}.`, tok.pos);
      }
      index++;
      return tok;
    };

    // Grammar:
    // Expression -> Additive
    // Additive   -> Multiplicative ( ('+' | '-') Multiplicative )*
    // Multiplicative -> Power ( ('*' | '/') Power )*
    // Power      -> Unary ( '^' Power )?   // Right-associative
    // Unary      -> ('+' | '-') Unary | Primary
    // Primary    -> NUMBER | IDENT '(' ArgList ')' | IDENT | '(' Expression ')'

    function parseExpression() {
      return parseAdditive();
    }

    function parseAdditive() {
      let left = parseMultiplicative();
      while (peek() && (peek().type === 'PLUS' || peek().type === 'MINUS')) {
        const op = consume().type;
        const right = parseMultiplicative();
        left = op === 'PLUS' ? left + right : left - right;
        checkFinite(left);
      }
      return left;
    }

    function parseMultiplicative() {
      let left = parseUnary();
      while (peek() && (peek().type === 'MUL' || peek().type === 'DIV')) {
        const op = consume().type;
        const right = parseUnary();
        if (op === 'MUL') {
          left = left * right;
        } else {
          if (Math.abs(right) < 1e-15) {
            throw new ExpressionError('Division by zero is undefined.');
          }
          left = left / right;
        }
        checkFinite(left);
      }
      return left;
    }

    function parseUnary() {
      const tok = peek();
      if (tok && tok.type === 'PLUS') {
        consume('PLUS');
        return parseUnary();
      }
      if (tok && tok.type === 'MINUS') {
        consume('MINUS');
        const val = parseUnary();
        return -val;
      }
      return parsePower();
    }

    function parsePower() {
      const base = parsePrimary();
      if (peek() && peek().type === 'POW') {
        consume('POW');
        const exponent = parseUnary(); // Right-associative exponentiation, e.g. 2^-3 or 2^3^2
        const result = Math.pow(base, exponent);
        checkFinite(result);
        return result;
      }
      return base;
    }

    function parsePrimary() {
      const tok = peek();
      if (!tok) {
        throw new ExpressionError('Unexpected end of expression.');
      }

      // 1. Parenthesized sub-expression
      if (tok.type === 'LPAREN') {
        consume('LPAREN');
        const val = parseExpression();
        consume('RPAREN');
        return val;
      }

      // 2. Numerical literal
      if (tok.type === 'NUMBER') {
        consume('NUMBER');
        return tok.value;
      }

      // 3. Identifier: Function call or Variable / Constant
      if (tok.type === 'IDENT') {
        const identTok = consume('IDENT');
        const name = identTok.value;

        // Check if followed by parenthesis (Function Call)
        if (peek() && peek().type === 'LPAREN') {
          const fn = MathExpressionParser.FUNCTIONS[name];
          if (!fn) {
            const avail = Object.keys(MathExpressionParser.FUNCTIONS).join(', ');
            throw new ExpressionError(`Unknown function "${identTok.original}". Supported functions: ${avail}`, identTok.pos);
          }
          consume('LPAREN');
          const args = [];
          if (!peek() || peek().type !== 'RPAREN') {
            args.push(parseExpression());
            while (peek() && peek().type === 'COMMA') {
              consume('COMMA');
              args.push(parseExpression());
            }
          }
          consume('RPAREN');

          const fnResult = fn(...args);
          checkFinite(fnResult);
          return fnResult;
        }

        // It is a Constant or Variable
        if (MathExpressionParser.CONSTANTS[name] !== undefined) {
          return MathExpressionParser.CONSTANTS[name];
        }

        if (normalizedScope[name] !== undefined) {
          const val = Number(normalizedScope[name]);
          if (!Number.isFinite(val)) {
            throw new ExpressionError(`Variable "${identTok.original}" has non-finite value.`);
          }
          return val;
        }

        // If the user typed a known function name without parentheses, give a helpful hint
        if (MathExpressionParser.FUNCTIONS[name]) {
          throw new ExpressionError(`Function "${identTok.original}" must be followed by parentheses, e.g., "${identTok.original}(theta)".`, identTok.pos);
        }

        const validVars = ['theta', 'θ', 'pi', 'π', 'e', ...Object.keys(scope)].join(', ');
        throw new ExpressionError(`Undefined variable "${identTok.original}". Supported variables & constants: ${validVars}`, identTok.pos);
      }

      throw new ExpressionError(`Unexpected token "${tok.value}" at position ${tok.pos + 1}.`, tok.pos);
    }

    function checkFinite(val) {
      if (!Number.isFinite(val)) {
        throw new ExpressionError('Expression evaluated to non-finite result (NaN or Infinity).');
      }
    }

    const finalResult = parseExpression();

    if (index < tokens.length) {
      const leftover = tokens[index];
      throw new ExpressionError(`Unexpected token "${leftover.value}" after valid expression at position ${leftover.pos + 1}.`, leftover.pos);
    }

    checkFinite(finalResult);

    // Clean up floating point near-integers and half-integers (e.g. sin(pi) -> 0, cos(pi/2) -> 0, cos(pi/3) -> 0.5)
    if (Math.abs(finalResult) < 1e-15) return 0;
    const rounded = Math.round(finalResult);
    if (Math.abs(finalResult - rounded) < 1e-14) return rounded;
    const roundedHalf = Math.round(finalResult * 2) / 2;
    if (Math.abs(finalResult - roundedHalf) < 1e-14) return roundedHalf;
    const roundedQuarter = Math.round(finalResult * 4) / 4;
    if (Math.abs(finalResult - roundedQuarter) < 1e-14) return roundedQuarter;

    return finalResult;
  }

  /**
   * Validates an expression without throwing, returning a status object.
   * @param {string|number} input Expression
   * @param {Object} scope Scope dictionary
   * @returns {{ valid: boolean, value: number|null, error: string|null }}
   */
  static validate(input, scope = {}) {
    try {
      const val = this.evaluate(input, scope);
      return { valid: true, value: val, error: null };
    } catch (err) {
      return { valid: false, value: null, error: err.message || String(err) };
    }
  }

  /**
   * Formats a numerical value cleanly for UI display.
   */
  static formatNumber(val, decimals = 4) {
    if (!Number.isFinite(val)) return 'NaN';
    if (Math.abs(val) < 1e-12) return '0';
    if (Number.isInteger(val)) return String(val);
    const fixed = val.toFixed(decimals);
    // Strip trailing zeros after decimal point
    return fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  }
}
