import { z } from 'zod';

/**
 * Todas as variáveis de ambiente, validadas uma vez no início do processo.
 * Valor ausente ou inválido impede o processo de subir.
 */
export const envSchema = z.object({
  PROCESS_ROLE: z.enum(['api', 'worker']).default('api'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  STORAGE_ENDPOINT: z.url(),
  STORAGE_REGION: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),

  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET precisa de pelo menos 32 caracteres'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  MIN_APP_VERSION: z.string().regex(/^\d+\.\d+\.\d+$/, 'use o formato X.Y.Z'),
});

export type Env = z.infer<typeof envSchema>;
