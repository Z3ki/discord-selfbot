/**
 * Human-like message splitter that safely splits responses while protecting tool calls and code blocks
 * @param {string} text - The text to potentially split
 * @param {object} config - Configuration for splitting behavior
 * @returns {string[]} Array of message chunks (single element if not split)
 */

export function splitHumanLike(text, config = {}) {
  // Default config values
  const defaults = {
    minSentenceLength: 30,
    splitAtParagraphs: true,
    maxMessageLength: 800,
    probability: 0.6,
  };

  const settings = { ...defaults, ...config };

  // First check if this text is safe to split
  if (!canSafelySplit(text)) {
    return [text];
  }

  // Check probability
  if (Math.random() > settings.probability) {
    return [text];
  }

  // If text is short, don't split
  if (text.length < settings.maxMessageLength) {
    return [text];
  }

  const messages = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= settings.maxMessageLength) {
      messages.push(remaining.trim());
      break;
    }

    // Try to find a good split point
    let splitIndex = findBestSplitPoint(remaining, settings);

    if (splitIndex === -1) {
      // No good split point found, force split at max length
      splitIndex = settings.maxMessageLength;
    }

    const chunk = remaining.substring(0, splitIndex).trim();
    messages.push(chunk);
    remaining = remaining.substring(splitIndex).trim();

    // Safety check: if we have too many messages, stop splitting
    if (messages.length >= 5) {
      messages.push(remaining);
      break;
    }
  }

  return messages.filter((msg) => msg.length > 0);
}

/**
 * Determines if a response can be safely split without breaking functionality
 * @param {string} text - The text to check
 * @returns {boolean} True if safe to split
 */
export function canSafelySplit(text) {
  // Don't split if contains:
  // - Tool calls (TOOL: or functionName(...))
  // - Code blocks (```)
  // - Tool results (TOOL_RESULT_)
  // - Numbered lists (1. 2. etc.)
  // - Complex markdown tables or quotes

  const unsafePatterns = [
    /TOOL:/i,
    /TOOL_RESULT_/i,
    /```[\s\S]*?```/g, // Code blocks
    /^\d+\.\s/m, // Numbered lists
    /^\s*\d+\)\s/m, // Alternative numbered lists
    /^\s*[-*+]\s.*\n\s*[-*+]\s/m, // Bullet lists
    /\|.*\|.*\|/, // Tables (basic detection)
    /^> /m, // Blockquotes
  ];

  return !unsafePatterns.some((pattern) => pattern.test(text));
}

/**
 * Finds the best point to split text (paragraphs preferred, then sentences)
 * @param {string} text - Text to split
 * @param {object} settings - Split settings
 * @returns {number} Index to split at, or -1 if no good point found
 */
function findBestSplitPoint(text, settings) {
  const maxLength = settings.maxMessageLength;

  // First try: Split at paragraph breaks (double newlines)
  if (settings.splitAtParagraphs) {
    const paragraphBreak = text.lastIndexOf('\n\n', maxLength);
    if (paragraphBreak > settings.minSentenceLength) {
      return paragraphBreak;
    }
  }

  // Second try: Split at single newlines (line breaks)
  const lineBreak = text.lastIndexOf('\n', maxLength);
  if (lineBreak > settings.minSentenceLength) {
    return lineBreak;
  }

  // Third try: Split at sentence endings
  const sentenceEndings = ['. ', '! ', '? '];
  for (const ending of sentenceEndings) {
    const sentenceBreak = text.lastIndexOf(ending, maxLength);
    if (sentenceBreak > settings.minSentenceLength) {
      // Include the punctuation
      return sentenceBreak + ending.length;
    }
  }

  // Fourth try: Split at other punctuation
  const punctuation = [];
  for (const punct of punctuation) {
    const punctBreak = text.lastIndexOf(punct, maxLength);
    if (punctBreak > settings.minSentenceLength) {
      return punctBreak + punct.length;
    }
  }

  // Last resort: Split at spaces
  const spaceBreak = text.lastIndexOf(' ', maxLength);
  if (spaceBreak > settings.minSentenceLength) {
    return spaceBreak;
  }

  // No good split point found
  return -1;
}

/**
 * Generates a random delay between messages
 * @param {number} min - Minimum delay in ms
 * @param {number} max - Maximum delay in ms
 * @returns {number} Random delay
 */
export function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
