import { Module } from '@nestjs/common';
import { ClockAndIdsModule } from './platform/clock-and-ids/index.js';
import { ConfigModule } from './platform/config/index.js';
import { DatabaseModule } from './platform/database/index.js';
import { LoggingModule } from './platform/logging/index.js';

/** Composição do processo worker: só manipuladores de jobs e o que eles precisam. */
@Module({
  imports: [ConfigModule.forRoot('worker'), ClockAndIdsModule, LoggingModule, DatabaseModule],
})
export class WorkerModule {}
