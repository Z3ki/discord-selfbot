export const calculateTool = {
  name: 'calculate',
  description: 'Evaluate a mathematical expression (supports basic arithmetic, parentheses, and functions like sin, cos, sqrt, log, etc.)',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'The mathematical expression to evaluate (e.g., "2+2", "Math.sqrt(16)", "(3*4)/2")' }
    },
    required: ['expression']
  }
};

// Safe math expression evaluator
function safeEval(expression) {
  // Remove whitespace and validate characters
  const cleanExpr = expression.replace(/\s/g, '');
  
  // Only allow numbers, basic operators, parentheses, and Math functions
  const allowedPattern = /^[0-9+\-*/().,Math.sinMath.cosMath.tanMath.sqrtMath.logMath.expMath.absMath.powMath.minMath.maxMath.floorMath.ceilMath.roundMath.PI]+$/;
  if (!allowedPattern.test(cleanExpr)) {
    throw new Error('Invalid characters in expression');
  }
  
  // Tokenize and evaluate safely
  const tokens = cleanExpr.match(/(\d+\.?\d*|Math\.[a-zA-Z]+|[+\-*/()])/g);
  if (!tokens) {
    throw new Error('Invalid expression format');
  }
  
  // Convert to postfix notation for safe evaluation
  const postfix = infixToPostfix(tokens);
  return evaluatePostfix(postfix);
}

function infixToPostfix(tokens) {
  const output = [];
  const operators = [];
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
  
  for (const token of tokens) {
    if (token.match(/^\d+\.?\d*$/) || token.startsWith('Math.')) {
      output.push(token);
    } else if (token === '(') {
      operators.push(token);
    } else if (token === ')') {
      while (operators.length > 0 && operators[operators.length - 1] !== '(') {
        output.push(operators.pop());
      }
      operators.pop(); // Remove '('
    } else if (precedence[token]) {
      while (operators.length > 0 && 
             precedence[operators[operators.length - 1]] >= precedence[token]) {
        output.push(operators.pop());
      }
      operators.push(token);
    }
  }
  
  while (operators.length > 0) {
    output.push(operators.pop());
  }
  
  return output;
}

function evaluatePostfix(postfix) {
  const stack = [];
  
  for (const token of postfix) {
    if (token.match(/^\d+\.?\d*$/)) {
      stack.push(parseFloat(token));
    } else if (token.startsWith('Math.')) {
      const value = stack.pop();
      const funcName = token.substring(5);
      switch (funcName) {
        case 'sin': stack.push(Math.sin(value)); break;
        case 'cos': stack.push(Math.cos(value)); break;
        case 'tan': stack.push(Math.tan(value)); break;
        case 'sqrt': stack.push(Math.sqrt(value)); break;
        case 'log': stack.push(Math.log(value)); break;
        case 'exp': stack.push(Math.exp(value)); break;
        case 'abs': stack.push(Math.abs(value)); break;
        case 'floor': stack.push(Math.floor(value)); break;
        case 'ceil': stack.push(Math.ceil(value)); break;
        case 'round': stack.push(Math.round(value)); break;
        case 'PI': stack.push(Math.PI); break;
        default: throw new Error(`Unknown function: ${funcName}`);
      }
    } else {
      const b = stack.pop();
      const a = stack.pop();
      switch (token) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/': 
          if (b === 0) throw new Error('Division by zero');
          stack.push(a / b); 
          break;
        default: throw new Error(`Unknown operator: ${token}`);
      }
    }
  }
  
  if (stack.length !== 1) {
    throw new Error('Invalid expression evaluation');
  }
  
  return stack[0];
}

export async function executeCalculate(args) {
  try {
    const result = safeEval(args.expression);
    if (typeof result === 'number' && isFinite(result)) {
      return result.toString();
    } else {
      return 'Invalid result';
    }
  } catch (error) {
    return 'Error evaluating expression: ' + error.message;
  }
}