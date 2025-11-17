import { logger } from '../../utils/logger.js';

export const dockerExecTool = {
  name: 'system_info',
  description: 'Get basic system information safely without shell execution',
  parameters: {
    type: 'object',
    properties: {
      info_type: {
        type: 'string',
        enum: ['memory', 'disk', 'uptime', 'version'],
        description: 'Type of system information to retrieve',
      },
    },
    required: ['info_type'],
  },
};

export async function executeShell(args, progressCallback = null) {
  const { info_type } = args;

  if (!info_type) {
    return 'Error: No info_type provided';
  }

  logger.info('Retrieving system information', { info_type });

  try {
    const { execSync } = await import('child_process');
    let result = '';

    switch (info_type) {
      case 'memory':
        result =
          'Shell execution has been disabled for security reasons. Memory info unavailable.';
        break;
      case 'disk':
        result =
          'Shell execution has been disabled for security reasons. Disk info unavailable.';
        break;
      case 'uptime':
        result =
          'Shell execution has been disabled for security reasons. Uptime info unavailable.';
        break;
      case 'version':
        result =
          'Shell execution has been disabled for security reasons. Version info unavailable.';
        break;
      default:
        result =
          'Error: Invalid info_type. Supported types: memory, disk, uptime, version';
    }

    if (progressCallback) {
      progressCallback({
        status: 'Completed',
        stdout: result,
        stderr: '',
        completed: true,
        exit_code: 0,
        timed_out: false,
      });
    }

    return result;
  } catch (error) {
    logger.error('System info retrieval failed', {
      error: error.message,
      info_type,
    });
    return 'System info error: ' + error.message;
  }
}
