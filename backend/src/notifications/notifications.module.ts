import { Module } from '@nestjs/common';
import {
  ConsoleNotificationDriver,
  NotificationService,
} from './notification.service';

@Module({
  providers: [ConsoleNotificationDriver, NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
