import redis from '../db/redis.js';
import { Company } from '../models/company.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Tenant Resolution Middleware with Redis Caching Layer
 * Resolves company context from authenticated user or impersonation header
 */
export const tenantMiddleware = asyncHandler(async (req, res, next) => {
  // Pass unauthenticated or public routes
  if (!req.user) {
    return next();
  }

  // Resolve target company ID from user context or Super-Admin impersonation header
  const resolvedCompanyId =
    req.headers['x-impersonated-company-id'] || req.user.companyId;

  if (!resolvedCompanyId) {
    throw new ApiError(403, 'Access Denied: Missing tenant context.');
  }

  const cacheKey = `tenant:${resolvedCompanyId}`;

  // 1. Redis Cache Lookup (< 2ms response time)
  try {
    const cachedTenant = await redis.get(cacheKey);

    if (cachedTenant) {
      req.tenant = JSON.parse(cachedTenant);
      req.companyId = resolvedCompanyId;
      return next();
    }
  } catch (redisErr) {
    console.error('Redis cache read failed, falling back to DB:', redisErr.message);
  }

  // 2. Fallback to Database on Cache Miss
  const company = await Company.findById(resolvedCompanyId)
    .select('_id name currency defaultTimezone settings')
    .lean();

  if (!company) {
    throw new ApiError(404, 'Invalid or deactivated company context.');
  }

  // 3. Write to Redis Cache with 1-Hour TTL (3600 seconds)
  try {
    await redis.set(cacheKey, JSON.stringify(company), 'EX', 3600);
  } catch (redisErr) {
    console.error('Redis cache write failed:', redisErr.message);
  }

  req.tenant = company;
  req.companyId = resolvedCompanyId;

  next();
});