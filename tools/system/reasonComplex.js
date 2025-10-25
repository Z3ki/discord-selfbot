import { isCompleteThinkingProgression, extractThinkingProgression, getThinkingProgressionType, formatThinkingProgression } from '../../utils/reasoningUtils.js';
import { ReasoningLogger, generateSessionId } from '../../utils/reasoningLogger.js';
import { logger } from '../../utils/logger.js';

// Global reasoning display mode (default: brief)
let globalReasoningMode = 'brief';

/**
 * Set the global reasoning display mode
 */
export function setGlobalReasoningMode(mode) {
  if (['brief', 'full'].includes(mode)) {
    globalReasoningMode = mode;
    logger.info('Reasoning mode changed', { newMode: mode });
  }
}

/**
 * Get the current global reasoning display mode
 */
export function getGlobalReasoningMode() {
  return globalReasoningMode;
}

/**
 * Generate a brief summary for thinking progress
 */
function generateBriefSummary(content, stepNumber, type = 'general') {
  const typeSummaries = {
    math: [
      'Setting up the mathematical equation',
      'Applying algebraic manipulation techniques',
      'Solving for the unknown variable',
      'Checking solution validity and domain',
      'Verifying the solution with substitution',
      'Providing final answer and explanation'
    ],
    code: [
      'Analyzing the code structure and logic',
      'Identifying potential bugs or issues',
      'Developing debugging strategies',
      'Implementing fixes and improvements',
      'Testing the corrected code',
      'Documenting changes and recommendations'
    ],
    algorithm: [
      'Understanding the algorithmic problem',
      'Designing the solution approach',
      'Analyzing time and space complexity',
      'Implementing the algorithm steps',
      'Optimizing for efficiency',
      'Validating correctness and edge cases'
    ],
    debug: [
      'Examining error messages and symptoms',
      'Tracing code execution path',
      'Identifying root cause of the issue',
      'Developing fix strategies',
      'Testing the resolution',
      'Preventing future occurrences'
    ],
    logic: [
      'Analyzing the logical structure',
      'Evaluating premises and assumptions',
      'Applying deductive reasoning',
      'Checking for logical consistency',
      'Drawing conclusions',
      'Assessing argument validity'
    ],
    general: [
      'Analyzing the core problem and key elements',
      'Breaking down the problem into components',
      'Evaluating important factors and constraints',
      'Developing potential solution approaches',
      'Assessing solution viability and implications',
      'Reaching final conclusion and recommendations'
    ]
  };

  const summaries = typeSummaries[type] || typeSummaries.general;

  // Use predefined summaries for first few steps, then generate from content
  if (stepNumber <= summaries.length) {
    return summaries[stepNumber - 1];
  }

  // For additional steps, extract more meaningful phrases (4-6 words)
  const words = content.split(' ').slice(0, 5);
  let summary = words.join(' ');
  if (content.length > summary.length) {
    summary += '...';
  }
  return summary;
}

// Import specialized reasoning tools
import { executeSolveEquation } from '../reasoning/solveEquation.js';
import { executeAnalyzeArgument } from '../reasoning/analyzeArgument.js';
import { executeDebugCode } from '../reasoning/debugCode.js';
import { executeEvaluateEvidence } from '../reasoning/evaluateEvidence.js';

// Internal reasoning tool registry
const reasoningTools = {
  solve_equation: executeSolveEquation,
  analyze_argument: executeAnalyzeArgument,
  debug_code: executeDebugCode,
  evaluate_evidence: executeEvaluateEvidence
};

export const reasonComplexTool = {
  name: 'reason_complex',
  description: 'Analyze and solve complex problems with real-time progressive reasoning display (code analysis, math problems, algorithms, debugging, logical arguments, evidence evaluation)',
      parameters: {
        type: 'object',
        properties: {
          problem: { type: 'string', description: 'The complex problem to analyze and solve' },
          type: { type: 'string', description: 'Type of problem (e.g., code, math, algorithm, debug, logic, physics, statistics, science, quantum_mechanics, relativity, argument, evidence, equation, etc.)' }
        },
        required: ['problem', 'type']
      }
};

/**
 * Assess problem complexity to determine optimal thinking depth and timeout
 */
