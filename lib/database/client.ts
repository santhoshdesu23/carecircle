import { MongoClient, Db } from 'mongodb';

export type MongoErrorKind =
  | 'MISSING_URI'
  | 'INVALID_URI_FORMAT'
  | 'DNS_RESOLUTION_FAILURE'
  | 'AUTHENTICATION_FAILURE'
  | 'NETWORK_ACCESS_FAILURE'
  | 'CONNECTION_TIMEOUT'
  | 'INDEX_INITIALIZATION_FAILURE'
  | 'UNKNOWN_DATABASE_ERROR';

export interface MongoErrorClassification {
  kind: MongoErrorKind;
  diagnosticMessage: string;
  userSafeMessage: string;
  statusCode: number;
  sanitizedHost?: string;
}

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

/**
 * Classifies database errors into structured diagnostic categories
 * while ensuring no credentials or connection strings are leaked.
 */
export function classifyMongoError(error: unknown): MongoErrorClassification {
  const diag = getMongoDiagnosticInfo();
  const host = diag.sanitizedHost || 'unknown';
  const dbName = diag.databaseName || 'carecircle';

  if (!diag.isConfigured) {
    return {
      kind: 'MISSING_URI',
      diagnosticMessage: 'MONGODB_URI is not defined in environment variables.',
      userSafeMessage: 'Database configuration missing. Please verify server settings.',
      statusCode: 503,
      sanitizedHost: host,
    };
  }

  if (diag.scheme === 'unknown') {
    return {
      kind: 'INVALID_URI_FORMAT',
      diagnosticMessage: `Invalid connection scheme in MONGODB_URI. Expected 'mongodb://' or 'mongodb+srv://'.`,
      userSafeMessage: 'Database connection configuration error.',
      statusCode: 503,
      sanitizedHost: host,
    };
  }

  if (diag.hasPotentialUnencodedAt) {
    return {
      kind: 'INVALID_URI_FORMAT',
      diagnosticMessage: `Detected multiple '@' characters in MONGODB_URI. Special characters in password must be URL-encoded (e.g. '%40').`,
      userSafeMessage: 'Database connection string format error.',
      statusCode: 503,
      sanitizedHost: host,
    };
  }

  const err = error as Record<string, unknown>;
  const errMsg = typeof err?.message === 'string' ? err.message : String(error);
  const errCode = err?.code;
  const errName = typeof err?.name === 'string' ? err.name : '';

  // DNS Resolution Failure
  if (
    errCode === 'ENOTFOUND' ||
    errMsg.includes('querySrv ENOTFOUND') ||
    errMsg.includes('queryTxt ETIMEOUT') ||
    errMsg.includes('querySrv EREFUSED') ||
    errMsg.includes('getaddrinfo ENOTFOUND')
  ) {
    return {
      kind: 'DNS_RESOLUTION_FAILURE',
      diagnosticMessage: `DNS lookup failed for MongoDB host [${host}]: ${errMsg}. Check Atlas cluster hostname.`,
      userSafeMessage: 'Database service is temporarily unavailable. Please try again shortly.',
      statusCode: 503,
      sanitizedHost: host,
    };
  }

  // Authentication Failure
  if (
    errName === 'MongoServerError' &&
    (errCode === 18 ||
      err?.codeName === 'AuthenticationFailed' ||
      errMsg.includes('Authentication failed'))
  ) {
    return {
      kind: 'AUTHENTICATION_FAILURE',
      diagnosticMessage: `Authentication failed for database [${dbName}]. Verify username and password in MONGODB_URI.`,
      userSafeMessage: 'Database authentication failed. Please check service configuration.',
      statusCode: 503,
      sanitizedHost: host,
    };
  }

  // Network Access Failure (e.g. IP whitelist / firewall block)
  if (
    errCode === 'ECONNREFUSED' ||
    errCode === 'EHOSTUNREACH' ||
    errCode === 'ENETUNREACH' ||
    errMsg.includes('ECONNREFUSED')
  ) {
    return {
      kind: 'NETWORK_ACCESS_FAILURE',
      diagnosticMessage: `Connection refused to host [${host}]. Ensure Network Access (IP Access List) allows 0.0.0.0/0 on Atlas.`,
      userSafeMessage: 'Database service is unreachable. Please verify network access settings.',
      statusCode: 503,
      sanitizedHost: host,
    };
  }

  // Connection Timeout
  if (
    errName === 'MongoServerSelectionError' ||
    errName === 'MongoTimeoutError' ||
    errMsg.includes('Server selection timed out') ||
    errCode === 'ETIMEDOUT'
  ) {
    return {
      kind: 'CONNECTION_TIMEOUT',
      diagnosticMessage: `Connection to host [${host}] timed out: ${errMsg}.`,
      userSafeMessage: 'Database connection timed out. Please try again in a few moments.',
      statusCode: 503,
      sanitizedHost: host,
    };
  }

  // Index Initialization Failure
  if (errMsg.includes('Index creation failed') || errMsg.includes('ensureDatabaseIndexes')) {
    return {
      kind: 'INDEX_INITIALIZATION_FAILURE',
      diagnosticMessage: `Index creation failed on database [${dbName}]: ${errMsg}`,
      userSafeMessage: 'Database index initialization error.',
      statusCode: 503,
      sanitizedHost: host,
    };
  }

  return {
    kind: 'UNKNOWN_DATABASE_ERROR',
    diagnosticMessage: `Database operation error on [${host}]: ${errMsg}`,
    userSafeMessage: 'A database error occurred. Please try again later.',
    statusCode: 500,
    sanitizedHost: host,
  };
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
 * This is 100% lazy and NEVER executes at module import time.
 */
export function getMongoClientPromise(): Promise<MongoClient> {
  if (!globalThis._mongoClientPromise) {
    globalThis._mongoClientPromise = createClientPromise();
  }
  return globalThis._mongoClientPromise;
}

/**
 * Returns the active MongoDB Db instance.
 * Connection is established on-demand when first awaited at runtime.
 */
export async function getDatabase(): Promise<Db> {
  try {
    const client = await getMongoClientPromise();
    return client.db(getDatabaseName());
  } catch (error: unknown) {
    // Clear the promise so next request has a fresh opportunity to connect
    globalThis._mongoClientPromise = null;
    globalThis._mongoClient = null;
    const classified = classifyMongoError(error);
    console.error(`[MongoDB Database Error] ${classified.diagnosticMessage}`);
    throw error;
  }
}

/**
 * Lazy default export.
 * Does NOT invoke getMongoClientPromise() at module import time!
 * Satisfies any legacy promise imports without causing build-time connections.
 */
const lazyClientPromise: Promise<MongoClient> = {
  then(onfulfilled, onrejected) {
    return getMongoClientPromise().then(onfulfilled, onrejected);
  },
  catch(onrejected) {
    return getMongoClientPromise().catch(onrejected);
  },
  finally(onfinally) {
    return getMongoClientPromise().finally(onfinally);
  },
  [Symbol.toStringTag]: 'Promise',
} as Promise<MongoClient>;

export default lazyClientPromise;
