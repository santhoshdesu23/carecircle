import { describe, it, expect, beforeEach } from 'vitest';
import {
  getMongoDiagnosticInfo,
  getSanitizedMongoUri,
  getDatabaseName,
  classifyMongoError,
} from '@/lib/database/client';

describe('MongoDB Client & URI Configuration Diagnostics', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('should correctly parse a standard Atlas SRV URI without logging credentials', () => {
    process.env.MONGODB_URI =
      'mongodb+srv://santhosh:SuperSecretPassword123!@cluster0.example.mongodb.net/carecircle?retryWrites=true&w=majority';
    process.env.MONGODB_DB = 'carecircle_prod';

    const diag = getMongoDiagnosticInfo();
    expect(diag.isConfigured).toBe(true);
    expect(diag.scheme).toBe('mongodb+srv');
    expect(diag.sanitizedHost).toBe('cluster0.example.mongodb.net');
    expect(diag.databaseName).toBe('carecircle_prod');
    expect(diag.hasCredentials).toBe(true);
    expect(diag.hasPotentialUnencodedAt).toBe(false);
  });

  it('should detect and flag unencoded "@" symbol in database password', () => {
    // Note: If user has "@" in their password like "my@password", it produces multiple "@" characters
    // which caused the exact production error: querySrv ENOTFOUND _mongodb._tcp.23Db
    process.env.MONGODB_URI =
      'mongodb+srv://santhoshdesu:my@password@cluster0.abcde.mongodb.net/carecircle';

    const diag = getMongoDiagnosticInfo();
    expect(diag.isConfigured).toBe(true);
    expect(diag.hasPotentialUnencodedAt).toBe(true);
  });

  it('should safely strip surrounding quotes accidentally added in Vercel environment variables', () => {
    process.env.MONGODB_URI =
      '"mongodb+srv://santhosh:password@cluster0.example.mongodb.net/carecircle"';

    const sanitized = getSanitizedMongoUri();
    expect(sanitized.startsWith('"')).toBe(false);
    expect(sanitized.endsWith('"')).toBe(false);

    const diag = getMongoDiagnosticInfo();
    expect(diag.sanitizedHost).toBe('cluster0.example.mongodb.net');
  });

  it('should report unconfigured state when MONGODB_URI is undefined or empty', () => {
    delete process.env.MONGODB_URI;

    const diag = getMongoDiagnosticInfo();
    expect(diag.isConfigured).toBe(false);
    expect(diag.error).toContain('MONGODB_URI environment variable is not defined');
  });

  it('should detect invalid connection scheme', () => {
    process.env.MONGODB_URI = 'http://localhost:27017/carecircle';

    const diag = getMongoDiagnosticInfo();
    expect(diag.scheme).toBe('unknown');
    expect(diag.error).toContain("MONGODB_URI must start with 'mongodb://' or 'mongodb+srv://'");
  });

  it('should default database name to carecircle when MONGODB_DB is omitted', () => {
    delete process.env.MONGODB_DB;
    expect(getDatabaseName()).toBe('carecircle');

    process.env.MONGODB_DB = 'custom_db';
    expect(getDatabaseName()).toBe('custom_db');
  });

  describe('classifyMongoError Diagnostics & Safe Error Messaging', () => {
    beforeEach(() => {
      process.env.MONGODB_URI =
        'mongodb+srv://dbuser:validpass@cluster0.example.mongodb.net/carecircle';
    });

    it('should classify DNS resolution failure (querySrv ENOTFOUND)', () => {
      const error = new Error('querySrv ENOTFOUND _mongodb._tcp.23Db');
      (error as any).code = 'ENOTFOUND';

      const res = classifyMongoError(error);
      expect(res.kind).toBe('DNS_RESOLUTION_FAILURE');
      expect(res.statusCode).toBe(503);
      expect(res.diagnosticMessage).toContain('DNS lookup failed');
      expect(res.diagnosticMessage).not.toContain('validpass');
      expect(res.userSafeMessage).toBe(
        'Database service is temporarily unavailable. Please try again shortly.'
      );
    });

    it('should classify Authentication failure', () => {
      const error = new Error('Authentication failed.');
      (error as any).name = 'MongoServerError';
      (error as any).code = 18;

      const res = classifyMongoError(error);
      expect(res.kind).toBe('AUTHENTICATION_FAILURE');
      expect(res.statusCode).toBe(503);
      expect(res.diagnosticMessage).toContain('Authentication failed');
      expect(res.userSafeMessage).toContain('Database authentication failed');
    });

    it('should classify Network Access failure (ECONNREFUSED / IP whitelist block)', () => {
      const error = new Error('connect ECONNREFUSED 192.0.2.1:27017');
      (error as any).code = 'ECONNREFUSED';

      const res = classifyMongoError(error);
      expect(res.kind).toBe('NETWORK_ACCESS_FAILURE');
      expect(res.statusCode).toBe(503);
      expect(res.diagnosticMessage).toContain('Connection refused');
    });

    it('should classify Connection Timeout', () => {
      const error = new Error('Server selection timed out after 5000 ms');
      (error as any).name = 'MongoServerSelectionError';

      const res = classifyMongoError(error);
      expect(res.kind).toBe('CONNECTION_TIMEOUT');
      expect(res.statusCode).toBe(503);
      expect(res.diagnosticMessage).toContain('timed out');
    });

    it('should classify Index Initialization failure', () => {
      const error = new Error('Index creation failed on users collection: namespace not found');

      const res = classifyMongoError(error);
      expect(res.kind).toBe('INDEX_INITIALIZATION_FAILURE');
      expect(res.statusCode).toBe(503);
      expect(res.diagnosticMessage).toContain('Index creation failed');
    });

    it('should classify Missing URI when MONGODB_URI is undefined', () => {
      delete process.env.MONGODB_URI;

      const res = classifyMongoError(new Error('Any error'));
      expect(res.kind).toBe('MISSING_URI');
      expect(res.statusCode).toBe(503);
      expect(res.diagnosticMessage).toContain('MONGODB_URI is not defined');
    });

    it('should classify Invalid URI format when unencoded "@" is present', () => {
      process.env.MONGODB_URI =
        'mongodb+srv://user:my@password@cluster0.abcde.mongodb.net/carecircle';

      const res = classifyMongoError(new Error('Connection error'));
      expect(res.kind).toBe('INVALID_URI_FORMAT');
      expect(res.statusCode).toBe(503);
      expect(res.diagnosticMessage).toContain("multiple '@' characters");
    });
  });
});
