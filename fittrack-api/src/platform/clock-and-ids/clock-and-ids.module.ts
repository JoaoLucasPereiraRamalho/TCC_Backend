import { Global, Module } from '@nestjs/common';
import { CLOCK, SystemClock, type Clock } from './clock.js';
import { ID_GENERATOR, UuidV7Generator } from './id-generator.js';

@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    {
      provide: ID_GENERATOR,
      useFactory: (clock: Clock) => new UuidV7Generator(clock),
      inject: [CLOCK],
    },
  ],
  exports: [CLOCK, ID_GENERATOR],
})
export class ClockAndIdsModule {}
