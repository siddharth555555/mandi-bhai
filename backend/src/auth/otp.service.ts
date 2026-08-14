import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { OtpRequest } from './otp-request.entity';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_LENGTH = 4;
const MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectRepository(OtpRequest)
    private readonly otpRepo: Repository<OtpRequest>,
  ) {}

  private generateOtp(): string {
    // Demo-friendly fixed OTP would be nicer for testing, but we generate a
    // real random one and just surface it in the response (see TODO.md —
    // SMS sending is stubbed).
    return Math.floor(Math.random() * 10 ** OTP_LENGTH)
      .toString()
      .padStart(OTP_LENGTH, '0');
  }

  /**
   * Creates a new OTP challenge for a phone number and "sends" it.
   * TODO(sms): replace the logger line with a real SMS provider call
   * (MSG91 / Gupshup / Twilio) and stop returning the OTP in the response.
   */
  async requestOtp(
    phone: string,
  ): Promise<{ devOtp: string; expiresInSeconds: number }> {
    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);

    const record = this.otpRepo.create({
      phone,
      otpHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });
    await this.otpRepo.save(record);

    // TODO(sms): send via provider instead of logging.
    this.logger.warn(
      `[STUB SMS] OTP for ${phone} is ${otp} (expires in 5 min)`,
    );

    return { devOtp: otp, expiresInSeconds: OTP_TTL_MS / 1000 };
  }

  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const record = await this.otpRepo.findOne({
      where: { phone, consumed: false },
      order: { createdAt: 'DESC' },
    });

    if (!record) return false;
    if (record.expiresAt.getTime() < Date.now()) return false;
    if (record.attempts >= MAX_ATTEMPTS) return false;

    const matches = await bcrypt.compare(otp, record.otpHash);

    record.attempts += 1;
    if (matches) {
      record.consumed = true;
    }
    await this.otpRepo.save(record);

    return matches;
  }
}