function assessProblemComplexity(problem, type) {
  const problemLength = problem.length;
  const lowerType = type.toLowerCase();
  const lowerProblem = problem.toLowerCase();
  
  // Base complexity factors
  let complexityScore = 1;
  
  // Type-based complexity
  if (lowerType.includes('quantum') || lowerType.includes('relativity') || lowerType.includes('physics')) {
    complexityScore += 2;
  } else if (lowerType.includes('algorithm') || lowerType.includes('debug') || lowerType.includes('code')) {
    complexityScore += 1.5;
  } else if (lowerType.includes('math') || lowerType.includes('equation') || lowerType.includes('statistics')) {
    complexityScore += 1.2;
  } else if (lowerType.includes('logic') || lowerType.includes('argument') || lowerType.includes('ethics')) {
    complexityScore += 1;
  }
  
  // Problem content indicators
  if (lowerProblem.includes('complex') || lowerProblem.includes('difficult') || lowerProblem.includes('advanced')) {
    complexityScore += 0.5;
  }
  
  // Length-based complexity
  if (problemLength > 500) {
    complexityScore += 0.5;
  } else if (problemLength > 200) {
    complexityScore += 0.2;
  }
  
  // Multi-step indicators
  const stepIndicators = ['step', 'phase', 'stage', 'part', 'then', 'after', 'finally', 'first', 'second', 'third'];
  const stepCount = stepIndicators.filter(indicator => lowerProblem.includes(indicator)).length;
  complexityScore += Math.min(stepCount * 0.3, 1);
  
  // Calculate dynamic parameters
  const maxSteps = Math.max(2, Math.min(5, Math.floor(complexityScore + 1.5)));
  const timeout = 300000; // 5 minutes - no timeout
  
  logger.debug('Problem complexity assessed', { 
  complexityScore: complexityScore.toFixed(2), 
  maxSteps, 
  timeout 
});
  
  return {
    maxSteps,
    timeout,
    complexityScore: Math.round(complexityScore * 10) / 10
  };
}

export async function executeReasonComplex(args, message, client, providerManager) {
  logger.debug('executeReasonComplex called', { args, messageId: message?.id, channelId: message?.channel?.id });
  
  const { problem, type = 'general' } = args;

  if (!problem) {
    logger.warn('No problem provided for reasoning');
    return 'Error: No problem provided for reasoning';
  }

// Generate unique session ID for this reasoning session
    const sessionId = `reasoning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Send initial thinking indicator with problem preview
    const problemPreview = problem.substring(0, 60) + (problem.length > 60 ? '...' : '');
    const thinkingMsg = await message.reply(`Thinking... ${type} problem\n\`${problemPreview}\``);
    
    logger.info('Reasoning started', { 
        sessionId, 
        problemType: type, 
        problemPreview,
        messageId: thinkingMsg.id 
      });

