import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Short-lived OTP challenges. SMS delivery is stubbed (see TODO.md) — the
 * OTP is generated and hashed here, but the "send" step just logs it and
 * returns it in the API response for local dev.
 */
@Entity('otp_requests')
export class OtpRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  phone: string;

  @Column()
  otpHash: string;

  @Column()
  expiresAt: Date;

  @Column({ default: 0 })
  attempts: number;

  @Column({ default: false })
  consumed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
