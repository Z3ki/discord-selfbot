import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TranscriptionService {
  constructor() {
    this.pythonProcess = null;
    this.isReady = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  async start() {
    if (this.pythonProcess) {
      logger.info('Transcription service already running');
      return;
    }

    logger.info('Starting persistent transcription service...');

    return new Promise((resolve, reject) => {
      try {
        // Start the Python service
        this.pythonProcess = spawn(
          '/root/whisper_venv/bin/python3',
          [path.join(__dirname, '../transcription_service.py')],
          {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PYTHONUNBUFFERED: '1' },
          }
        );

        // Handle stdout (responses from Python)
        this.pythonProcess.stdout.on('data', (data) => {
          const lines = data
            .toString()
            .split('\n')
            .filter((line) => line.trim());
          for (const line of lines) {
            try {
              const response = JSON.parse(line);
              this.handleResponse(response);
            } catch (e) {
              logger.warn(`Failed to parse transcription response: ${line}`);
            }
          }
        });

        // Handle stderr (logs from Python)
        this.pythonProcess.stderr.on('data', (data) => {
          const message = data.toString().trim();
          logger.debug(`Transcription service: ${message}`);

          // Check if service is ready
          if (message.includes('Transcription Service ready')) {
            this.isReady = true;
            clearTimeout(timeout);
            resolve();
          }
        });

        // Handle process exit
        this.pythonProcess.on('exit', (code, signal) => {
          logger.error(
            `Transcription service exited with code ${code}, signal ${signal}`
          );
          this.isReady = false;
          this.pythonProcess = null;

          // Reject any pending requests
          for (const [, { reject: rejectPromise }] of this.pendingRequests) {
            rejectPromise(new Error('Transcription service crashed'));
          }
          this.pendingRequests.clear();
        });

        // Wait for ready signal or timeout
        const timeout = setTimeout(() => {
          reject(new Error('Transcription service startup timeout'));
        }, 60000); // 60 second timeout
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop() {
    if (this.pythonProcess) {
      logger.info('Stopping transcription service...');
      this.pythonProcess.kill('SIGTERM');

      // Wait for process to exit
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.pythonProcess.kill('SIGKILL');
          resolve();
        }, 5000);

        this.pythonProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.pythonProcess = null;
      this.isReady = false;
      logger.info('Transcription service stopped');
    }
  }

  async transcribe(audioPath) {
    if (!this.isReady) {
      throw new Error('Transcription service not ready');
    }

    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;
      const request = {
        action: 'transcribe',
        audio_path: audioPath,
      };

      this.pendingRequests.set(requestId, { resolve, reject, request });

      // Send request to Python process
      try {
        this.pythonProcess.stdin.write(JSON.stringify(request) + '\n');
      } catch (e) {
        this.pendingRequests.delete(requestId);
        reject(e);
      }

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Transcription timeout'));
        }
      }, 300000);
    });
  }

  async getStatus() {
    if (!this.pythonProcess) {
      throw new Error('Transcription service not running');
    }

    return new Promise((resolve, reject) => {
      const requestId = ++this.requestId;
      const request = { action: 'status' };

      this.pendingRequests.set(requestId, { resolve, reject, request });

      try {
        this.pythonProcess.stdin.write(JSON.stringify(request) + '\n');
      } catch (e) {
        this.pendingRequests.delete(requestId);
        reject(e);
      }

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Status request timeout'));
        }
      }, 10000);
    });
  }

  handleResponse(response) {
    // Find the matching pending request
    // Since we don't have request IDs in the response, we'll resolve the oldest pending request
    // This assumes responses come back in order
    if (this.pendingRequests.size > 0) {
      const [requestId, { resolve, reject }] = this.pendingRequests
        .entries()
        .next().value;
      this.pendingRequests.delete(requestId);

      if (response.success) {
        resolve(response);
      } else {
        reject(new Error(response.error || 'Transcription failed'));
      }
    } else {
      logger.warn('Received transcription response but no pending requests');
    }
  }

  isRunning() {
    return this.pythonProcess && !this.pythonProcess.killed;
  }
}

// Singleton instance
export const transcriptionService = new TranscriptionService();
