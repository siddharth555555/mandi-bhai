import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mandi } from './mandi.entity';
import { MandisController } from './mandis.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Mandi])],
  controllers: [MandisController],
})
export class MandisModule {}
