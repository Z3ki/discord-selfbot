import { logger } from '../../utils/logger.js';

export const dockerExecTool = {
  name: 'docker_exec',
  description: 'Execute Linux terminal commands in a Docker container. Perfect for: network diagnostics (ping, traceroute, nslookup, dig), downloading files (curl, wget), system info (ifconfig, netstat, ps, ls), installing packages (apt, yum, pip), and any shell command. You can chain multiple commands by using && or ; in the command string. Use this when you need to run terminal commands that aren\'t available as Discord tools. YOU MUST choose an appropriate timeout based on the command: 5-10s for quick commands, 15-30s for network tests, 30-60s for downloads/installs. Always specify a timeout parameter to prevent timeouts.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The command to execute within the Docker container' },
      timeout: { type: 'number', description: 'REQUIRED: Timeout in seconds based on command type (5-10 for quick, 15-30 for network, 30-60 for downloads/installs)' }
    },
    required: ['command', 'timeout']
  }
};

export async function executeDockerExec(args, progressCallback = null) {
  const { command, timeout } = args;

  const finalTimeout = timeout || 15;
  
  if (!command) {
    return 'Error: No command provided for docker execution';
  }

  logger.info('Executing Docker command', { command });

  try {
    // Use the mcp-shell container
    const containerName = 'mcp-shell';
    
    // First check if container is running, if not start it
    const { spawn } = await import('child_process');
    
    // Check container status
    const checkProcess = spawn('docker', ['ps', '--filter', `name=${containerName}`, '--format', '{{.Status}}'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let containerStatus = '';
    checkProcess.stdout.on('data', (data) => {
      containerStatus += data.toString();
    });
    
    await new Promise((resolve, reject) => {
      checkProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to check container status: ${code}`));
        }
      });
    });
    
    // Start container if not running
    if (!containerStatus.trim()) {
      logger.info('Starting Docker container', { containerName });
      if (progressCallback) {
        progressCallback({ status: 'Starting Docker container...' });
      }

      const startProcess = spawn('docker', ['start', containerName], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      await new Promise((resolve, reject) => {
        startProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Failed to start container: ${code}`));
          }
        });
      });

      if (progressCallback) {
        progressCallback({ status: 'Docker container started' });
      }
    }
    
    // Execute the command in the container
    if (progressCallback) {
      progressCallback({ status: 'Executing command...' });
    }

    // Set environment variables for simple terminal output
    const envCommand = `export TERM=dumb && export NO_COLOR=1 && ${command}`;
    
    const execProcess = spawn('docker', ['exec', containerName, 'bash', '-c', envCommand], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    execProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      if (progressCallback) {
        progressCallback({
          status: 'Running...',
          stdout: stdout,
          stderr: stderr
        });
      }
    });

    execProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      if (progressCallback) {
        progressCallback({
          status: 'Running...',
          stdout: stdout,
          stderr: stderr
        });
      }
    });

    // Add timeout to prevent infinite commands (max 60 seconds)
    const timeoutMs = Math.min(timeout * 1000, 60000); // Convert to ms, max 60s
    let timedOut = false;
    const timeoutHandle = setTimeout(() => {
      execProcess.kill('SIGKILL');
      timedOut = true;
      if (progressCallback) {
        progressCallback({
          status: `Command timed out (${timeout}s limit)`,
          stdout: stdout,
          stderr: stderr,
          completed: true,
          exit_code: -1,
          timed_out: true
        });
      }
    }, timeoutMs);

    const exitCode = await new Promise((resolve) => {
      execProcess.on('close', (code) => {
        clearTimeout(timeoutHandle);
        resolve(code);
      });
    });

    if (progressCallback) {
      progressCallback({
        status: timedOut ? 'Timed out' : 'Completed',
        stdout: stdout,
        stderr: stderr,
        completed: true,
        exit_code: exitCode,
        timed_out: timedOut
      });
    }
    
    const result = {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exit_code: exitCode,
      timed_out: timedOut
    };
    
    logger.info('Docker command executed', { command, exitCode, stdoutLength: stdout.length, stderrLength: stderr.length });
    
    // Format the output like a real terminal
    let formattedOutput = '';
    
    if (exitCode === 0) {
      formattedOutput = '';
    } else {
      formattedOutput = 'Command failed (exit code: ' + exitCode + ')\n';
    }
    
    // Show stdout if there is any
    if (stdout.trim()) {
      formattedOutput += stdout;
    }
    
    // Show stderr if there is any
    if (stderr.trim()) {
      if (formattedOutput) formattedOutput += '\n';
      formattedOutput += stderr;
    }
    
    // Return plain text output (no code blocks, no JSON)
    return formattedOutput;
    
  } catch (error) {
    logger.error('Docker execution failed', { error: error.message, command });
    
    const errorResult = {
      stdout: '',
      stderr: error.message,
      exit_code: -1
    };
    
    return 'Docker execution error: ' + error.message;
  }
}