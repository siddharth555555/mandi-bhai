import { colors } from './theme';
import type { OrderStatus } from './api/client';

/** Shared status -> label/color mapping so every order list/detail screen agrees. */
export const ORDER_STATUS_STYLE: Record<
  OrderStatus,
  { label: string; bg: string; fg: string }
> = {
  placed: { label: 'Placed', bg: colors.blueSoft, fg: colors.blue },
  confirmed: { label: 'Confirmed', bg: colors.blueSoft, fg: colors.blue },
  packed: { label: 'Packed', bg: colors.warnSoft, fg: '#B9791C' },
  assigned: { label: 'Rider assigned', bg: colors.warnSoft, fg: '#B9791C' },
  picked_up: { label: 'On the way', bg: colors.warnSoft, fg: '#B9791C' },
  delivered: { label: 'Delivered', bg: colors.greenSoft, fg: colors.greenDark },
  rejected: { label: 'Rejected', bg: colors.primarySoft, fg: colors.primaryDark },
  cancelled: { label: 'Cancelled', bg: colors.sunken, fg: colors.textFaint },
  delivery_failed: { label: 'Delivery failed', bg: colors.primarySoft, fg: colors.primaryDark },
};
