/**
 * Utility functions for real-time reasoning display
 */

/**
 * Detect if a text chunk represents a complete thinking progression
 * @param {string} text - The accumulated text to analyze
 * @returns {boolean} - True if this represents a complete thinking progression
 */
export function isCompleteThinkingProgression(text) {
  if (!text || text.trim().length === 0) return false;

  const patterns = [
    // Thinking progression indicators
    /Thinking:/i,
    /My thoughts:/i,
    /Let me think:/i,
    /I'm considering:/i,
    /I'm analyzing:/i,
    /I'm evaluating:/i,
    /I'm processing:/i,
    /I'm working through:/i,
    /I'm figuring out:/i,
    /I'm reasoning:/i,

    // Mental process indicators
    /Initial thoughts:/i,
    /First thought:/i,
    /Next thought:/i,
    /Deeper analysis:/i,
    /Further consideration:/i,
    /On second thought:/i,
    /Realization:/i,
    /Insight:/i,
    /Understanding:/i,
    /Clarity:/i,

    // Analysis indicators
    /Root cause:/i,
    /Issue identified:/i,
    /Problem:/i,
    /Solution:/i,
    /Analysis:/i,
    /Conclusion:/i,
    /Verification:/i,
    /Check:/i,
    /Investigation:/i,
    /Examination:/i,

    // Math indicators
    /Equation:/i,
    /Formula:/i,
    /Calculate:/i,
    /Result:/i,
    /Answer:/i,
    /Computation:/i,
    /Derivation:/i,

    // Code indicators
    /Function:/i,
    /Method:/i,
    /Class:/i,
    /Variable:/i,
    /Error:/i,
    /Fix:/i,
    /Debug:/i,
    /Trace:/i,

    // Algorithm indicators
    /Approach:/i,
    /Algorithm:/i,
    /Complexity:/i,
    /Time:/i,
    /Space:/i,
    /Optimization:/i,

    // Logical indicators
    /Therefore,? /i,
    /Thus,? /i,
    /Hence,? /i,
    /So,? /i,
    /Because,? /i,
    /Since,? /i,
    /Given that,? /i,

    // Structural indicators
    /\n\n/,  // Double newline (paragraph break)
    /```[\w]*\n[\s\S]*?\n```/,  // Complete code blocks
    /\*\*.*?\*\*/,  // Bold text sections
    /\* .*?\n/,  // List items
    /\d+\. .*?\n/,  // Numbered lists

    // Length-based: if chunk is substantial and ends with punctuation
    (text) => text.length > 80 && /[.!?]\s*$/.test(text.trim())
  ];

  return patterns.some(pattern => {
    if (typeof pattern === 'function') {
      return pattern(text);
    }
    return pattern.test(text);
  });
}

/**
 * Extract a clean thinking progression from accumulated text
 * @param {string} text - The accumulated text
 * @returns {string} - The extracted thinking progression
 */
export function extractThinkingProgression(text) {
  if (!text) return '';

  // Clean up the text
  let cleanText = text.trim();

  // Remove any trailing incomplete sentences
  const sentences = cleanText.split(/[.!?]+/);
  if (sentences.length > 1) {
    // Keep complete sentences, remove the last potentially incomplete one
    const completeSentences = sentences.slice(0, -1).filter(s => s.trim().length > 0);
    if (completeSentences.length > 0) {
      cleanText = completeSentences.join('. ').trim();
      if (!cleanText.endsWith('.')) cleanText += '.';
    }
  }

  // Limit length for Discord messages (leave room for formatting)
  if (cleanText.length > 1800) {
    cleanText = cleanText.substring(0, 1800) + '...';
  }

  return cleanText;
}

/**
 * Determine the type of thinking progression for UI hints
 * @param {string} text - The thinking progression text
 * @returns {string} - The thinking type (math, code, algorithm, debug, logic, general)
 */
export function getThinkingProgressionType(text) {
  const lowerText = text.toLowerCase();

  if (/\b(equation|formula|calculate|solve|integral|derivative|matrix|vector|quadratic|computation|derivation)\b/.test(lowerText)) {
    return 'math';
  }

  if (/\b(function|method|class|variable|error|bug|fix|code|syntax|compile|runtime|debug|trace)\b/.test(lowerText)) {
    return 'code';
  }

  if (/\b(algorithm|complexity|time|space|sort|search|graph|tree|array|list|optimization)\b/.test(lowerText)) {
    return 'algorithm';
  }

  if (/\b(debug|trace|breakpoint|exception|stack|log|console|error|issue|problem|investigation|examination)\b/.test(lowerText)) {
    return 'debug';
  }

  if (/\b(logic|puzzle|reasoning|deduction|induction|proof|theorem|axiom|analysis|evaluation)\b/.test(lowerText)) {
    return 'logic';
  }

  return 'general';
}

/**
 * Formats a thinking progression for Discord display
 * @param {string} thinking - The thinking progression text
 * @returns {string} - Formatted Discord message
 */
export function formatThinkingProgression(thinking) {
  return `**Thinking...** ${thinking}`;
}