import { SetMetadata } from '@nestjs/common';

export type AppRole =
  | 'retailer'
  | 'wholesaler'
  | 'mandi_admin'
  | 'delivery_partner'
  | 'super_admin';

export const ROLES_KEY = 'roles';

/**
 * Marks a route as requiring the caller's JWT to include at least one of
 * the given profile types. Use alongside JwtAuthGuard + RolesGuard, e.g.:
 *
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('wholesaler')
 *   @Get('inventory')
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
