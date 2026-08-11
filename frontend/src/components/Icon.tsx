import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * The backend stores Material *Symbols* names (snake_case, as used by the
 * original prototype). @expo/vector-icons ships Material *Icons*, which uses
 * kebab-case and doesn't carry every Symbols glyph — so we translate, and
 * substitute the handful that have no direct equivalent.
 */
const SUBSTITUTIONS: Record<string, MaterialIconName> = {
  nutrition: 'eco', // Dals & Pulses
  water_full: 'local-drink', // Dairy
  production_quantity_limits: 'error-outline',
  arrow_circle_right: 'arrow-circle-right',
  account_balance_wallet: 'account-balance-wallet',
};

export function resolveIconName(raw?: string | null): MaterialIconName {
  if (!raw) return 'category';
  if (SUBSTITUTIONS[raw]) return SUBSTITUTIONS[raw];
  return raw.replace(/_/g, '-') as MaterialIconName;
}

type Props = {
  name?: string | null;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 24, color = '#191723' }: Props) {
  return <MaterialIcons name={resolveIconName(name)} size={size} color={color} />;
}
