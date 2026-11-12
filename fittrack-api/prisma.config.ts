import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    // `prisma generate` (postinstall) não conecta no banco, então roda mesmo sem .env.
    // migrate e seed exigem DATABASE_URL de verdade e falham ao conectar se ela faltar.
    url: process.env.DATABASE_URL ?? '',
  },
});