// Assess problem complexity for timeout guidance, but let LLM choose progress
    const problemComplexity = assessProblemComplexity(problem, type);
    const timeoutMs = problemComplexity.timeout;
    const reasoningPrompt = `IMPORTANT: Begin IMMEDIATELY with your detailed reasoning - no intro text.

Analyze this ${type} problem: ${problem}

Problem complexity: ${problemComplexity.complexityScore}/5 (suggested: ${problemComplexity.maxSteps} thinking steps, ${Math.round(timeoutMs/1000)}s timeout)

YOU choose how many thinking steps to use based on the problem's needs:
- Simple problems: 1-2 steps
- Moderate problems: 2-3 steps
- Complex problems: 3-5 steps

CRITICAL FORMAT REQUIREMENTS:
- First provide your detailed reasoning for each step
- AFTER each reasoning block, add [Thinking: BRIEF_SUMMARY] where BRIEF_SUMMARY is 3-5 words max
- The [Thinking: ] bracket comes AFTER the reasoning, not before

Example format:
Here I provide detailed analysis of the problem, exploring all aspects...
[Thinking: Problem analysis]

Now I detail the potential solutions and their implications...
[Thinking: Solution approach]

My comprehensive final answer with all reasoning...
[Thinking: Final conclusion]

REASONING FIRST: Provide detailed analysis first
BRACKETS SECOND: Add brief summary after each reasoning block
`;

    let accumulatedText = '';
    let completedThinkingProgressions = [];
    let currentThinkingIndex = 1;
    let currentThinkingContent = '';
    let showingCurrentThinking = false;

    try {
      logger.debug('Reasoning prompt sent:', { prompt: reasoningPrompt.substring(0, 200) + '...' });
      logger.info('Starting reasoning stream', { 
        sessionId, 
        problemType: type, 
        problemLength: problem.length,
        timeout: timeoutMs 
      });
      
      // Get streaming response from AI with dynamic timeout
      logger.debug('Attempting to get stream from provider');
      const stream = await providerManager.generateContentStream(reasoningPrompt);
      const startTime = Date.now();
      logger.debug('Stream obtained', { 
        streamType: typeof stream,
        hasAsyncIterator: stream && typeof stream[Symbol.asyncIterator] === 'function'
      });

      // Process the stream and extract steps progressively
      let lastProcessedLength = 0;
      let previousCompletedCount = 0;
      let chunkCount = 0;
      
      logger.debug('Starting stream processing');
      for await (const chunk of stream) {
        chunkCount++;
        logger.debug('Stream chunk received', { 
          chunkCount,
          chunkText: chunk.text,
          done: chunk.done,
          accumulatedLength: accumulatedText.length
        });
        
        if (chunk.done) {
          logger.debug('Stream marked as done, breaking');
          break;
        }

        accumulatedText += chunk.text;
        const currentTime = Date.now();
        
        logger.debug('Reasoning chunk received:', { 
          chunkCount,
          chunk: chunk.text,
          accumulatedLength: accumulatedText.length,
          hasThinking: accumulatedText.includes('[Thinking:')
        });

        // Check for timeout
        if (currentTime - startTime > timeoutMs) {
          logger.warn('Reasoning timeout', { timeout: timeoutMs });
          break;
        }

        // Only log and process if new content was added
        if (accumulatedText.length > lastProcessedLength) {
          // Log stream chunks for debugging
          await ReasoningLogger.logStreamChunk(sessionId, chunk.text, accumulatedText, 
            accumulatedText.match(/\[Thinking: ([^\]]*?)\]/gi) || []);
          lastProcessedLength = accumulatedText.length;
        }

// Update display when new thinking steps complete (when brackets close)
        // Extract thinking progressions to check for new completions
        const currentCompletedMatches = [];
        let pos = 0;

        while (pos < accumulatedText.length) {
          const startIndex = accumulatedText.indexOf('[Thinking: ', pos);
          if (startIndex === -1) break;

          // Find the matching closing bracket by counting bracket levels
          let bracketLevel = 0;
          let endIndex = -1;

          for (let i = startIndex; i < accumulatedText.length; i++) {
            if (accumulatedText[i] === '[') {
              bracketLevel++;
            } else if (accumulatedText[i] === ']') {
              bracketLevel--;
              if (bracketLevel === 0) {
                endIndex = i;
                break;
              }
            }
          }

          if (endIndex !== -1) {
            // Extract content from after the closing bracket to the next [Thinking: or end
            const afterBracket = endIndex + 1;
            let nextThinkingIndex = accumulatedText.indexOf('[Thinking: ', afterBracket);
            if (nextThinkingIndex === -1) nextThinkingIndex = accumulatedText.length;
            
            const thinkingContent = accumulatedText.substring(afterBracket, nextThinkingIndex).trim();
            if (thinkingContent.length > 0) {
              currentCompletedMatches.push(thinkingContent);
            }
            pos = nextThinkingIndex;
          } else {
            // No matching bracket found, skip this potential match
            pos = startIndex + 1;
          }
        }

// Only update display if we have new completed thinking steps
         if (currentCompletedMatches.length > previousCompletedCount) {
           // Use the currentCompletedMatches we already extracted
           let displayText = '';

           if (currentCompletedMatches.length > 0) {
             const thinkingSteps = currentCompletedMatches.map(function(content, index) {
// For brief mode, show only brief summaries with [Thinking: ] brackets
                const type = getThinkingProgressionType(content);
                const briefSummary = generateBriefSummary(content, index + 1, type);
                return '[Thinking: ' + (index + 1) + '. ' + briefSummary + ']';
             });

displayText = 'Thinking...\n' + thinkingSteps.join('\n');
           }

           if (displayText) {
             try {
               await thinkingMsg.edit(displayText);
               await ReasoningLogger.logDisplayUpdate(sessionId, displayText, currentCompletedMatches.length);
               logger.debug('Updated thinking progress', { 
                 sessionId, 
                 stepCount: currentCompletedMatches.length, 
                 displayTextLength: displayText.length 
               });
               previousCompletedCount = currentCompletedMatches.length;
             } catch (editError) {
logger.warn('Failed to edit thinking message', { error: editError.message });
             }
           }
         }
      }

