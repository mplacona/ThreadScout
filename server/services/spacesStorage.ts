import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { StorageProvider } from './storage.js';

export interface SpacesConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class SpacesStorage implements StorageProvider {
  private s3Client: S3Client;
  private bucket: string;

  constructor(config: SpacesConfig) {
    this.bucket = config.bucket;
    this.s3Client = new S3Client({
      endpoint: config.endpoint,
      region: 'us-east-1', // Required but ignored for Spaces
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: false,
    });
  }

  async readJSON<T>(key: string): Promise<T | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      
      const response = await this.s3Client.send(command);
      const data = await response.Body?.transformToString();
      
      if (!data) {
        return null;
      }
      
      return JSON.parse(data) as T;
    } catch (error: unknown) {
      const awsError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (awsError.name === 'NoSuchKey' || awsError.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async writeJSON<T>(key: string, data: T): Promise<void> {
    const jsonData = JSON.stringify(data, null, 2);
    
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: jsonData,
      ContentType: 'application/json',
    });

    await this.s3Client.send(command);
  }

  async list(prefix: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    });

    try {
      const response = await this.s3Client.send(command);
      
      if (!response.Contents) {
        return [];
      }

      return response.Contents
        .filter(obj => obj.Key && obj.Key.endsWith('.json'))
        .map(obj => obj.Key!)
        .sort();
    } catch (error) {
      console.error('Error listing objects from Spaces:', error);
      return [];
    }
  }
}