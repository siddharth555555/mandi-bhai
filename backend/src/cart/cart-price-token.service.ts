import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

export type PricedCartLine = {
  productId: string;
  quantity: number;
  snapshotPrice: number;
  snapshotMoq: number;
};

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Proves, without a database table, that a retailer explicitly saw and
 * accepted an exact set of cart lines (PRD §9.2). `POST /cart/validate`
 * signs a hash of the just-synced snapshot; `POST /checkout` re-derives the
 * same hash from the cart's current state and verifies the signature,
 * the expiry, and that the hash matches — any drift in price, quantity, or
 * MOQ between the two calls produces a different hash and fails verification
 * (PRD E3).
 */
@Injectable()
export class CartPriceTokenService {
  constructor(private readonly config: ConfigService) {}

  private secret(): string {
    return this.config.get<string>('JWT_SECRET', 'dev-only-secret-change-me');
  }

  hashLines(cartId: string, lines: PricedCartLine[]): string {
    const canonical = [...lines]
      .sort((a, b) => a.productId.localeCompare(b.productId))
      .map((l) => `${l.productId}:${l.quantity}:${l.snapshotPrice}:${l.snapshotMoq}`)
      .join('|');
    return createHash('sha256').update(`${cartId}::${canonical}`).digest('hex');
  }

  sign(hash: string, ttlMs = DEFAULT_TTL_MS): string {
    const expiresAt = Date.now() + ttlMs;
    const payload = `${hash}.${expiresAt}`;
    const signature = createHmac('sha256', this.secret()).update(payload).digest('hex');
    return Buffer.from(`${payload}.${signature}`).toString('base64url');
  }

  verify(token: string, expectedHash: string): boolean {
    let decoded: string;
    try {
      decoded = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      return false;
    }
    const parts = decoded.split('.');
    if (parts.length !== 3) return false;
    const [hash, expiresAtStr, signature] = parts;

    const expectedSignature = createHmac('sha256', this.secret())
      .update(`${hash}.${expiresAtStr}`)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return false;
    }
    if (hash !== expectedHash) return false;

    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

    return true;
  }
}
