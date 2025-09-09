import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import type { StorageProvider } from './storage.js';

export class LocalJSONStorage implements StorageProvider {
  constructor(private basePath: string) {}

  private getFilePath(key: string): string {
    return join(this.basePath, key);
  }

  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async readJSON<T>(key: string): Promise<T | null> {
    const filePath = this.getFilePath(key);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async writeJSON<T>(key: string, data: T): Promise<void> {
    const filePath = this.getFilePath(key);
    await this.ensureDirectoryExists(filePath);
    const jsonData = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonData, 'utf-8');
  }

  async list(prefix: string): Promise<string[]> {
    const prefixPath = join(this.basePath, prefix);
    try {
      const entries = await fs.readdir(prefixPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
        .map(entry => `${prefix}/${entry.name}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}