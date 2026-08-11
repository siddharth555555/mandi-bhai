import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    const dbConnected = this.dataSource.isInitialized;
    let dbLatencyMs: number | null = null;

    if (dbConnected) {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      dbLatencyMs = Date.now() - start;
    }

    return {
      status: dbConnected ? 'ok' : 'degraded',
      service: 'mandi-bhai-backend',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        latencyMs: dbLatencyMs,
      },
    };
  }
}
