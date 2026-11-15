import { describe, it, expect, beforeEach } from 'vitest';
import {
  getMongoDiagnosticInfo,
  getSanitizedMongoUri,
  getDatabaseName,
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
});
