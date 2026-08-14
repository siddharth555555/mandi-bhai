import { Injectable, Logger } from '@nestjs/common';

export type GatewayChargeResult = {
  success: boolean;
  gatewayRef: string;
};

export interface PaymentGatewayDriver {
  charge(amount: number, orderId: string): Promise<GatewayChargeResult>;
}

/**
 * No real gateway (Razorpay/Cashfree) is wired up — same "stub now, swap
 * later" pattern as `ConsoleNotificationDriver`. Always succeeds
 * deterministically so prepaid checkout is exercisable in dev (PRD §12, U7).
 */
@Injectable()
export class StubGatewayDriver implements PaymentGatewayDriver {
  private readonly logger = new Logger('PaymentGateway');
  private callCount = 0;

  async charge(amount: number, orderId: string): Promise<GatewayChargeResult> {
    const gatewayRef = `STUB-${orderId.slice(0, 8)}-${Date.now()}-${++this.callCount}`;
    this.logger.log(
      `[STUB, no real charge] ₹${amount.toFixed(2)} for order ${orderId} -> ${gatewayRef}`,
    );
    return { success: true, gatewayRef };
  }
}
