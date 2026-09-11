import { ApiError } from '../utils/ApiError.js';
import { systemConfig } from '../services/systemConfig.service.js';

/**
 * Enterprise Entitlement Gate Middleware
 * Verifies if the current tenant's subscription tier allows access to the requested module.
 * 
 * @param {string} featureKey - The unique module key from matrix (e.g. 'mod_sched_swap', 'mod_payroll_loans')
 */
export const requireEntitlement = (featureKey) => {
  return async (req, res, next) => {
    try {
      // 1. Super Admin hamesha bypass karega (Root Access)
      if (req.user?.role === 'SUPER_ADMIN') {
        return next();
      }

      // 2. Tenant Subscription Plan get karein
      // (yeh value tenantMiddleware se req.tenant ya req.company mein aati hai)
      const tenantTier =
        req.tenant?.subscriptionPlan ||
        req.tenant?.plan ||
        req.tenant?.tier ||
        'Starter';

      // 3. Centralized SystemConfig Service se live check evaluate karein
      const isAllowed = await systemConfig.canTenantAccessFeature(tenantTier, featureKey);

      // 4. Access Denied if tier matrix locks this feature
      if (!isAllowed) {
        throw new ApiError(
          403,
          `Upgrade Required: The feature [${featureKey}] is not enabled for your [${tenantTier}] subscription tier.`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};