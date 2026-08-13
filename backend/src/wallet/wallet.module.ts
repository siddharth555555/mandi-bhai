import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UdhaarAccount } from './udhaar-account.entity';
import { UdhaarTransaction } from './udhaar-transaction.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { AdminWalletController } from './admin-wallet.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UdhaarAccount, UdhaarTransaction, RetailerProfile, MandiAdminProfile]),
  ],
  controllers: [WalletController, AdminWalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
