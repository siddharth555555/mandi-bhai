import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mandi } from './mandi.entity';

@Controller('mandis')
export class MandisController {
  constructor(@InjectRepository(Mandi) private readonly mandis: Repository<Mandi>) {}

  @Get()
  findAll() {
    return this.mandis.find({ order: { name: 'ASC' } });
  }
}
