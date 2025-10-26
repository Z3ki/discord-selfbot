import { logger } from '../../utils/logger.js';

export const dockerExecTool = {
  name: 'docker_exec',
  description: 'Execute Linux terminal commands in a Docker container. Perfect for: network diagnostics (ping, traceroute, nslookup, dig), downloading files (curl, wget), system info (ifconfig, netstat, ps, ls), and any shell command. Use this when you need to run terminal commands that aren\'t available as Discord tools. Automatically chooses appropriate timeouts: 10s for quick commands, 25s for network tests, 30s for downloads, 60s for installations. You can override with the timeout parameter (max 60s).',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The command to execute within the Docker container' },
      timeout: { type: 'number', description: 'Optional timeout in seconds (default: 10, max: 60)' }
    },
    required: ['command']
  }
};

export async function executeDockerExec(args, progressCallback = null) {
  const { command, timeout } = args;

  // Auto-detect appropriate timeout based on command
  let defaultTimeout = 10;

  const cmd = command.toLowerCase();
  if (cmd.includes('ping') && !cmd.includes('-c')) {
    defaultTimeout = 15; // Ping without count (can run longer)
  } else if (cmd.includes('ping') && cmd.includes('-c')) {
    defaultTimeout = 10; // Ping with count (quick)
  } else if (cmd.startsWith('nc') || cmd.includes('netcat') || cmd.includes('telnet') || cmd.includes('nmap')) {
    defaultTimeout = 25; // Network connection/scanning tests
  } else if (cmd.includes('curl') || cmd.includes('wget') || cmd.includes('wget2')) {
    defaultTimeout = 30; // Downloads
  } else if (cmd.includes('ssh') || cmd.includes('scp')) {
    defaultTimeout = 20; // SSH connections
  } else if (cmd.includes('apt') || cmd.includes('yum') || cmd.includes('dnf') || cmd.includes('pacman') || cmd.includes('brew')) {
    defaultTimeout = 60; // Package management
  } else if (cmd.includes('git clone') || cmd.includes('npm install') || cmd.includes('pip install') || cmd.includes('composer')) {
    defaultTimeout = 45; // Software installation
  } else if (cmd.includes('make') || cmd.includes('cmake') || cmd.includes('configure')) {
    defaultTimeout = 60; // Compilation
  }

  const finalTimeout = timeout || defaultTimeout;
  
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

    const execProcess = spawn('docker', ['exec', containerName, 'bash', '-c', command], {
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
    
    // Format the output with some color for better readability
    let formattedOutput = '```json\n';
    formattedOutput += JSON.stringify(result, null, 2);
    formattedOutput += '\n```';
    
    // Add some visual indicators
    if (exitCode === 0) {
      formattedOutput = '\n✅ **Docker command executed successfully**\n' + formattedOutput;
    } else {
      formattedOutput = '\n❌ **Docker command failed (exit code: ' + exitCode + ')**\n' + formattedOutput;
    }
    
    return formattedOutput;
    
  } catch (error) {
    logger.error('Docker execution failed', { error: error.message, command });
    
    const errorResult = {
      stdout: '',
      stderr: error.message,
      exit_code: -1
    };
    
    return '\n💥 **Docker execution error**\n```json\n' + JSON.stringify(errorResult, null, 2) + '\n```';
  }
}