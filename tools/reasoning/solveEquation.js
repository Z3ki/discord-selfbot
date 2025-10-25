export const solveEquationTool = {
  name: 'solve_equation',
  description: 'Solve complex mathematical equations and inequalities with step-by-step solutions',
  parameters: {
    type: 'object',
    properties: {
      equation: { type: 'string', description: 'The mathematical equation to solve (e.g., "x^2 + 3x - 10 = 0", "2x + 5 = 15")' },
      domain: { type: 'string', description: 'Domain for solutions (real, complex, integers)', enum: ['real', 'complex', 'integers'] },
      method: { type: 'string', description: 'Solution method to use', enum: ['algebraic', 'graphical', 'numerical'] }
    },
    required: ['equation']
  }
};

export async function executeSolveEquation(args, message, client, providerManager) {
  const { equation, domain = 'real', method = 'algebraic' } = args;

  const prompt = `Solve this mathematical equation step by step:

Equation: ${equation}
Domain: ${domain}
Method: ${method}

Provide a complete step-by-step solution with:
1. The original equation
2. Each step of the solution process
3. The final answer(s)
4. Verification if applicable

Format your response clearly with numbered steps.`;

  try {
    const result = await providerManager.generateContent(prompt);
    const solution = result.text || result;

    return `**Equation:** ${equation}\n**Solution:**\n${solution}`;
  } catch (error) {
    return `Error solving equation: ${error.message}`;
  }
}