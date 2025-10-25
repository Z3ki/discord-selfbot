import fs from 'fs';
import path from 'path';

const REASONING_LOG_PATH = path.join(process.cwd(), 'logs', 'reasoning.log');

/**
 * Log thinking data for debugging and analysis
 */
export class ReasoningLogger {
  static async logReasoningSession(sessionData) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      sessionId: sessionData.sessionId,
      problem: sessionData.problem,
      type: sessionData.type,
      accumulatedText: sessionData.accumulatedText,
      extractedThinkingProgressions: sessionData.extractedSteps || sessionData.extractedThinkingProgressions,
      displayText: sessionData.displayText,
      errors: sessionData.errors || []
    };

    const logLine = `${timestamp} | ${JSON.stringify(logEntry)}\n`;

    try {
      await fs.promises.appendFile(REASONING_LOG_PATH, logLine);
    } catch (error) {
      console.error('Failed to write thinking log:', error.message);
    }
  }

  static async logStreamChunk(sessionId, chunkText, accumulatedText, thinkingMatches) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      sessionId,
      chunkText: chunkText.substring(0, 200), // Limit chunk size
      accumulatedTextLength: accumulatedText.length,
      thinkingMatches: thinkingMatches || []
    };

    const logLine = `${timestamp} | STREAM | ${JSON.stringify(logEntry)}\n`;

    try {
      await fs.promises.appendFile(REASONING_LOG_PATH, logLine);
    } catch (error) {
      console.error('Failed to write stream log:', error.message);
    }
  }

  static async logThinkingExtraction(sessionId, accumulatedText, extractedThinkingProgressions) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      sessionId,
      accumulatedText: accumulatedText.substring(0, 1000), // Limit size
      extractedThinkingProgressions,
      thinkingCount: extractedThinkingProgressions.length
    };

    const logLine = `${timestamp} | EXTRACTION | ${JSON.stringify(logEntry)}\n`;

    try {
      await fs.promises.appendFile(REASONING_LOG_PATH, logLine);
    } catch (error) {
      console.error('Failed to write extraction log:', error.message);
    }
  }

  static async logDisplayUpdate(sessionId, displayText, thinkingCount) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      sessionId,
      displayText: displayText, // Full display text
      thinkingCount
    };

    const logLine = `${timestamp} | DISPLAY | ${JSON.stringify(logEntry)}\n`;

    try {
      await fs.promises.appendFile(REASONING_LOG_PATH, logLine);
    } catch (error) {
      console.error('Failed to write display log:', error.message);
    }
  }

  static async ensureLogDirectory() {
    const logsDir = path.dirname(REASONING_LOG_PATH);
    try {
      await fs.promises.mkdir(logsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create logs directory:', error.message);
    }
  }
}

// Generate unique session ID
export function generateSessionId() {
  return `thinking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}