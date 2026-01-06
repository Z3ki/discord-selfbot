import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';

export class WebsiteManager {
  constructor() {
    this.websitesDir = path.join(process.cwd(), 'websites');
    this.metadataFile = path.join(this.websitesDir, 'metadata.json');
    this.ensureDirectories();
    this.loadMetadata();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.websitesDir)) {
      fs.mkdirSync(this.websitesDir, { recursive: true });
    }
  }

  loadMetadata() {
    try {
      if (fs.existsSync(this.metadataFile)) {
        this.metadata = fs.readJsonSync(this.metadataFile);
      } else {
        this.metadata = {};
      }
    } catch (error) {
      logger.error('Error loading website metadata', { error: error.message });
      this.metadata = {};
    }
  }

  saveMetadata() {
    try {
      fs.writeJsonSync(this.metadataFile, this.metadata, { spaces: 2 });
    } catch (error) {
      logger.error('Error saving website metadata', { error: error.message });
    }
  }

  async createWebsite(name, html, description = '') {
    const websiteId = name.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const websitePath = path.join(this.websitesDir, `${websiteId}.html`);

    try {
      // Write HTML file
      await fs.writeFile(websitePath, html);

      // Update metadata
      this.metadata[websiteId] = {
        name: websiteId,
        description,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        filePath: websitePath,
      };

      this.saveMetadata();

      logger.info('Website created', { websiteId, description });
      return this.metadata[websiteId];
    } catch (error) {
      logger.error('Error creating website', {
        websiteId,
        error: error.message,
      });
      throw error;
    }
  }

  async getWebsite(name) {
    const websiteId = name.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    let website = this.metadata[websiteId];

    // If not found in cache, reload metadata from disk (in case it was created by another process)
    if (!website) {
      this.loadMetadata();
      website = this.metadata[websiteId];
    }

    if (!website) {
      return null;
    }

    // Check if expired
    if (new Date() > new Date(website.expiresAt)) {
      await this.deleteWebsite(websiteId);
      return null;
    }

    try {
      const html = await fs.readFile(website.filePath, 'utf8');
      return { ...website, html };
    } catch (error) {
      logger.error('Error reading website', {
        websiteId,
        error: error.message,
      });
      return null;
    }
  }

  async updateWebsite(name, html, description = '') {
    const websiteId = name.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const website = this.metadata[websiteId];

    if (!website) {
      throw new Error('Website not found');
    }

    try {
      // Update HTML file
      await fs.writeFile(website.filePath, html);

      // Update metadata
      website.description = description;
      website.updatedAt = new Date().toISOString();

      this.saveMetadata();

      logger.info('Website updated', { websiteId });
      return website;
    } catch (error) {
      logger.error('Error updating website', {
        websiteId,
        error: error.message,
      });
      throw error;
    }
  }

  async deleteWebsite(name) {
    const websiteId = name.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const website = this.metadata[websiteId];

    if (!website) {
      return false;
    }

    try {
      // Delete file
      if (fs.existsSync(website.filePath)) {
        await fs.unlink(website.filePath);
      }

      // Remove from metadata
      delete this.metadata[websiteId];
      this.saveMetadata();

      logger.info('Website deleted', { websiteId });
      return true;
    } catch (error) {
      logger.error('Error deleting website', {
        websiteId,
        error: error.message,
      });
      throw error;
    }
  }

  async listWebsites() {
    const websites = Object.values(this.metadata).filter((website) => {
      return new Date() <= new Date(website.expiresAt);
    });

    // Import config to get base URL
    const { CONFIG } = await import('../config/config.js');
    const baseUrl = CONFIG.website.baseUrl;

    return websites.map((website) => ({
      name: website.name,
      description: website.description,
      createdAt: website.createdAt,
      expiresAt: website.expiresAt,
      url: `${baseUrl.replace(/\/$/, '')}/bot/${website.name}`,
    }));
  }

  async cleanupExpired() {
    const now = new Date();
    let cleaned = 0;

    for (const [websiteId, website] of Object.entries(this.metadata)) {
      if (now > new Date(website.expiresAt)) {
        try {
          if (fs.existsSync(website.filePath)) {
            await fs.unlink(website.filePath);
          }
          delete this.metadata[websiteId];
          cleaned++;
        } catch (error) {
          logger.error('Error cleaning up expired website', {
            websiteId,
            error: error.message,
          });
        }
      }
    }

    if (cleaned > 0) {
      this.saveMetadata();
    }

    return cleaned;
  }
}
