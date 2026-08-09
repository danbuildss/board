import { Pool } from 'pg';

// Singleton pool — survives across hot reloads in dev
const globalPool = globalThis as typeof globalThis & { _boardPool?: Pool };

if (!globalPool._boardPool) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  globalPool._boardPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
  });
}

export const pool = globalPool._boardPool;
