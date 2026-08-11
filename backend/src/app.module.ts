import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { MandisModule } from './mandis/mandis.module';
import { CatalogModule } from './catalog/catalog.module';
import { ListingsModule } from './listings/listings.module';
import { User } from './entities/user.entity';
import { RetailerProfile } from './entities/retailer-profile.entity';
import { WholesalerProfile } from './entities/wholesaler-profile.entity';
import { MandiAdminProfile } from './entities/mandi-admin-profile.entity';
import { Mandi } from './mandis/mandi.entity';
import { OtpRequest } from './auth/otp-request.entity';
import { Category } from './catalog/category.entity';
import { Product } from './catalog/product.entity';
import { ProductAlias } from './catalog/product-alias.entity';
import { WholesalerListing } from './listings/wholesaler-listing.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'mandibhai'),
        password: config.get<string>('DB_PASSWORD', 'mandibhai_dev_pw'),
        database: config.get<string>('DB_NAME', 'mandibhai'),
        entities: [
          User,
          RetailerProfile,
          WholesalerProfile,
          MandiAdminProfile,
          Mandi,
          OtpRequest,
          Category,
          Product,
          ProductAlias,
          WholesalerListing,
        ],
        // Dev-only convenience: auto-creates/updates tables from entities.
        // Switch to TypeORM migrations before this touches real data (TODO.md).
        synchronize: true,
      }),
    }),
    HealthModule,
    AuthModule,
    MandisModule,
    CatalogModule,
    ListingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
