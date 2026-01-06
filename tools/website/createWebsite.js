// Multi-level JSON decoding for AI-generated HTML
function decodeHtmlContent(html) {
  let result = html;
  let maxIterations = 5; // Prevent infinite loops

  for (let i = 0; i < maxIterations; i++) {
    if (typeof result === 'string') {
      // Check for quoted string (handle both leading and trailing quotes)
      const hasLeadingQuote = result.startsWith('"');
      const hasTrailingQuote = result.endsWith('"');

      if (hasLeadingQuote && hasTrailingQuote) {
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(result);
          // If parsing succeeded and we got a string, continue decoding
          if (typeof parsed === 'string') {
            result = parsed;
          } else {
            // If we got a non-string, we're done
            result = parsed;
            break;
          }
        } catch (e) {
          // If JSON parsing fails, try manual unescaping
          result = result
            .slice(1, -1)
            .replace(/\\"/g, '"') // Unescape quotes
            .replace(/\\\\/g, '\\') // Unescape backslashes
            .replace(/\\n/g, '\n') // Unescape newlines
            .replace(/\\r/g, '\r') // Unescape carriage returns
            .replace(/\\t/g, '\t') // Unescape tabs
            .replace(/\\f/g, '\f') // Unescape form feeds
            .replace(/\\b/g, '\b'); // Unescape backspaces
          // Continue the loop to check if more decoding is needed
        }
      } else if (hasLeadingQuote && !hasTrailingQuote) {
        // Handle malformed JSON with leading quote but missing trailing quote
        result = result
          .slice(1)
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\f/g, '\f')
          .replace(/\\b/g, '\b');
      } else {
        // Not a quoted string, we're done
        break;
      }
    } else {
      // Not a string, we're done
      break;
    }
  }

  return result;
}

// Fix common HTML escaping issues
function fixHtmlEscaping(html) {
  let result = html;

  // Fix double-escaped HTML entities
  result = result.replace(/&amp;quot;/g, '"');
  result = result.replace(/&amp;apos;/g, "'");
  result = result.replace(/&amp;amp;/g, '&');
  result = result.replace(/&amp;lt;/g, '<');
  result = result.replace(/&amp;gt;/g, '>');

  // Fix escaped parentheses that might break JavaScript
  result = result.replace(/\\\(/g, '(');
  result = result.replace(/\\\)/g, ')');

  // Fix escaped braces that might break CSS/JS
  result = result.replace(/\\\{/g, '{');
  result = result.replace(/\\\}/g, '}');

  // Fix escaped brackets that might break arrays/objects
  result = result.replace(/\\\[/g, '[');
  result = result.replace(/\\\]/g, ']');

  // Fix malformed JSON with extra quotes at start/end
  if (result.startsWith('"') && !result.endsWith('"')) {
    result = result.slice(1);
  } else if (!result.startsWith('"') && result.endsWith('"')) {
    result = result.slice(0, -1);
  }

  // Fix double-escaped quotes within HTML
  result = result.replace(/""/g, '"');

  // Fix escaped newlines and tabs
  result = result.replace(/\\n/g, '\n');
  result = result.replace(/\\t/g, '\t');
  result = result.replace(/\\r/g, '\r');

  return result;
}

// Enhanced HTML structure validation and repair
function validateAndRepairHtml(html) {
  let result = html;

  // First fix common escaping issues
  result = fixHtmlEscaping(result);

  // Check for basic HTML structure
  const hasDoctype = result.includes('<!DOCTYPE');
  const hasHtmlTag = result.includes('<html');
  const hasClosingHtmlTag = result.includes('</html>');
  const hasBodyTag = result.includes('<body');
  const hasClosingBodyTag = result.includes('</body>');

  // Repair missing structure
  if (!hasDoctype && !hasHtmlTag) {
    // Complete HTML structure missing, wrap in basic template
    result = `<!DOCTYPE html>
<html>
<head>
<title>Website</title>
</head>
<body>
${result}
</body>
</html>`;
  } else if (!hasClosingHtmlTag) {
    // Missing closing html tag
    result += '\n</html>';
  } else if (!hasClosingBodyTag && hasBodyTag) {
    // Missing closing body tag
    const lastBodyIndex = result.lastIndexOf('</body>');
    if (lastBodyIndex === -1) {
      result = result.replace(/<\/html>/, '\n</body>\n</html>');
    }
  }

  return result;
}

// Attempt to reconstruct truncated HTML content
function reconstructTruncatedHtml(html) {
  let result = html;

  // Common truncation patterns to fix
  const fixes = [
    // Unclosed list items
    { pattern: /<li>[^<]*$/, replacement: '$&</li>' },
    // Unclosed paragraphs
    { pattern: /<p>[^<]*$/, replacement: '$&</p>' },
    // Unclosed divs
    { pattern: /<div[^>]*>[^<]*$/, replacement: '$&</div>' },
    // Unclosed spans
    { pattern: /<span[^>]*>[^<]*$/, replacement: '$&</span>' },
  ];

  for (const fix of fixes) {
    if (fix.pattern.test(result)) {
      result = result.replace(fix.pattern, fix.replacement);
    }
  }

  return result;
}