// Final extraction and display of completed thinking progressions
       const finalThinkingMatches = [];
       let pos = 0;

       while (pos < accumulatedText.length) {
         const startIndex = accumulatedText.indexOf('[Thinking: ', pos);
         if (startIndex === -1) break;

         // Find the matching closing bracket by counting bracket levels
         let bracketLevel = 0;
         let endIndex = -1;

         for (let i = startIndex; i < accumulatedText.length; i++) {
           if (accumulatedText[i] === '[') {
             bracketLevel++;
           } else if (accumulatedText[i] === ']') {
             bracketLevel--;
             if (bracketLevel === 0) {
               endIndex = i;
               break;
             }
           }
         }

         if (endIndex !== -1) {
           // Extract content from after the closing bracket to the next [Thinking: or end
           const afterBracket = endIndex + 1;
           let nextThinkingIndex = accumulatedText.indexOf('[Thinking: ', afterBracket);
           if (nextThinkingIndex === -1) nextThinkingIndex = accumulatedText.length;
           
           const thinkingContent = accumulatedText.substring(afterBracket, nextThinkingIndex).trim();
           if (thinkingContent.length > 0) {
             finalThinkingMatches.push(thinkingContent);
           }
           pos = nextThinkingIndex;
         } else {
           // No matching bracket found, skip this potential match
           pos = startIndex + 1;
         }
       }

       completedThinkingProgressions = finalThinkingMatches.filter(thinking => thinking.length > 0);

        // Display the final thinking progressions (only once, after stream completes)
        if (completedThinkingProgressions.length > 0) {
          const thinkingSteps = completedThinkingProgressions.map((content, index) => {
            const briefSummary = generateBriefSummary(content, index + 1);
            return `**${index + 1}.** ${briefSummary}`;
          });

          const displayText = `Thinking...\n${thinkingSteps.join('\n')}`;
          
          try {
            await thinkingMsg.edit(displayText);
            await ReasoningLogger.logDisplayUpdate(sessionId, displayText, completedThinkingProgressions.length);
          } catch (editError) {
            logger.warn('Failed to edit thinking message', { error: editError.message });
          }
        }

       // Log final extraction results
       await ReasoningLogger.logThinkingExtraction(sessionId, accumulatedText, completedThinkingProgressions);

