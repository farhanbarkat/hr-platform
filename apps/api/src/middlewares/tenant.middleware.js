import mongoose from 'mongoose';
import redis from '../db/redis.js';
import { Company } from '../models/company.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { systemConfig } from '../services/systemConfig.service.js';

/**
 * Tenant Resolution Middleware with Centralized Maintenance Gate & Redis Caching
 */
export const tenantMiddleware = asyncHandler(async (req, res, next) => {
  // Pass unauthenticated or public routes
  if (!req.user) {
    return next();
  }

  // 1. GLOBAL MAINTENANCE MODE GUARD (Super Admin always bypasses)
  if (req.user.role !== 'SUPER_ADMIN') {
    const maintenance = await systemConfig.isMaintenanceActive();

    if (maintenance.enabled) {
      throw new ApiError(503, maintenance.notice);
    }
  }

  // 2. Resolve target company ID from user context or Super-Admin impersonation header
  const resolvedCompanyId =
    req.headers['x-impersonated-company-id'] || req.user.companyId;

  if (!resolvedCompanyId) {
    throw new ApiError(403, 'Access Denied: Missing tenant context.');
  }

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(resolvedCompanyId)) {
    throw new ApiError(400, 'Invalid company context ID format.');
  }

  const cacheKey = `tenant:${resolvedCompanyId}`;

  // 3. Redis Cache Lookup for Tenant Data
  try {
    const cachedTenant = await redis.get(cacheKey);

    if (cachedTenant) {
      const parsed = JSON.parse(cachedTenant);
      req.tenant = parsed;
      req.company = parsed;
      req.companyId = new mongoose.Types.ObjectId(resolvedCompanyId);
      return next();
    }
  } catch (redisErr) {
    console.error('[TenantMiddleware] Redis cache read failed, falling back to DB:', redisErr.message);
  }

  // 4. Fallback to Database on Cache Miss
  const company = await Company.findById(resolvedCompanyId).lean();

  if (!company) {
    throw new ApiError(404, 'Invalid or deactivated company context.');
  }

  // 5. Write to Redis Cache with 1-Hour TTL (3600 seconds)
  try {
    await redis.set(cacheKey, JSON.stringify(company), 'EX', 3600);
  } catch (redisErr) {
    console.error('[TenantMiddleware] Redis cache write failed:', redisErr.message);
  }

  req.tenant = company;
  req.company = company;
  req.companyId = new mongoose.Types.ObjectId(resolvedCompanyId);

  next();
});