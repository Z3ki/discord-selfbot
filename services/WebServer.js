import express from 'express';
import cors from 'cors';
import { logger } from '../utils/logger.js';
import { WebsiteManager } from './WebsiteManager.js';

export class WebServer {
  constructor(port = 3001) {
    this.app = express();
    this.port = port;
    this.server = null;
    this.websiteManager = new WebsiteManager();

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.static('public'));

    // Authentication middleware for protected routes
    this.app.use('/health', (req, res, next) => {
      const adminToken = req.headers.authorization?.replace('Bearer ', '');
      if (adminToken !== process.env.ADMIN_API_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    });

    // Rate limiting middleware
    const requestCounts = new Map();
    this.app.use((req, res, next) => {
      const clientId = req.ip;
      const now = Date.now();
      const windowMs = 60000; // 1 minute window
      const maxRequests = 100; // Max 100 requests per minute

      if (!requestCounts.has(clientId)) {
        requestCounts.set(clientId, { count: 0, resetTime: now + windowMs });
      }

      const clientData = requestCounts.get(clientId);

      if (now > clientData.resetTime) {
        clientData.count = 0;
        clientData.resetTime = now + windowMs;
      }

      clientData.count++;

      if (clientData.count > maxRequests) {
        return res.status(429).json({ error: 'Too many requests' });
      }

      // Clean up old entries periodically
      if (requestCounts.size > 10000) {
        for (const [key, data] of requestCounts.entries()) {
          if (now > data.resetTime) {
            requestCounts.delete(key);
          }
        }
      }

      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug('Web request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  setupRoutes() {
    // Health check (protected)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || 'unknown',
      });
    });

    // Website serving route - /bot/websitename
    this.app.get('/bot/:websiteName', async (req, res) => {
      try {
        const { websiteName } = req.params;
        const website = await this.websiteManager.getWebsite(websiteName);

        if (!website) {
          return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Website Not Found</title></head>
            <body>
              <h1>404 - Website Not Found</h1>
              <p>The website "${websiteName}" does not exist or has expired.</p>
              <p>Websites are automatically deleted after 24 hours.</p>
            </body>
            </html>
          `);
        }

        // Serve the website files
        if (website.html) {
          res.setHeader('Content-Type', 'text/html');
          return res.send(website.html);
        } else {
          return res.status(404).send('Website content not found');
        }
      } catch (error) {
        logger.error('Error serving website', {
          websiteName: req.params.websiteName,
          error: error.message,
        });
        res.status(500).send('Internal Server Error');
      }
    });

    // API routes for website management
    this.app.post('/api/websites', async (req, res) => {
      try {
        const { name, html, description } = req.body;

        if (!name || !html) {
          return res.status(400).json({
            error: 'Missing required fields: name, html',
          });
        }

        // Validate website name
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
          return res.status(400).json({
            error:
              'Website name can only contain letters, numbers, underscores, and hyphens',
          });
        }

        const website = await this.websiteManager.createWebsite(
          name,
          html,
          description
        );
        // Import config to get base URL
        const { CONFIG } = await import('../config/config.js');
        const baseUrl = CONFIG.website.baseUrl;

        res.json({
          success: true,
          url: `${baseUrl}/bot/${name}`,
          expiresAt: website.expiresAt,
        });
      } catch (error) {
        logger.error('Error creating website', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    this.app.put('/api/websites/:websiteName', async (req, res) => {
      try {
        const { websiteName } = req.params;
        const { html, description } = req.body;

        if (!html) {
          return res.status(400).json({
            error: 'Missing required field: html',
          });
        }

        const website = await this.websiteManager.updateWebsite(
          websiteName,
          html,
          description
        );
        if (!website) {
          return res.status(404).json({ error: 'Website not found' });
        }

        // Import config to get base URL
        const { CONFIG } = await import('../config/config.js');
        const baseUrl = CONFIG.website.baseUrl;

        res.json({
          success: true,
          url: `${baseUrl}/bot/${websiteName}`,
          expiresAt: website.expiresAt,
        });
      } catch (error) {
        logger.error('Error updating website', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    this.app.delete('/api/websites/:websiteName', async (req, res) => {
      try {
        const { websiteName } = req.params;
        const success = await this.websiteManager.deleteWebsite(websiteName);

        if (!success) {
          return res.status(404).json({ error: 'Website not found' });
        }

        res.json({ success: true });
      } catch (error) {
        logger.error('Error deleting website', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/websites', async (req, res) => {
      try {
        const websites = await this.websiteManager.listWebsites();
        res.json({ websites });
      } catch (error) {
        logger.error('Error listing websites', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // Catch-all for other routes
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not Found' });
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err) => {
        if (err) {
          logger.error('Failed to start web server', { error: err.message });
          reject(err);
        } else {
          logger.info(`Web server started on port ${this.port}`);
          resolve();
        }
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Web server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Start cleanup interval for expired websites
  startCleanupInterval() {
    // Clean up expired websites every 5 minutes
    setInterval(
      async () => {
        try {
          const cleaned = await this.websiteManager.cleanupExpired();
          if (cleaned > 0) {
            logger.info(`Cleaned up ${cleaned} expired websites`);
          }
        } catch (error) {
          logger.error('Error during website cleanup', {
            error: error.message,
          });
        }
      },
      5 * 60 * 1000
    ); // 5 minutes
  }
}
