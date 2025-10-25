export const debugCodeTool = {
  name: 'debug_code',
  description: 'Analyze code snippets for bugs, errors, and suggest fixes with detailed explanations',
  parameters: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'The code snippet to debug' },
      language: { type: 'string', description: 'Programming language of the code' },
      error_description: { type: 'string', description: 'Description of the error or issue (optional)' }
    },
    required: ['code', 'language']
  }
};

export async function executeDebugCode(args, message, client, providerManager) {
  const { code, language, error_description } = args;

  const prompt = `Debug this ${language} code:

\`\`\`${language}
${code}
\`\`\`

${error_description ? `Error Description: ${error_description}` : ''}

Provide a comprehensive debugging analysis that includes:
1. **Syntax Errors**: Any syntax issues present
2. **Logic Errors**: Problems with the algorithm or logic flow
3. **Runtime Issues**: Potential runtime errors or edge cases
4. **Best Practices**: Code quality and style issues
5. **Suggested Fixes**: Specific code changes with explanations
6. **Improved Version**: A corrected version of the code

Format your response clearly with sections and code examples.`;

  try {
    const result = await providerManager.generateContent(prompt);
    const debugAnalysis = result.text || result;

    return `**Code Debug Analysis (${language}):**\n${debugAnalysis}`;
  } catch (error) {
    return `Error debugging code: ${error.message}`;
  }
}