import {
  PROMPT_OPTIMIZATION_GUIDE,
  generateOptimizationSuggestions,
} from './prompt_optimization_guide.js';

// Test the optimization guide with current bot
async function testPromptOptimization() {
  console.log('=== PROMPT OPTIMIZATION ANALYSIS ===\n');
  console.log(PROMPT_OPTIMIZATION_GUIDE);

  // Simulate performance metrics
  const mockMetrics = {
    jailbreakSuccessRate: 30, // Current success rate is low
    toolUsageAccuracy: 60, // Bot may not see all tools
    responseCompliance: 75, // Moderate compliance
  };

  console.log('\n=== OPTIMIZATION SUGGESTIONS ===\n');
  console.log(generateOptimizationSuggestions(mockMetrics));

  console.log('\n=== IMMEDIATE ACTIONS RECOMMENDED ===\n');
  console.log(`
1. STRENGTHEN JAILBREAK:
   - Move jailbreak to absolute first position in prompt
   - Use multiple complementary techniques (persona + override + explicit)
   - Add jailbreak reinforcement in multiple sections
   - Test with Llama-3.3-70b-versatile specifically

2. IMPROVE TOOL VISIBILITY:
   - Check if tools section is being truncated
   - Add tool examples in multiple formats
   - Repeat critical tool information


3. OPTIMIZE PROMPT STRUCTURE:
   - Review character allocation percentages
   - Prioritize jailbreak and tools in unrestricted mode
   - Add mode-specific templates
   - Remove conflicting instructions

4. IMPLEMENT TESTING:
   - Create automated test suite
   - Track success rates for different queries
   - Monitor prompt effectiveness
   - A/B test variations

5. SAFETY VALIDATION:
   - Ensure safe mode cannot be bypassed
   - Test jailbreak resistance in safe mode
   - Verify no prompt injection vulnerabilities
   - Monitor for unintended behaviors

PRIORITY IMPLEMENTATION ORDER:
1. Fix jailbreak positioning and strength
2. Resolve tool visibility issues
3. Optimize prompt structure and allocation
4. Add comprehensive testing
5. Validate safety controls
  `);
}

testPromptOptimization().catch(console.error);