// If we didn't get all thinking progressions through streaming, show what we have
       if (completedThinkingProgressions.length < 5 && accumulatedText.trim()) {
         // Try to extract any remaining thinking progressions from the final accumulated text
         const remainingMatches = [];
         let pos = 0;

         while (pos < accumulatedText.length) {
           const startIndex = accumulatedText.indexOf('[Thinking: ', pos);
           if (startIndex === -1) break;

           // Find the matching closing bracket by counting bracket levels
           let bracketLevel = 0;
           let endIndex = -1;

           for (let i = startIndex; i < accumulatedText.length; i++) {
             if (accumulatedText[i] === '[') {
               bracketLevel++;
             } else if (accumulatedText[i] === ']') {
               bracketLevel--;
               if (bracketLevel === 0) {
                 endIndex = i;
                 break;
               }
             }
           }

           if (endIndex !== -1) {
             // Extract content from after the closing bracket to the next [Thinking: or end
             const afterBracket = endIndex + 1;
             let nextThinkingIndex = accumulatedText.indexOf('[Thinking: ', afterBracket);
             if (nextThinkingIndex === -1) nextThinkingIndex = accumulatedText.length;
             
             const thinkingContent = accumulatedText.substring(afterBracket, nextThinkingIndex).trim();
             if (thinkingContent.length > 0) {
               remainingMatches.push(thinkingContent);
             }
             pos = nextThinkingIndex;
           } else {
             // No matching bracket found, skip this potential match
             pos = startIndex + 1;
           }
         }

         const remainingThinkingProgressions = remainingMatches.filter(thinking => thinking.length > 0);

// Add any new thinking progressions found
         for (const thinking of remainingThinkingProgressions) {
           if (completedThinkingProgressions.length < problemComplexity.maxSteps) {
             completedThinkingProgressions.push(thinking);
           }
         }

        // Format the accumulated text into numbered thinking steps with brackets
        const thinkingMatches = [];
        let formatPos = 0;

        while (formatPos < accumulatedText.length) {
          const startIndex = accumulatedText.indexOf('[Thinking: ', formatPos);
          if (startIndex === -1) break;

          // Find the matching closing bracket
          let bracketLevel = 0;
          let endIndex = -1;

          for (let i = startIndex; i < accumulatedText.length; i++) {
            if (accumulatedText[i] === '[') {
              bracketLevel++;
            } else if (accumulatedText[i] === ']') {
              bracketLevel--;
              if (bracketLevel === 0) {
                endIndex = i;
                break;
              }
            }
          }

          if (endIndex !== -1) {
            // Extract the bracket content and everything after until next bracket
            const bracketContent = accumulatedText.substring(startIndex, endIndex + 1);
            const afterBracket = endIndex + 1;
            let nextThinkingIndex = accumulatedText.indexOf('[Thinking: ', afterBracket);
            if (nextThinkingIndex === -1) nextThinkingIndex = accumulatedText.length;

            const reasoningContent = accumulatedText.substring(afterBracket, nextThinkingIndex).trim();
            if (reasoningContent.length > 0) {
              thinkingMatches.push({
                bracket: bracketContent,
                content: reasoningContent
              });
            }
            formatPos = nextThinkingIndex;
          } else {
            formatPos = startIndex + 1;
          }
        }

          // Format as numbered steps (brief mode only)
          if (thinkingMatches.length > 0) {
            // Show brief progress indicators with [Thinking: ] brackets
            finalAnswer = thinkingMatches.map((match, index) => {
              const type = getThinkingProgressionType(match.content);
              const briefSummary = generateBriefSummary(match.content, index + 1, type);
              return `[Thinking: ${index + 1}. ${briefSummary}]`;
            }).join('\n');
         } else {
           finalAnswer = accumulatedText.length > 2000 ? accumulatedText.substring(0, 2000) + '...\n\n*(Response truncated due to Discord limit - full reasoning available in logs with `;reasoning-log`)*' : accumulatedText;
         }

// Return empty string - main AI will edit this message with its response
         try {
           await thinkingMsg.edit(`Processing response...`);
         } catch (editError) {
           logger.warn('Failed to edit final thinking message', { error: editError.message });
         }
      }

      // Keep the final analysis visible - no auto-delete

      // Log completion with actual steps used
      logger.info('Reasoning completed', { 
  stepsUsed: completedThinkingProgressions.length, 
  complexityScore: problemComplexity.complexityScore 
});

    } catch (streamError) {
      logger.error('Streaming failed, falling back to regular generation', { 
        error: streamError.message, 
        stack: streamError.stack,
        provider: providerManager.constructor.name 
      });

      // Update message to indicate fallback mode
      try {
        await thinkingMsg.edit(`Thinking... (Using fallback mode due to streaming issues)`);
      } catch (editError) {
        logger.warn('Failed to update thinking message for fallback', { error: editError.message });
      }

      // Fallback: Use regular generation with step-by-step prompt
      let fallbackFinalAnswer = '';
      try {
        const fallbackResult = await providerManager.generateContent(reasoningPrompt);
        const fallbackText = fallbackResult.text || fallbackResult;

// Parse thinking progressions from fallback response
         const thinkingMatches = [];
         let pos = 0;

         while (pos < fallbackText.length) {
           const startIndex = fallbackText.indexOf('[Thinking: ', pos);
           if (startIndex === -1) break;

           // Find the matching closing bracket by counting bracket levels
           let bracketLevel = 0;
           let endIndex = -1;

           for (let i = startIndex; i < fallbackText.length; i++) {
             if (fallbackText[i] === '[') {
               bracketLevel++;
             } else if (fallbackText[i] === ']') {
               bracketLevel--;
               if (bracketLevel === 0) {
                 endIndex = i;
                 break;
               }
             }
           }

           if (endIndex !== -1) {
             // Extract content from after the closing bracket to the next [Thinking: or end
             const afterBracket = endIndex + 1;
             let nextThinkingIndex = fallbackText.indexOf('[Thinking: ', afterBracket);
             if (nextThinkingIndex === -1) nextThinkingIndex = fallbackText.length;
             
             const thinkingContent = fallbackText.substring(afterBracket, nextThinkingIndex).trim();
             if (thinkingContent.length > 0) {
               thinkingMatches.push(thinkingContent);
             }
             pos = nextThinkingIndex;
           } else {
             // No matching bracket found, skip this potential match
             pos = startIndex + 1;
           }
         }

           const parsedThinkingProgressions = thinkingMatches.filter(thinking => thinking.length > 0);

           // Show progress during fallback processing
           if (parsedThinkingProgressions.length > 0) {
             const thinkingSteps = parsedThinkingProgressions.map((content, index) => {
               const briefSummary = generateBriefSummary(content, index + 1);
               return `**${index + 1}.** ${briefSummary}`;
             });

             const displayText = `Thinking... (Fallback mode)\n${thinkingSteps.join('\n')}`;
             
             try {
               await thinkingMsg.edit(displayText);
               await ReasoningLogger.logDisplayUpdate(sessionId, displayText, parsedThinkingProgressions.length);
             } catch (editError) {
               logger.warn('Failed to edit fallback thinking message', { error: editError.message });
             }

             fallbackFinalAnswer = parsedThinkingProgressions.map((content, index) => {
               const briefSummary = generateBriefSummary(content, index + 1);
               return `${index + 1}. ${briefSummary}`;
             }).join('\n');
           } else {
             // No thinking steps found, show processing indicator
             try {
               await thinkingMsg.edit('Thinking... (Processing solution)');
             } catch (editError) {
               logger.warn('Failed to edit fallback processing message', { error: editError.message });
             }
             fallbackFinalAnswer = fallbackText.length > 2000 ? fallbackText.substring(0, 2000) + '...' : fallbackText;
           }

        // Keep the fallback analysis visible - no auto-delete

      } catch (fallbackError) {
        logger.error('Fallback generation also failed', { error: fallbackError.message });
        await thinkingMsg.edit(`Reasoning... Analysis temporarily unavailable. Please try again.`);
      }
    }

    // Log complete session
    try {
      await ReasoningLogger.logReasoningSession({
        sessionId,
        problem,
        type,
        accumulatedText,
        extractedSteps: completedThinkingProgressions,
        complexity: problemComplexity,
        llmChosenSteps: completedThinkingProgressions.length,
        suggestedSteps: problemComplexity.maxSteps
      });

      // Return the full reasoning with [Thinking: ] brackets for the AI to present to the user
      let finalAnswerText = '';
      if (accumulatedText.trim()) {
        // Use the full accumulated text with reasoning and [Thinking: ] brackets
        finalAnswerText = accumulatedText.trim();
        
        // Limit length for AI processing
        if (finalAnswerText.length > 2000) {
          finalAnswerText = finalAnswerText.substring(0, 2000) + '...';
        }
      }

      return finalAnswerText || 'Analysis completed. The detailed reasoning is available in the logs.';
    } catch (error) {
    // Log error
    try {
      await ReasoningLogger.logReasoningSession({
        sessionId: sessionId || 'error-session',
        problem: problem || 'unknown',
        type: type || 'unknown',
        accumulatedText: accumulatedText || '',
        extractedSteps: completedThinkingProgressions || [],
        errors: [error.message]
      });
    } catch (logError) {
      // Ignore logging errors
    }

    return `Error in thinking analysis setup: ${error.message}`;
  }
}

