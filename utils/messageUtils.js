/**
 * Splits a long message into chunks that fit within Discord's message limit
 * @param {string} text - The text to chunk
 * @param {number} maxLength - Maximum length per chunk (default 1900 for safety margin)
 * @returns {string[]} Array of message chunks
 */
export function chunkMessage(text, maxLength = 1900) {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline within the limit
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1) {
      // Try to split at a space
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1) {
      // Force split at maxLength
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}
