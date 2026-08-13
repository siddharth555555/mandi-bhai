import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UdhaarAccount } from './udhaar-account.entity';
import { UdhaarTransaction, UdhaarTransactionType } from './udhaar-transaction.entity';
import { RetailerProfile } from '../entities/retailer-profile.entity';
import { MandiAdminProfile } from '../entities/mandi-admin-profile.entity';
import { SetCreditLimitDto, RepaymentDto } from './dto/wallet.dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(UdhaarAccount)
    private readonly accounts: Repository<UdhaarAccount>,
    @InjectRepository(UdhaarTransaction)
    private readonly transactions: Repository<UdhaarTransaction>,
    @InjectRepository(RetailerProfile)
    private readonly retailers: Repository<RetailerProfile>,
    @InjectRepository(MandiAdminProfile)
    private readonly mandiAdmins: Repository<MandiAdminProfile>,
  ) {}

  private async requireRetailer(userId: string): Promise<RetailerProfile> {
    const profile = await this.retailers.findOne({ where: { userId } });
    if (!profile) throw new ForbiddenException('No retailer profile on this account');
    return profile;
  }

  /**
   * Any Mandi Admin can act here — retailers aren't mandi-scoped, so
   * there's no natural "owning" mandi for a retailer's Udhaar account, same
   * as the shared retailer-KYC queue in PLAN-products-kyc.md.
   */
  private async requireMandiAdmin(userId: string): Promise<MandiAdminProfile> {
    const profile = await this.mandiAdmins.findOne({ where: { userId } });
    if (!profile) throw new ForbiddenException('No Mandi Admin profile on this account');
    return profile;
  }

  private async getOrCreateAccount(retailerProfileId: string): Promise<UdhaarAccount> {
    let account = await this.accounts.findOne({ where: { retailerProfileId } });
    if (!account) {
      account = await this.accounts.save(
        this.accounts.create({
          retailerProfileId,
          creditLimit: '0',
          outstandingBalance: '0',
        }),
      );
    }
    return account;
  }

  async me(userId: string) {
    const retailer = await this.requireRetailer(userId);
    return this.buildView(retailer.id);
  }

  async meByRetailerId(retailerProfileId: string) {
    const retailer = await this.retailers.findOne({ where: { id: retailerProfileId } });
    if (!retailer) throw new NotFoundException('Retailer not found');
    return this.buildView(retailerProfileId);
  }

  async setCreditLimit(userId: string, retailerProfileId: string, dto: SetCreditLimitDto) {
    await this.requireMandiAdmin(userId);
    const retailer = await this.retailers.findOne({ where: { id: retailerProfileId } });
    if (!retailer) throw new NotFoundException('Retailer not found');

    const account = await this.getOrCreateAccount(retailerProfileId);
    account.creditLimit = dto.creditLimit.toFixed(2);
    await this.accounts.save(account);

    return this.buildView(retailerProfileId);
  }

  async recordRepayment(userId: string, retailerProfileId: string, dto: RepaymentDto) {
    await this.requireMandiAdmin(userId);
    const account = await this.getOrCreateAccount(retailerProfileId);

    const newBalance = Math.max(0, Number(account.outstandingBalance) - dto.amount);
    if (dto.amount > Number(account.outstandingBalance)) {
      throw new BadRequestException(
        `Repayment of ₹${dto.amount.toFixed(2)} exceeds outstanding balance of ₹${account.outstandingBalance}`,
      );
    }
    account.outstandingBalance = newBalance.toFixed(2);
    await this.accounts.save(account);

    await this.transactions.save(
      this.transactions.create({
        udhaarAccountId: account.id,
        type: UdhaarTransactionType.REPAYMENT,
        amount: dto.amount.toFixed(2),
        balanceAfter: newBalance.toFixed(2),
        note: dto.note,
      }),
    );

    return this.buildView(retailerProfileId);
  }

  private async buildView(retailerProfileId: string) {
    const account = await this.getOrCreateAccount(retailerProfileId);
    const recent = await this.transactions.find({
      where: { udhaarAccountId: account.id },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const limit = Number(account.creditLimit);
    const outstanding = Number(account.outstandingBalance);

    return {
      creditLimit: limit,
      outstandingBalance: outstanding,
      available: Math.max(0, Math.round((limit - outstanding) * 100) / 100),
      transactions: recent.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        balanceAfter: Number(t.balanceAfter),
        note: t.note ?? null,
        orderId: t.orderId ?? null,
        createdAt: t.createdAt,
      })),
    };
  }
}
