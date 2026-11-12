import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ID_GENERATOR, type IdGenerator } from '../clock-and-ids/index.js';
import { APP_CONFIG, type AppConfig } from '../config/index.js';
import { REDACTED_PATHS, REDACTION_CENSOR } from './redaction.js';
import { resolveRequestId } from './request-id.js';

/** Logs estruturados em JSON (pino) com requestId, userId e módulo. */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG, ID_GENERATOR],
      useFactory: (config: AppConfig, ids: IdGenerator) => ({
        pinoHttp: {
          level: config.logLevel,
          base: { process: config.processRole },
          redact: { paths: REDACTED_PATHS, censor: REDACTION_CENSOR },
          genReqId: (req, res) => resolveRequestId(req, res, ids),
          customProps: (req) => ({
            requestId: req.id,
            userId: (req as { user?: { id?: string } }).user?.id,
          }),
          autoLogging: { ignore: (req) => req.url === '/v1/health' },
          transport:
            config.nodeEnv === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
