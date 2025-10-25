# Maxwell Selfbot - API Capabilities Analysis

## Overview
This document outlines the additional data and capabilities available from the AI APIs that we're not currently utilizing in the Maxwell selfbot.

## Google AI (Gemma 3-27B-IT) Additional Capabilities

### Currently Extracted
- Response text
- Token usage (promptTokenCount, candidatesTokenCount, totalTokenCount)
- Safety ratings
- Finish reason
- Response candidates count

### Available But Not Used
- **Token Breakdown by Modality** (`promptTokensDetails`):
  - Separate token counts for TEXT, IMAGE, VIDEO, AUDIO inputs
  - Helps understand multimodal usage patterns

- **Full Content Structure** (`candidates[0].content`):
  - Raw content object instead of just text
  - May include additional metadata about the response

- **Grounding Information** (`candidates[0].grounding`):
  - Factual grounding data for responses
  - Source attribution and confidence scores
  - Useful for fact-checking and citation features

- **Response Blocking** (`candidates[0].blocked`):
  - Whether the response was blocked by safety filters
  - Could be used for fallback handling

- **Candidate Index** (`candidates[0].index`):
  - Index of the selected candidate in multi-candidate responses
  - Useful for A/B testing different response strategies

## NVIDIA NIM Additional Capabilities

### Currently Extracted
- Response text
- Token usage (prompt_tokens, completion_tokens, total_tokens)
- Finish reason
- Response ID and timestamp
- Model information

### Available But Not Used
- **Log Probabilities** (`prompt_logprobs`, `choices[0].logprobs`):
  - Probability scores for each token in prompt and response
  - Useful for uncertainty estimation and confidence scoring
  - Could enable "uncertainty-aware" responses

- **Reasoning Content** (`choices[0].message.reasoning_content`):
  - Internal reasoning steps the model used
  - Could be exposed to users for transparency
  - Useful for educational or debugging purposes

- **Tool Calls in Response** (`choices[0].message.tool_calls`):
  - Native tool calling capability (different from our custom [TOOL] syntax)
  - More structured tool execution
  - Better error handling and validation

- **Refusal Information** (`choices[0].message.refusal`):
  - When the model refuses to answer a question
  - Could trigger fallback responses or alternative approaches

- **Annotations** (`choices[0].message.annotations`):
  - Additional metadata about the response
  - Could include citations, sources, or other contextual information

- **Audio Content** (`choices[0].message.audio`):
  - Audio generation capabilities (if supported by model)
  - Text-to-speech functionality

- **Service Tier** (`service_tier`):
  - Information about the service level/priority
  - Could affect response quality or speed

- **System Fingerprint** (`system_fingerprint`):
  - Unique identifier for the model configuration
  - Useful for reproducibility and debugging

- **KV Transfer Parameters** (`kv_transfer_params`):
  - Key-value caching parameters
  - Could optimize performance for repeated queries

- **Stop Reason** (`choices[0].stop_reason`):
  - Numeric code indicating why generation stopped
  - More detailed than finish_reason

## Potential Enhancements

### Quality Improvements
1. **Confidence Scoring**: Use log probabilities to show response confidence
2. **Factual Grounding**: Display source citations for factual responses
3. **Uncertainty Handling**: Provide alternative responses when confidence is low

### User Experience
1. **Reasoning Transparency**: Show model's thinking process for complex queries
2. **Source Attribution**: Cite sources for factual information
3. **Response Validation**: Use safety ratings to validate response appropriateness

### Performance Optimizations
1. **Smart Caching**: Use KV transfer parameters for repeated queries
2. **Modality-Aware Processing**: Optimize based on input type (text vs image vs video)
3. **Dynamic Retries**: Adjust retry logic based on finish reasons

### Advanced Features
1. **Native Tool Calling**: Replace custom [TOOL] syntax with API-native tool calls
2. **Audio Responses**: Generate audio responses for accessibility
3. **Multi-Candidate Selection**: Choose best response from multiple candidates
4. **Response Branching**: Allow users to explore alternative responses

## Implementation Priority

### High Priority
- Log probabilities for confidence scoring
- Native tool calling integration
- Grounding information for factual responses

### Medium Priority
- Reasoning content transparency
- Token breakdown by modality
- Service tier awareness

### Low Priority
- Audio content generation
- System fingerprint tracking
- Advanced caching parameters

## Current Implementation Status

✅ **Implemented**: Basic text generation, token counting, finish reasons
🔄 **Partially Implemented**: Enhanced metadata extraction, raw response access
❌ **Not Implemented**: Log probabilities, reasoning content, native tool calls, grounding

## Next Steps

1. **Extract Log Probabilities**: Add confidence scoring to responses
2. **Implement Native Tool Calling**: Replace custom syntax with API-native tools
3. **Add Grounding Display**: Show source citations for factual information
4. **Reasoning Transparency**: Optionally show model's thinking process
5. **Modality Analytics**: Track and optimize multimodal usage patterns

## Testing

Run the comprehensive test to see current capabilities:
```bash
cd /path/to/discord-selfbot
node test-comprehensive.js
```

This will show both the currently extracted metadata and available raw response data.</content>
</xai:function_call">Now let me run the final test to show the current capabilities: 

<xai:function_call name="bash">
<parameter name="command">cd /path/to/discord-selfbot && node test-comprehensive.js 2>&1 | grep -A 20 "Discovering available API capabilities"