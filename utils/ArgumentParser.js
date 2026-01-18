/**
 * Utility functions for parsing function arguments and tool parameters
 * Refactored from ai.js for better maintainability and testability
 */

/**
 * Parse function arguments from a string like "arg1=value1, arg2=\"value with spaces\""
 */
export function parseFunctionArgs(argsStr) {
  const args = {};

  if (!argsStr) return args;

  const argPairs = splitArguments(argsStr);

  // Parse each arg=val pair
  for (const pair of argPairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;

    const key = pair.substring(0, eqIndex).trim();
    let value = pair.substring(eqIndex + 1).trim();

    // Remove surrounding quotes
    value = unquoteString(value);

    // Unescape quotes and escape sequences
    value = unescapeString(value);

    // Convert to appropriate type
    args[key] = convertValue(value);
  }

  return args;
}

/**
 * Parse tool arguments with special handling for specific functions and JSON format
 */
export function parseToolArgs(funcName, paramsStr) {
  const args = {};

  // Special handling for set_prompt with quoted string
  if (funcName === 'set_prompt' && isQuotedString(paramsStr)) {
    args.prompt = paramsStr.slice(1, -1);
    return args;
  }

  // Try JSON parsing first (for AI-generated JSON format)
  if (paramsStr.trim().startsWith('{') && paramsStr.trim().endsWith('}')) {
    try {
      // Clean up the JSON string for proper parsing
      let cleanJsonStr = paramsStr.trim();

      // Fix escaped quotes and newlines for JSON parsing
      cleanJsonStr = cleanJsonStr
        .replace(/\\n/g, '\n') // Fix escaped newlines
        .replace(/\\"/g, '"') // Fix escaped quotes
        .replace(/\\\\/g, '\\'); // Fix double backslashes

      // Remove problematic control characters manually
      cleanJsonStr = cleanJsonStr.replace(
        /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\u009F]/g,
        ''
      );

      // Handle triple quotes by converting them to regular quotes for JSON parsing
      cleanJsonStr = cleanJsonStr.replace(
        /"""([^]*?)"""/g,
        (match, content) => {
          return JSON.stringify(content);
        }
      );

      const parsed = parseSecureJson(cleanJsonStr);

      // Validate that all required parameters are present
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch (jsonError) {
      // JSON parsing failed, fall back to key=value parsing
      console.debug(
        'JSON parsing failed, falling back to key=value format:',
        jsonError.message
      );
    }
  }

  // Parse param1=value param2="value with spaces" (fallback)
  const pairs = parseKeyValuePairs(paramsStr);

  for (const { key, value } of pairs) {
    args[key] = convertValue(value);
  }

  return args;
}

/**
 * Split arguments by comma while respecting quotes and parentheses
 */
function splitArguments(argsStr) {
  const argPairs = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let parenDepth = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];

    if (!inQuotes && isQuote(char)) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar && !isEscaped(argsStr, i)) {
      inQuotes = false;
      current += char;
    } else if (!inQuotes && char === '(') {
      parenDepth++;
      current += char;
    } else if (!inQuotes && char === ')') {
      parenDepth--;
      current += char;
    } else if (!inQuotes && parenDepth === 0 && char === ',') {
      argPairs.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    argPairs.push(current.trim());
  }

  return argPairs;
}

/**
 * Parse key-value pairs from parameter string
 */
function parseKeyValuePairs(paramsStr) {
  const pairs = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let key = '';
  let value = '';
  let parsingKey = true;

  for (let i = 0; i < paramsStr.length; i++) {
    const char = paramsStr[i];

    if (!inQuotes && isQuote(char)) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar && !isEscaped(paramsStr, i)) {
      inQuotes = false;
      current += char;
    } else if (!inQuotes && char === '=') {
      key = current.trim();
      current = '';
      parsingKey = false;
    } else if (!inQuotes && char === ' ') {
      if (!parsingKey) {
        value = current.trim();
        if (key && value) {
          pairs.push({
            key,
            value: unquoteString(unescapeString(value)),
          });
        }
        current = '';
        key = '';
        value = '';
        parsingKey = true;
      }
    } else {
      current += char;
    }
  }

  // Handle the last pair
  if (!parsingKey && key && current.trim()) {
    value = current.trim();
    pairs.push({
      key,
      value: unquoteString(unescapeString(value)),
    });
  }

  return pairs;
}

