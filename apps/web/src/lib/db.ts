import { Pool } from 'pg';

// Singleton pool — survives across hot reloads in dev
const g = globalThis as typeof globalThis & { _boardPool?: Pool };

export function getPool(): Pool {
  if (!g._boardPool) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    g._boardPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }
  return g._boardPool;
}

// Lazy proxy so importing this module at build time doesn't throw
export const pool = new Proxy({} as Pool, {
  get(_target, prop: string) {
    return (getPool() as unknown as Record<string, unknown>)[prop];
  },
});
