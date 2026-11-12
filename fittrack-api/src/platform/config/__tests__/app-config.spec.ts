import { InvalidConfigError, loadConfig } from '../app-config.js';

const validEnv = {
  DATABASE_URL: 'postgresql://fittrack:fittrack@localhost:5432/fittrack',
  STORAGE_ENDPOINT: 'http://localhost:9000',
  STORAGE_REGION: 'us-east-1',
  STORAGE_BUCKET: 'fittrack-local',
  STORAGE_ACCESS_KEY: 'key',
  STORAGE_SECRET_KEY: 'secret',
  JWT_ISSUER: 'fittrack-api',
  JWT_AUDIENCE: 'fittrack-clients',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  MIN_APP_VERSION: '1.0.0',
};

describe('loadConfig', () => {
  it('aplica valores padrão e monta a configuração tipada', () => {
    const config = loadConfig(validEnv);
    expect(config.port).toBe(3000);
    expect(config.processRole).toBe('api');
    expect(config.jwt.accessTtlSeconds).toBe(900);
    expect(config.storage.bucket).toBe('fittrack-local');
  });

  it('converte números vindos como texto', () => {
    expect(loadConfig({ ...validEnv, PORT: '8080' }).port).toBe(8080);
  });

  it('recusa subir com variável ausente, citando o nome', () => {
    const { DATABASE_URL: _omitted, ...withoutDb } = validEnv;
    expect(() => loadConfig(withoutDb)).toThrow(InvalidConfigError);
    expect(() => loadConfig(withoutDb)).toThrow(/DATABASE_URL/);
  });

  it('recusa segredo JWT curto e versão mínima malformada', () => {
    expect(() => loadConfig({ ...validEnv, JWT_ACCESS_SECRET: 'curto' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
    expect(() => loadConfig({ ...validEnv, MIN_APP_VERSION: '1.0' })).toThrow(/MIN_APP_VERSION/);
  });

  it('recusa DATABASE_URL que não seja PostgreSQL', () => {
    expect(() => loadConfig({ ...validEnv, DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });
});
