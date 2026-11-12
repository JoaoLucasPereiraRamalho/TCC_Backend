import { envSchema, type Env } from './env.schema.js';

/** Configuração tipada que os módulos recebem por injeção. Nenhum módulo lê process.env. */
export interface AppConfig {
  processRole: Env['PROCESS_ROLE'];
  nodeEnv: Env['NODE_ENV'];
  port: number;
  logLevel: Env['LOG_LEVEL'];
  databaseUrl: string;
  storage: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
  };
  jwt: {
    issuer: string;
    audience: string;
    accessSecret: string;
    accessTtlSeconds: number;
  };
  minAppVersion: string;
}

export const APP_CONFIG = Symbol('APP_CONFIG');

export class InvalidConfigError extends Error {
  constructor(issues: string[]) {
    super(`Configuração inválida:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'InvalidConfigError';
  }
}

export function loadConfig(source: Record<string, string | undefined>): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new InvalidConfigError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`),
    );
  }
  const env = parsed.data;
  return {
    processRole: env.PROCESS_ROLE,
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    storage: {
      endpoint: env.STORAGE_ENDPOINT,
      region: env.STORAGE_REGION,
      bucket: env.STORAGE_BUCKET,
      accessKey: env.STORAGE_ACCESS_KEY,
      secretKey: env.STORAGE_SECRET_KEY,
    },
    jwt: {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTtlSeconds: env.JWT_ACCESS_TTL_SECONDS,
    },
    minAppVersion: env.MIN_APP_VERSION,
  };
}