/**
 * Remove surrounding quotes from a string
 */
function unquoteString(str) {
  if (isQuotedString(str)) {
    return str.slice(1, -1);
  }
  return str;
}

/**
 * Unescape common escape sequences
 */
function unescapeString(str) {
  return str
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
}

/**
 * Convert string value to appropriate type
 */
function convertValue(value) {
  if (value === 'True' || value === 'true') {
    return true;
  }
  if (value === 'False' || value === 'false') {
    return false;
  }
  if (!isNaN(value) && value !== '') {
    return Number(value);
  }
  return value;
}

/**
 * Check if a character is a quote
 */
function isQuote(char) {
  return char === '"' || char === "'";
}

/**
 * Check if a string is properly quoted
 */
function isQuotedString(str) {
  return (
    (str.startsWith('"') &&
      str.endsWith('"') &&
      !isEscaped(str, str.length - 1)) ||
    (str.startsWith("'") &&
      str.endsWith("'") &&
      !isEscaped(str, str.length - 1))
  );
}

/**
 * Check if a character at position is escaped
 */
function isEscaped(str, pos) {
  return pos > 0 && str[pos - 1] === '\\';
}

/**
 * Parse JSON string with security measures and depth limits
 */
export function safeJsonParse(jsonStr, defaultValue = null, maxDepth = 10) {
  try {
    return parseSecureJson(jsonStr, maxDepth);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Secure JSON parsing with depth limit and dangerous key filtering
 */
function parseSecureJson(jsonStr, maxDepth = 10) {
  let depth = 0;

  const jsonObj = JSON.parse(jsonStr, (key, value) => {
    // Sanitize dangerous keys that could lead to prototype pollution
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      return undefined;
    }

    // Check depth to prevent stack overflow attacks
    if (typeof value === 'object' && value !== null) {
      depth++;
      if (depth > maxDepth) {
        throw new Error(`JSON depth limit exceeded (${maxDepth})`);
      }
    }

    // Validate string values for injection attempts
    if (typeof value === 'string') {
      // Check for potential injection patterns
      if (
        value.includes('<script') ||
        value.includes('javascript:') ||
        value.includes('data:')
      ) {
        throw new Error('Potentially dangerous content detected in JSON');
      }
    }

    return value;
  });

  return jsonObj;
}

/**
 * Handle triple-quoted HTML content by converting to valid JSON
 */
export function handleTripleQuotes(htmlContent) {
  if (!htmlContent) return htmlContent;

  // Handle triple quotes: """content""" -> "content"
  if (htmlContent.startsWith('"""') && htmlContent.endsWith('"""')) {
    let content = htmlContent.slice(3, -3);

    // Unescape the content since it was wrapped in triple quotes
    content = content
      .replace(/\\"/g, '"') // Fix escaped quotes
      .replace(/\\\\/g, '\\') // Fix double backslashes
      .replace(/\\n/g, '\n') // Fix newlines
      .replace(/\\t/g, '\t') // Fix tabs
      .replace(/\\r/g, '\r'); // Fix carriage returns

    return content;
  }

  return htmlContent;
}

/**
 * Validate and sanitize argument object
 */
export function validateArgs(args, schema = {}) {
  const validated = {};

  for (const [key, rules] of Object.entries(schema)) {
    const value = args[key];

    // Check required fields
    if (rules.required && (value === undefined || value === null)) {
      throw new Error(`Required argument '${key}' is missing`);
    }

    // Type validation
    if (value !== undefined && rules.type && typeof value !== rules.type) {
      throw new Error(
        `Argument '${key}' must be of type ${rules.type}, got ${typeof value}`
      );
    }

    // Transform value if needed
    if (value !== undefined && rules.transform) {
      validated[key] = rules.transform(value);
    } else if (value !== undefined) {
      validated[key] = value;
    }
  }

  return validated;
}
