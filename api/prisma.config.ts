import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join('src', 'prisma', 'schema.prisma'),
  migrate: {
    async adapter() {
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      return new PrismaPg(pool);
    },
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
