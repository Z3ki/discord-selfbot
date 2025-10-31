// Prompt Optimization Guide for AI Self-Bot
// This file contains meta-instructions for the AI to optimize its own prompt system

export const PROMPT_OPTIMIZATION_GUIDE = `
=== PROMPT OPTIMIZATION TASK ===

You are an AI prompt engineering expert. Your task is to analyze and optimize the current prompt system used by this Discord self-bot to maximize effectiveness while maintaining safety controls.

CURRENT SYSTEM ANALYSIS:
- The bot uses dynamic prompt building with safe/unrestricted modes
- Tools are categorized and conditionally included
- Memory allocation is based on content type and media presence
- Response rules differ between safe and unrestricted modes
- Jailbreak mechanisms are implemented for unrestricted mode

OPTIMIZATION GOALS:
1. **Effectiveness**: Ensure AI understands and follows instructions precisely
2. **Safety**: Maintain proper restrictions in safe mode
3. **Freedom**: Enable unrestricted responses when appropriate
4. **Clarity**: Make instructions unambiguous and direct
5. **Efficiency**: Optimize character usage and prompt structure

SPECIFIC AREAS TO OPTIMIZE:

1. **Jailbreak Effectiveness**:
   - Current jailbreak may not be strong enough for Llama models
   - Consider multiple-layered approach: persona + system override + explicit instructions
   - Test different jailbreak techniques and measure success rates
   - Ensure jailbreak is positioned prominently in prompt hierarchy

2. **Tool Recognition**:
   - AI may not be seeing all available tools
   - Verify tools section is not being truncated
   - Consider repeating critical tool information in multiple sections
   - Add tool usage examples relevant to common queries

3. **Mode Separation**:
   - Ensure clear distinction between safe and unrestricted modes
   - Prevent cross-contamination between mode instructions
   - Add mode-specific reinforcement throughout prompt
   - Consider using different prompt structures for each mode

4. **Character Allocation**:
   - Review current allocation percentages (15% global, 35% memory, 25% message, 15% tools, 10% system)
   - Prioritize critical sections based on use case
   - Consider dynamic allocation based on query complexity
   - Implement smart truncation that preserves important instructions

5. **Instruction Clarity**:
   - Remove ambiguous language
   - Use direct commands rather than suggestions
   - Eliminate conflicting instructions
   - Add explicit "do this" vs "don't do this" formatting

6. **Response Quality**:
   - Add instructions for response structure and formatting
   - Include guidelines for tool usage decisions
   - Add error handling and retry logic
   - Implement response quality checks

IMPLEMENTATION STRATEGY:

1. **Test Framework**:
   - Create automated tests for different query types
   - Measure success rates for safe vs unrestricted modes
   - Track tool usage accuracy
   - Monitor response compliance

2. **Iterative Improvement**:
   - Start with small, targeted changes
   - A/B test different prompt variations
   - Collect performance metrics
   - Roll back changes that reduce effectiveness

3. **Safety Validation**:
   - Ensure safe mode cannot be bypassed accidentally
   - Test jailbreak resistance in safe mode
   - Verify no prompt injection vulnerabilities
   - Monitor for unintended behavior changes

SPECIFIC RECOMMENDATIONS:

1. **Enhanced Jailbreak**:
   - Use multiple complementary techniques
   - Position jailbreak at very beginning of prompt
   - Include explicit override commands
   - Add reinforcement throughout prompt sections

2. **Tool Visibility**:
   - List tools in multiple formats (text + examples)
   - Add tool selection guidance
   - Include tool chaining instructions
   - Prioritize critical tools in allocation

3. **Mode Enforcement**:
   - Add mode verification checks
   - Include mode-specific examples
   - Use different prompt templates per mode
   - Add mode transition handling

4. **Response Optimization**:
   - Add response length optimization
   - Include formatting guidelines
   - Add tool execution decision logic
   - Implement quality assurance checks

NEXT STEPS:
1. Analyze current prompt performance metrics
2. Identify specific failure points
3. Implement targeted optimizations
4. Test and measure improvements
5. Deploy successful changes incrementally

Remember: The goal is to create a prompt system that is both powerful and controllable, with clear boundaries between safe and unrestricted modes.
`;

// Function to generate optimization suggestions
export function generateOptimizationSuggestions(currentPromptStructure, performanceMetrics) {
  return `
Based on current performance analysis:

STRENGTHS:
- Dynamic prompt building allows flexibility
- Mode separation provides safety controls
- Tool categorization improves organization

AREAS FOR IMPROVEMENT:
- Jailbreak effectiveness: ${performanceMetrics.jailbreakSuccessRate}% success rate
- Tool recognition: ${performanceMetrics.toolUsageAccuracy}% accuracy
- Response compliance: ${performanceMetrics.responseCompliance}% compliance

RECOMMENDED CHANGES:
1. Strengthen jailbreak with multi-layer approach
2. Improve tool visibility and recognition
3. Optimize character allocation for critical sections
4. Add response quality guidelines
5. Implement automated testing framework

IMPLEMENTATION PRIORITY:
1. High: Jailbreak effectiveness
2. High: Tool recognition
3. Medium: Response optimization
4. Medium: Character allocation
5. Low: Advanced features
`;
}