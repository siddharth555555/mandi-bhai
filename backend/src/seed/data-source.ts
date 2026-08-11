import { DataSource } from 'typeorm';
import 'dotenv/config';
import { User } from '../entities/user.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { WholesalerProfile } from '../entities/wholesaler-profile.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { Mandi } from '../mandis/mandi.entity';
import { OtpRequest } from '../auth/otp-request.entity';
import { Category } from '../catalog/category.entity';
import { Product } from '../catalog/product.entity';
import { ProductAlias } from '../catalog/product-alias.entity';
import { WholesalerListing } from '../listings/wholesaler-listing.entity';

/**
 * Standalone DataSource for the seed script (run outside Nest's DI so it
 * can be invoked with a plain `ts-node` command).
 */
export const seedDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'mandibhai',
  password: process.env.DB_PASSWORD ?? 'mandibhai_dev_pw',
  database: process.env.DB_NAME ?? 'mandibhai',
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
  synchronize: false, // schema is created by the app (synchronize: true there) — seed only inserts rows
});
