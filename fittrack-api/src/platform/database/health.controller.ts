import { Controller, Get, HttpCode, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CLOCK, type Clock } from '../clock-and-ids/index.js';
import { PrismaService } from './prisma.service.js';

type CheckStatus = 'up' | 'down';

export interface HealthReport {
  status: CheckStatus;
  checks: { database: CheckStatus };
  checkedAt: string;
}

/** GET /v1/health — público, para monitoramento. 503 quando o banco não responde. */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(@Res({ passthrough: true }) res: Response): Promise<{ data: HealthReport }> {
    const database = await this.checkDatabase();
    if (database === 'down') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      data: {
        status: database,
        checks: { database },
        checkedAt: this.clock.now().toISOString(),
      },
    };
  }

  private async checkDatabase(): Promise<CheckStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }
}