// Helper function to truncate HTML while maintaining valid structure
function truncateHtmlGracefully(html, maxLength) {
  if (html.length <= maxLength) return html;

  // Try to find a good truncation point (end of a paragraph or div)
  const goodBreakPoints = [
    '</p>',
    '</div>',
    '</section>',
    '</article>',
    '\n\n',
  ];
  let truncationPoint = maxLength;

  for (const breakPoint of goodBreakPoints) {
    const lastIndex = html.lastIndexOf(breakPoint, maxLength);
    if (lastIndex > maxLength * 0.8) {
      // Only use if it's reasonably close to maxLength
      truncationPoint = lastIndex + breakPoint.length;
      break;
    }
  }

  let truncatedHtml = html.substring(0, truncationPoint);

  // Ensure we close any unclosed tags
  truncatedHtml = validateAndRepairHtml(truncatedHtml);

  // Add a note about truncation
  if (!truncatedHtml.includes('content truncated')) {
    const insertPoint = truncatedHtml.lastIndexOf('</body>');
    if (insertPoint > 0) {
      truncatedHtml =
        truncatedHtml.substring(0, insertPoint) +
        '<p><em>Note: Content was truncated due to length limits.</em></p>' +
        truncatedHtml.substring(insertPoint);
    }
  }

  return truncatedHtml;
}

export const createWebsiteTool = {
  name: 'create_website',
  description:
    'TOOL: Creates and hosts a COMPLETE, PROFESSIONAL website. REQUIRED when user wants ANY website created. YOU MUST generate the HTML code yourself based on user requirements - NEVER ask user for HTML! INPUT: name (website identifier) and html (FULL HTML with modern CSS, JavaScript, animations, responsive design). OUTPUT: JSON with success status, URL, and expiration. Create IMPRESSIVE, visually stunning websites with advanced styling, interactions, and modern web technologies. Use JSON format for multi-line HTML: {"name": "sitename", "html": "multi\\nline\\nhtml"}. NEVER claim website creation without calling this tool. ONLY this tool can create websites.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description:
          'Unique name for the website (alphanumeric, underscores, hyphens only)',
      },
      html: {
        type: 'string',
        description:
          'COMPLETE, PROFESSIONAL HTML code with modern CSS, JavaScript, animations, responsive design, and impressive visual effects. MUST be valid HTML with DOCTYPE, head, body. Create visually stunning websites with advanced styling and interactions.',
      },
      description: {
        type: 'string',
        description: 'Brief description of the website',
      },
    },
    required: ['name', 'html'],
  },
  execute: async (args, { logger }) => {
    let name,
      html,
      description = '';

    try {
      ({ name, html, description = '' } = args);

      // WebsiteManager will sanitize the name, so no validation needed here

      // Step 1: Decode multi-level JSON encoding
      html = decodeHtmlContent(html);

      // Step 2: Fix common HTML escaping issues (parentheses, braces, etc.)
      html = fixHtmlEscaping(html);

      // Step 3: Validate and repair HTML structure
      html = validateAndRepairHtml(html);

      // Step 4: Attempt to reconstruct truncated content
      html = reconstructTruncatedHtml(html);

      // NO RESTRICTIONS - Maximum freedom for website creation
      const MAX_HTML_LENGTH = 1000000; // 1MB for unlimited creative freedom
      let contentTruncated = false;

      if (html.length > MAX_HTML_LENGTH) {
        logger.warn(
          'HTML content exceeds maximum length, truncating gracefully',
          {
            originalLength: html.length,
            maxLength: MAX_HTML_LENGTH,
          }
        );

        // Try to truncate at a reasonable point while maintaining valid HTML structure
        html = truncateHtmlGracefully(html, MAX_HTML_LENGTH);
        contentTruncated = true;
        description += ' (content truncated due to length limits)';
      }

      // Import WebsiteManager dynamically to avoid circular imports
      const { WebsiteManager } = await import(
        '../../services/WebsiteManager.js'
      );
      const websiteManager = new WebsiteManager();

      const website = await websiteManager.createWebsite(
        name,
        html,
        description
      );

      // Import config to get base URL
      const { CONFIG } = await import('../../config/config.js');
      const baseUrl = CONFIG.website.baseUrl;

      // website.name is the sanitized id saved by WebsiteManager (alphanumeric with underscores and hyphens)
      const websiteId =
        website?.name || name.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      const url = `${baseUrl.replace(/\/$/, '')}/bot/${websiteId}`;

      logger.info('Website created successfully', {
        name,
        websiteId,
        url,
        description,
      });

      const message = contentTruncated
        ? `Website "${websiteId}" created successfully! (Note: Content was truncated to fit length limits)`
        : `Website "${websiteId}" created successfully!`;

      return {
        success: true,
        message,
        url,
        expiresAt: website.expiresAt,
        description,
        contentTruncated,
      };
    } catch (error) {
      logger.error('Website creation failed', {
        error: error?.message || String(error) || 'Unknown error',
        stack: error?.stack,
        htmlLength: html?.length,
        htmlPreview: html?.substring(0, 200),
        name,
        description,
      });
      // Re-throw the error to be caught by the ToolExecutor
      throw error;
    }
  },
};
