import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ClockAndIdsModule } from './platform/clock-and-ids/index.js';
import { ConfigModule } from './platform/config/index.js';
import { DatabaseModule, HealthController } from './platform/database/index.js';
import { LoggingModule } from './platform/logging/index.js';
import { HttpExceptionFilter } from './shared-kernel/errors/index.js';

/**
 * Composição do processo api (HTTP + WebSocket). Os módulos de negócio entram aqui
 * conforme a ordem de sprints; é também aqui que as portas entre módulos são ligadas
 * (ex.: SessionFinishedHook de execution → implementação de gamification).
 */
@Module({
  imports: [ConfigModule.forRoot('api'), ClockAndIdsModule, LoggingModule, DatabaseModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
