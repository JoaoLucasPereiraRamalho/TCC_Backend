// Variáveis de ambiente dos testes, aplicadas antes de qualquer import (vitest setupFiles).
// Valores reais nunca entram aqui.
Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  DATABASE_URL: 'postgresql://fittrack:fittrack@localhost:5432/fittrack_test',
  STORAGE_ENDPOINT: 'http://localhost:9000',
  STORAGE_REGION: 'us-east-1',
  STORAGE_BUCKET: 'fittrack-test',
  STORAGE_ACCESS_KEY: 'test-key',
  STORAGE_SECRET_KEY: 'test-secret',
  JWT_ISSUER: 'fittrack-api',
  JWT_AUDIENCE: 'fittrack-clients',
  JWT_ACCESS_SECRET: 'test-secret-with-at-least-32-characters',
  MIN_APP_VERSION: '1.0.0',
});
