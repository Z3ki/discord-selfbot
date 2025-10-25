export const evaluateEvidenceTool = {
  name: 'evaluate_evidence',
  description: 'Evaluate scientific evidence, research quality, and study validity',
  parameters: {
    type: 'object',
    properties: {
      claim: { type: 'string', description: 'The claim or hypothesis being evaluated' },
      evidence: { type: 'string', description: 'The evidence or study data to evaluate' },
      study_type: { type: 'string', description: 'Type of study or evidence', enum: ['observational', 'experimental', 'clinical_trial', 'meta_analysis', 'case_study', 'anecdotal'] }
    },
    required: ['claim', 'evidence']
  }
};

export async function executeEvaluateEvidence(args, message, client, providerManager) {
  const { claim, evidence, study_type = 'general' } = args;

  const prompt = `Evaluate this scientific evidence:

**Claim:** ${claim}

**Evidence:** ${evidence}

**Study Type:** ${study_type}

Provide a critical evaluation that includes:
1. **Study Design Quality**: Strengths and weaknesses of the methodology
2. **Sample Size & Selection**: Appropriateness of the sample
3. **Bias Assessment**: Potential sources of bias
4. **Statistical Validity**: Quality of statistical analysis
5. **Alternative Explanations**: Other possible interpretations
6. **Overall Strength**: Rating of evidence quality (Strong/Moderate/Weak/Very Weak)
7. **Conclusions**: What can reasonably be concluded from this evidence

Be objective and evidence-based in your evaluation.`;

  try {
    const result = await providerManager.generateContent(prompt);
    const evaluation = result.text || result;

    return `**Evidence Evaluation:**\n${evaluation}`;
  } catch (error) {
    return `Error evaluating evidence: ${error.message}`;
  }
}