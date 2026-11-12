/**
 * Campos que nunca podem aparecer em log: senha, tokens, e-mail completo, anamnese,
 * medidas corporais e texto de mensagens. Lista única, usada pelo pino (redact).
 */
export const REDACTED_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["idempotency-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.accessToken',
  '*.refreshToken',
  '*.idToken',
  '*.token',
  '*.email',
  '*.anamnesis',
  '*.health',
  '*.weightKg',
  '*.bodyFatPercent',
  '*.waistCm',
  '*.armCm',
  '*.thighCm',
  '*.text',
];

export const REDACTION_CENSOR = '[REDACTED]';
