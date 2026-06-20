/**
 * Prisma client singleton (PostgreSQL via the node-postgres adapter).
 *
 * Wraps a single pg.Pool in a PrismaPg adapter so the whole API shares one
 * connection pool. The instance is cached on globalThis in non-production to
 * survive dev hot-reloads (nodemon/ts-node) without leaking new pools on every
 * restart. Import the default export everywhere DB access is needed.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
