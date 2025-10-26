import { test, describe } from 'node:test';
import assert from 'node:assert';
import { extractToolCalls } from '../../ai.js';

describe('Multi-Round Tool Execution', () => {
  test('should extract multiple tool calls from AI response', () => {
    const response = `I'll help you with that. Let me run some commands:

TOOL: docker_exec command="ls -la" timeout=10
TOOL: docker_exec command="cat file.txt" timeout=10

Let me check what's in those files.`;

    const toolCalls = extractToolCalls(response);
    
    assert.equal(toolCalls.length, 2, 'Should extract 2 tool calls');
    assert.equal(toolCalls[0].funcName, 'docker_exec', 'First tool should be docker_exec');
    assert.equal(toolCalls[0].args.command, 'ls -la', 'First command should be ls -la');
    assert.equal(toolCalls[1].funcName, 'docker_exec', 'Second tool should be docker_exec');
    assert.equal(toolCalls[1].args.command, 'cat file.txt', 'Second command should be cat file.txt');
  });

  test('should extract tool calls from backtick format', () => {
    const response = `Let me check the system:

\`\`\`docker_exec
command="pwd" timeout=5
\`\`\`

Now let me see what's here:

\`\`\`docker_exec
command="ls" timeout=5
\`\`\``;

    const toolCalls = extractToolCalls(response);
    
    assert.equal(toolCalls.length, 2, 'Should extract 2 tool calls from backtick format');
    assert.equal(toolCalls[0].funcName, 'docker_exec', 'First tool should be docker_exec');
    assert.equal(toolCalls[0].args.command, 'pwd', 'First command should be pwd');
    assert.equal(toolCalls[1].funcName, 'docker_exec', 'Second tool should be docker_exec');
    assert.equal(toolCalls[1].args.command, 'ls', 'Second command should be ls');
  });

  test('should handle mixed tool call formats', () => {
    const response = `I'll use different tools:

TOOL: send_dm userId="123" message="Hello"

\`\`\`send_dm
userId="456" message="Hi there"
\`\`\`

TOOL: change_presence status="online" activity="coding"

Multiple commands executed.`;

    const toolCalls = extractToolCalls(response);
    
    assert.equal(toolCalls.length, 3, 'Should extract 3 tool calls');
    // Check that we have the right tools, regardless of order
    const toolNames = toolCalls.map(call => call.funcName);
    assert.ok(toolNames.includes('send_dm'), 'Should include send_dm');
    assert.ok(toolNames.includes('change_presence'), 'Should include change_presence');
    assert.equal(toolNames.filter(name => name === 'send_dm').length, 2, 'Should have 2 send_dm calls');
  });

  test('should ignore invalid tool names', () => {
    const response = `Let me try some commands:

TOOL: invalid_tool command="ls"
TOOL: docker_exec command="ls" timeout=10
TOOL: fake_command param="value"

Only the valid one should work.`;

    const toolCalls = extractToolCalls(response);
    
    assert.equal(toolCalls.length, 1, 'Should only extract 1 valid tool call');
    assert.equal(toolCalls[0].funcName, 'docker_exec', 'Should only extract docker_exec');
  });

  test('should handle empty response', () => {
    const response = 'No tool calls here, just regular text.';
    
    const toolCalls = extractToolCalls(response);
    
    assert.equal(toolCalls.length, 0, 'Should extract no tool calls from empty response');
  });

  test('should handle malformed tool calls gracefully', () => {
    const response = `Some malformed calls:

TOOL: invalid_tool {invalid json}
TOOL: send_dm userId="123" message="Hello"

Only the valid one should work.`;

    const toolCalls = extractToolCalls(response);
    
    assert.equal(toolCalls.length, 1, 'Should only extract 1 valid tool call');
    assert.equal(toolCalls[0].funcName, 'send_dm', 'Should extract the valid send_dm call');
  });
});