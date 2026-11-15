import { describe, it, expect } from 'vitest';
import { POST as seedHandler } from '@/app/api/seed/route';
import { NextRequest } from 'next/server';

describe('Seed API Security', () => {
  it('should block seed requests in production when admin secret is missing', async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    const req = new NextRequest('http://localhost:3000/api/seed', {
      method: 'POST',
    });

    const res = await seedHandler(req);
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.error).toContain('disabled in production');

    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });
});
