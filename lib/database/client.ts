import { MongoClient, Db } from 'mongodb';

export interface MongoDiagnosticInfo {
  isConfigured: boolean;
  scheme?: 'mongodb' | 'mongodb+srv' | 'unknown';
  sanitizedHost?: string;
  databaseName: string;
  hasCredentials?: boolean;
  hasPotentialUnencodedAt?: boolean;
  error?: string;
}

/**
 * Safely parses the MongoDB connection URI to extract diagnostic metadata
 * WITHOUT ever logging or exposing passwords, usernames, or the full URI.
 */
export function getMongoDiagnosticInfo(): MongoDiagnosticInfo {
  const rawUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB?.trim() || 'carecircle';

  if (!rawUri || rawUri.trim() === '') {
    return {
      isConfigured: false,
      databaseName: dbName,
      error: 'MONGODB_URI environment variable is not defined.',
    };
  }

  const cleaned = rawUri.trim().replace(/^["']|["']$/g, '');
  const schemeMatch = cleaned.match(/^(mongodb(?:\+srv)?):\/\//i);
  const scheme = schemeMatch
    ? (schemeMatch[1].toLowerCase() as 'mongodb' | 'mongodb+srv')
    : 'unknown';

  if (scheme === 'unknown') {
    return {
      isConfigured: true,
      scheme: 'unknown',
      databaseName: dbName,
      error:
        "Invalid connection scheme. MONGODB_URI must start with 'mongodb://' or 'mongodb+srv://'.",
    };
  }

  // Check for multiple '@' symbols in the authority segment before path/query
  const authorityPart = cleaned.replace(/^[a-z+]+:\/\//i, '').split(/[/?#]/)[0] || '';
  const atParts = authorityPart.split('@');
  const hasPotentialUnencodedAt = atParts.length > 2;

  // The host is the segment following the last '@'
  const host = atParts[atParts.length - 1] || 'unknown';
  const hasCredentials = atParts.length > 1;

  return {
    isConfigured: true,
    scheme,
    sanitizedHost: host,
    databaseName: dbName,
    hasCredentials,
    hasPotentialUnencodedAt,
  };
}

/**
 * Sanitizes and validates the MongoDB URI from process.env.MONGODB_URI.
 * Strips accidental wrapping quotes or leading/trailing whitespace.
 */
export function getSanitizedMongoUri(): string {
  const raw = process.env.MONGODB_URI;
  if (!raw || raw.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'MONGODB_URI is not configured in production environment variables. Please check your Vercel project settings.'
      );
    }
    return 'mongodb://localhost:27017/carecircle';
  }

  return raw.trim().replace(/^["']|["']$/g, '');
}

export function getDatabaseName(): string {
  return process.env.MONGODB_DB?.trim() || 'carecircle';
}

interface GlobalMongo {
  _mongoClientPromise?: Promise<MongoClient> | null;
  _mongoClient?: MongoClient | null;
}

declare const globalThis: GlobalMongo & typeof global;

let loggedConnectionHost = false;

async function createClientPromise(): Promise<MongoClient> {
  const diag = getMongoDiagnosticInfo();

  if (diag.hasPotentialUnencodedAt) {
    console.warn(
      '[MongoDB Configuration Warning] Detected multiple "@" symbols in the MONGODB_URI authority. If your database password contains "@" or other special characters, ensure it is URL-encoded (e.g. "%40"). An unencoded "@" causes the driver to misparse the password string as the cluster hostname.'
    );
  }

  if (!loggedConnectionHost && diag.sanitizedHost) {
    console.log(
      `[MongoDB] Initializing database client connection pool (Host: ${diag.sanitizedHost}, Scheme: ${diag.scheme})`
    );
    loggedConnectionHost = true;
  }

  const uri = getSanitizedMongoUri();
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 30000,
  });

  try {
    const connectedClient = await client.connect();
    globalThis._mongoClient = connectedClient;
    return connectedClient;
  } catch (err: unknown) {
    // Crucial: Clear global promise on connection failure so subsequent requests can re-attempt connection
    globalThis._mongoClientPromise = null;
    globalThis._mongoClient = null;
    throw err;
  }
}

/**
 * Returns the cached MongoClient promise, reusing connections across serverless invocations.
 */
export function getMongoClientPromise(): Promise<MongoClient> {
  if (!globalThis._mongoClientPromise) {
    globalThis._mongoClientPromise = createClientPromise();
  }
  return globalThis._mongoClientPromise;
}

/**
 * Returns the active MongoDB Db instance.
 */
export async function getDatabase(): Promise<Db> {
  try {
    const client = await getMongoClientPromise();
    return client.db(getDatabaseName());
  } catch (error: unknown) {
    // Clear the promise so next request has a fresh opportunity to connect
    globalThis._mongoClientPromise = null;
    globalThis._mongoClient = null;
    const diag = getMongoDiagnosticInfo();
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `[MongoDB Database Error] Connection failed for target host "${diag.sanitizedHost || 'unknown'}": ${errMsg}`
    );
    throw error;
  }
}

// Default export satisfies existing imports
export default getMongoClientPromise();
