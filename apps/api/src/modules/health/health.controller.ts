import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('/healthz')
  async healthz(): Promise<{ status: 'ok' | 'degraded'; db: boolean }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: true };
    } catch {
      return { status: 'degraded', db: false };
    }
  }
}
