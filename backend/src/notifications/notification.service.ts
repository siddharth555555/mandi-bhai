import { Injectable, Logger } from '@nestjs/common';

/**
 * A single notification-worthy event in the order/delivery lifecycle
 * (order placed, confirmed, packed, assigned, delivered, ...). Kept
 * generic rather than one method per event so adding a new lifecycle
 * moment never means touching this file.
 */
export type NotificationEvent = {
  toPhone: string;
  title: string;
  body: string;
  /** e.g. { orderId, status } — logged for debugging, not sent anywhere yet. */
  meta?: Record<string, unknown>;
};

export interface NotificationDriver {
  send(event: NotificationEvent): Promise<void>;
}

/**
 * Real SMS/push delivery (MSG91/Gupshup/Twilio for SMS, FCM for push) is
 * NOT started — same "not started" status as everything else under
 * Payments/KYC/Delivery in TODO.md. This driver just logs, exactly like
 * OtpService already stubs SMS by logging the OTP instead of sending it.
 *
 * Swapping in a real provider later is a one-file change: implement
 * NotificationDriver and point NotificationsModule at it instead of this
 * class — no call site (cart/order/delivery/wallet services) changes.
 */
@Injectable()
export class ConsoleNotificationDriver implements NotificationDriver {
  private readonly logger = new Logger('Notification');

  async send(event: NotificationEvent): Promise<void> {
    this.logger.log(
      `[STUB, not actually sent] -> +91${event.toPhone}: "${event.title}" — ${event.body}` +
        (event.meta ? ` ${JSON.stringify(event.meta)}` : ''),
    );
  }
}

@Injectable()
export class NotificationService {
  constructor(private readonly driver: ConsoleNotificationDriver) {}

  notify(event: NotificationEvent): Promise<void> {
    return this.driver.send(event);
  }
}
