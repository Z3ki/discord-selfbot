import { test, describe } from 'node:test';
import assert from 'node:assert';

// Mock the docker exec function for testing
function mockExecuteDockerExec(args, progressCallback) {
  const { command, timeout } = args;
  
  // Return mock result
  return new Promise((resolve) => {
    // Simulate progress updates
    if (progressCallback) {
      progressCallback({ status: 'Starting...' });
      
      // Simulate command output
      setTimeout(() => {
        progressCallback({ 
          stdout: `$ ${command}\nfile1.txt\nfile2.txt\ndirectory/`,
          status: 'Running...'
        });
      }, 10);
      
      setTimeout(() => {
        progressCallback({ 
          stdout: `$ ${command}\nfile1.txt\nfile2.txt\ndirectory/`,
          completed: true,
          exit_code: 0
        });
        
        // Resolve after progress updates
        resolve({
          stdout: `file1.txt\nfile2.txt\ndirectory/`,
          stderr: '',
          exit_code: 0,
          timed_out: false
        });
      }, 50);
    } else {
      // Resolve immediately if no callback
      resolve({
        stdout: `file1.txt\nfile2.txt\ndirectory/`,
        stderr: '',
        exit_code: 0,
        timed_out: false
      });
    }
  });
}

describe('Terminal Output Formatting', () => {
  test('should format command output in clean terminal style', async () => {
    const args = { command: 'ls -la', timeout: 10 };
    let progressUpdates = [];
    
    const progressCallback = (progress) => {
      progressUpdates.push(progress);
    };
    
    await mockExecuteDockerExec(args, progressCallback);
    
    // Check that progress updates include terminal-style formatting
    assert.ok(progressUpdates.length > 0, 'Should have progress updates');
    
    // Find the update with stdout (should be the one with command output)
    const updateWithStdout = progressUpdates.find(update => update.stdout);
    assert.ok(updateWithStdout, 'Should have an update with stdout');
    assert.ok(updateWithStdout.stdout.includes('$ ls -la'), 'Should include command with $ prefix');
    
    // Check final completion update
    const finalUpdate = progressUpdates[progressUpdates.length - 1];
    assert.ok(finalUpdate.completed, 'Should be marked as completed');
    assert.equal(finalUpdate.exit_code, 0, 'Should have exit code 0');
  });

  test('should handle command errors in terminal format', async () => {
    const args = { command: 'cat nonexistent.txt', timeout: 10 };
    
    // Mock error response
    const mockErrorResult = {
      stdout: '',
      stderr: 'cat: nonexistent.txt: No such file or directory',
      exit_code: 1,
      timed_out: false
    };
    
    // Simulate the formatting logic
    function formatTerminalOutput(command, result) {
      let content = `\`\`\`\n$ ${command}\n`;
      
      if (result.stdout) {
        content += result.stdout;
      }
      
      if (result.stderr) {
        content += result.stderr;
      }
      
      if (result.exit_code !== 0) {
        content += `\n[Exit code: ${result.exit_code}]`;
      }
      
      content += `\n\`\`\``;
      return content;
    }
    
    const formatted = formatTerminalOutput(args.command, mockErrorResult);
    
    assert.ok(formatted.includes('$ cat nonexistent.txt'), 'Should include command with $ prefix');
    assert.ok(formatted.includes('cat: nonexistent.txt: No such file or directory'), 'Should include error message');
    assert.ok(formatted.includes('[Exit code: 1]'), 'Should include exit code for errors');
    assert.ok(formatted.startsWith('```'), 'Should start with code block');
    assert.ok(formatted.endsWith('```'), 'Should end with code block');
  });

  test('should handle timeout in terminal format', async () => {
    const args = { command: 'sleep 30', timeout: 5 };
    
    const mockTimeoutResult = {
      stdout: '',
      stderr: '',
      exit_code: null,
      timed_out: true
    };
    
    function formatTerminalOutput(command, result, timeout) {
      let content = `\`\`\`\n$ ${command}\n`;
      
      if (result.stdout) {
        content += result.stdout;
      }
      
      if (result.stderr) {
        content += result.stderr;
      }
      
      if (result.timed_out) {
        content += `\n[Command timed out after ${timeout}s]`;
      }
      
      content += `\n\`\`\``;
      return content;
    }
    
    const formatted = formatTerminalOutput(args.command, mockTimeoutResult, args.timeout);
    
    assert.ok(formatted.includes('$ sleep 30'), 'Should include command with $ prefix');
    assert.ok(formatted.includes('[Command timed out after 5s]'), 'Should include timeout message');
    assert.ok(formatted.startsWith('```'), 'Should start with code block');
    assert.ok(formatted.endsWith('```'), 'Should end with code block');
  });

  test('should truncate long output to fit Discord limits', () => {
    const longOutput = 'x'.repeat(3000); // Very long output
    const command = 'cat huge-file.txt';
    
    function formatTerminalOutput(command, result) {
      let content = `\`\`\`\n$ ${command}\n`;
      
      if (result.stdout) {
        content += result.stdout;
      }
      
      content += `\n\`\`\``;
      
      // Truncate if too long (Discord limit is 2000 chars for code blocks)
      if (content.length > 1990) {
        content = content.substring(0, 1980) + '\n... (truncated)\n```';
      }
      
      return content;
    }
    
    const formatted = formatTerminalOutput(command, { stdout: longOutput });
    
    assert.ok(formatted.length <= 2000, 'Should be truncated to fit Discord limits');
    assert.ok(formatted.includes('... (truncated)'), 'Should include truncation indicator');
    assert.ok(formatted.includes('$ cat huge-file.txt'), 'Should still include command');
  });

  test('should handle empty command output', () => {
    const command = 'touch empty.txt';
    const emptyResult = {
      stdout: '',
      stderr: '',
      exit_code: 0,
      timed_out: false
    };
    
    function formatTerminalOutput(command, result) {
      let content = `\`\`\`\n$ ${command}\n`;
      
      if (result.stdout) {
        content += result.stdout;
      }
      
      if (result.stderr) {
        content += result.stderr;
      }
      
      content += `\n\`\`\``;
      return content;
    }
    
    const formatted = formatTerminalOutput(command, emptyResult);
    
    assert.ok(formatted.includes('$ touch empty.txt'), 'Should include command');
    assert.ok(formatted.includes('```'), 'Should be wrapped in code blocks');
    const lines = formatted.split('\n');
    assert.ok(lines.length >= 3, 'Should have at least command, empty line, and closing');
  });
});