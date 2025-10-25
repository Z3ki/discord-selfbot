export const analyzeArgumentTool = {
  name: 'analyze_argument',
  description: 'Analyze logical arguments, identify premises/conclusions, and detect logical fallacies',
  parameters: {
    type: 'object',
    properties: {
      argument: { type: 'string', description: 'The argument text to analyze' },
      analysis_type: { type: 'string', description: 'Type of analysis to perform', enum: ['structure', 'fallacies', 'validity', 'complete'] }
    },
    required: ['argument']
  }
};

export async function executeAnalyzeArgument(args, message, client, providerManager) {
  const { argument, analysis_type = 'complete' } = args;

  const prompt = `Analyze this logical argument:

"${argument}"

Analysis Type: ${analysis_type}

Provide a structured analysis that includes:
1. **Premises**: What are the stated or implied premises?
2. **Conclusion**: What is the main conclusion?
3. **Structure**: How is the argument structured?
4. **Logical Fallacies**: Are there any logical fallacies present?
5. **Validity**: Is the argument logically valid?
6. **Strength**: How strong is the argument overall?

Be thorough but concise in your analysis.`;

  try {
    const result = await providerManager.generateContent(prompt);
    const analysis = result.text || result;

    return `**Argument Analysis:**\n${analysis}`;
  } catch (error) {
    return `Error analyzing argument: ${error.message}`;
  }
}