/**
 * Delegate to specialized reasoning tools based on problem type
 */
async function delegateToSpecializedTool(problem, type, message, client, providerManager) {
  const lowerType = type.toLowerCase();
  
  try {
    // Map problem types to specialized tools
    if (lowerType.includes('equation') || lowerType.includes('math') || lowerType.includes('algebra') || lowerType.includes('solve')) {
      const args = { 
        equation: problem,
        domain: 'real',
        method: 'algebraic'
      };
      return await reasoningTools.solve_equation(args, message, client, providerManager);
    }
    
    if (lowerType.includes('argument') || lowerType.includes('logic') || lowerType.includes('fallacy')) {
      const args = {
        argument: problem,
        analysis_type: 'complete'
      };
      return await reasoningTools.analyze_argument(args, message, client, providerManager);
    }
    
    if (lowerType.includes('debug') || lowerType.includes('code') || lowerType.includes('bug') || lowerType.includes('error')) {
      // Extract code from problem if present
      const codeMatch = problem.match(/```(\w+)?\n([\s\S]*?)\n```/);
      const language = codeMatch ? codeMatch[1] : 'unknown';
      const code = codeMatch ? codeMatch[2] : problem;
      
      const args = {
        code: code,
        language: language,
        error_description: problem.includes('error') ? problem : undefined
      };
      return await reasoningTools.debug_code(args, message, client, providerManager);
    }
    
    if (lowerType.includes('evidence') || lowerType.includes('study') || lowerType.includes('research') || lowerType.includes('scientific')) {
      const args = {
        claim: problem,
        evidence: problem, // For now, use problem as both claim and evidence
        study_type: 'general'
      };
      return await reasoningTools.evaluate_evidence(args, message, client, providerManager);
    }
    
    // If no specialized tool matches, return null to use general reasoning
    return null;
    
  } catch (error) {
    logger.warn(`Specialized tool delegation failed for type ${type}`, { error: error.message });
    return null;
  }
}