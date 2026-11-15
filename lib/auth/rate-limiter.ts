import { getRateLimitsCollection } from '@/lib/database/collections';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

// In-memory fallback for local offline testing when database is not connected
interface MemoryRecord {
  count: number;
  resetAt: number;
}
const memoryFallbackStore = new Map<string, MemoryRecord>();

export async function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowSeconds: number = 900 // 15 minutes default
): Promise<RateLimitResult> {
  const now = new Date();
  const resetTime = new Date(now.getTime() + windowSeconds * 1000);

  // In test environments, use memory fallback immediately for blazing-fast unit tests
  if (process.env.NODE_ENV === 'test') {
    return checkMemoryRateLimit(key, maxAttempts, windowSeconds);
  }

  try {
    const rateLimitsCol = await getRateLimitsCollection();

    // Find existing rate limit record
    const existing = await rateLimitsCol.findOne({ _id: key });

    if (!existing || existing.resetAt <= now) {
      // First attempt or expired window -> atomic set or replace
      await rateLimitsCol.updateOne(
        { _id: key },
        {
          $set: {
            count: 1,
            resetAt: resetTime,
            updatedAt: now,
          },
        },
        { upsert: true }
      );

      return {
        allowed: true,
        remaining: maxAttempts - 1,
        resetSeconds: windowSeconds,
      };
    }

    if (existing.count >= maxAttempts) {
      const resetSeconds = Math.max(
        1,
        Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000)
      );
      return {
        allowed: false,
        remaining: 0,
        resetSeconds,
      };
    }

    // Atomically increment within active window
    const updateResult = await rateLimitsCol.findOneAndUpdate(
      { _id: key, count: { $lt: maxAttempts } },
      {
        $inc: { count: 1 },
        $set: { updatedAt: now },
      },
      { returnDocument: 'after' }
    );

    const updatedCount = updateResult?.count ?? existing.count + 1;
    const resetSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000)
    );

    if (updatedCount > maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetSeconds,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, maxAttempts - updatedCount),
      resetSeconds,
    };
  } catch {
    return checkMemoryRateLimit(key, maxAttempts, windowSeconds);
  }
}

function checkMemoryRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): RateLimitResult {
  const nowMs = Date.now();
  const existing = memoryFallbackStore.get(key);

  if (!existing || existing.resetAt <= nowMs) {
    memoryFallbackStore.set(key, {
      count: 1,
      resetAt: nowMs + windowSeconds * 1000,
    });
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetSeconds: windowSeconds,
    };
  }

  if (existing.count >= maxAttempts) {
    const resetSeconds = Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetSeconds,
    };
  }

  existing.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000));
  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - existing.count),
    resetSeconds,
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  memoryFallbackStore.delete(key);
  if (process.env.NODE_ENV !== 'test') {
    try {
      const rateLimitsCol = await getRateLimitsCollection();
      await rateLimitsCol.deleteOne({ _id: key });
    } catch (_err) {
      // Expected: Ignore if db unavailable during reset
    }
  }
}
