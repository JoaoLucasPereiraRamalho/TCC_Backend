import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { SYSTEM_SETTINGS_SEED } from './system-settings.js';

// Seed idempotente: rodar de novo não duplica nada. Exercícios base, catálogo de badges e
// grupamentos entram aqui nas sprints 3 e 7.
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL não definida');

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const now = new Date(); // script de seed fica fora do código de regra; o Clock não se aplica aqui
  try {
    for (const [key, value] of Object.entries(SYSTEM_SETTINGS_SEED)) {
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value: value as never, updatedAt: now },
        update: {},
      });
    }
    console.log(`Seed: ${Object.keys(SYSTEM_SETTINGS_SEED).length} parâmetros de sistema.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
