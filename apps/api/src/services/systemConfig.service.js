import redis from '../db/redis.js';
import { PlatformSetting } from '../models/platformSetting.model.js';

class SystemConfigService {
  constructor() {
    // L1 In-Memory Cache for ultra-low latency (<0.1ms)
    this.memoryCache = new Map();
    this.CACHE_PREFIX = 'platform:config:';
    this.DEFAULT_TTL = 3600; // 1 hour in Redis
    this.MEMORY_TTL = 60 * 1000; // 60 seconds local memory invalidation
  }

  /**
   * Enterprise Dual-Layer Getter (Memory -> Redis -> MongoDB Fallback)
   * Fail-Open Architecture: Never throws fatal crash if cache layer drops.
   */
  async getSetting(key, defaultValue = null) {
    const now = Date.now();

    // 1. Check L1 Memory Cache
    if (this.memoryCache.has(key)) {
      const { value, expiry } = this.memoryCache.get(key);
      if (now < expiry) {
        return value;
      }
      this.memoryCache.delete(key);
    }

    // 2. Check L2 Redis Cache
    const redisKey = `${this.CACHE_PREFIX}${key}`;
    try {
      const cached = await redis.get(redisKey);
      if (cached !== null) {
        const parsed = JSON.parse(cached);
        // Sync to L1 Memory
        this.memoryCache.set(key, { value: parsed, expiry: now + this.MEMORY_TTL });
        return parsed;
      }
    } catch (redisErr) {
      console.warn(`[SystemConfig] Redis L2 read degraded for ${key}:`, redisErr.message);
    }

    // 3. Fallback to MongoDB (L3 Source of Truth)
    try {
      const doc = await PlatformSetting.findOne({ key }).lean();
      if (doc && doc.value !== undefined) {
        const val = doc.value;
        // Background write to Redis
        redis.set(redisKey, JSON.stringify(val), 'EX', this.DEFAULT_TTL).catch(() => {});
        this.memoryCache.set(key, { value: val, expiry: now + this.MEMORY_TTL });
        return val;
      }
    } catch (dbErr) {
      console.error(`[SystemConfig] DB fallback failed for ${key}:`, dbErr.message);
    }

    return defaultValue;
  }

  /**
   * Atomic Single Setter with Multi-Layer Cache Invalidation
   */
  async setSetting(key, value, description = '', isPublic = false) {
    // 1. Invalidate L1 immediately
    this.memoryCache.delete(key);

    // 2. Persist to MongoDB
    const doc = await PlatformSetting.findOneAndUpdate(
      { key },
      {
        key,
        value,
        ...(description && { description }),
        ...(isPublic !== undefined && { isPublic }),
      },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    // 3. Update L2 Redis Cache
    const redisKey = `${this.CACHE_PREFIX}${key}`;
    try {
      await redis.set(redisKey, JSON.stringify(value), 'EX', this.DEFAULT_TTL);
    } catch (redisErr) {
      console.warn(`[SystemConfig] Redis L2 sync failed for ${key}:`, redisErr.message);
    }

    return doc;
  }

  /**
   * Bulk Setter for Multi-Tab System Deployments
   */
  async setBulkSettings(settingsArray) {
    if (!Array.isArray(settingsArray) || settingsArray.length === 0) return;

    // 1. Invalidate L1 Memory for all keys
    settingsArray.forEach((s) => this.memoryCache.delete(s.key));

    // 2. Bulk Write to MongoDB
    const bulkOps = settingsArray.map((item) => ({
      updateOne: {
        filter: { key: item.key },
        update: {
          $set: {
            key: item.key,
            value: item.value,
            ...(item.description && { description: item.description }),
          },
        },
        upsert: true,
      },
    }));

    await PlatformSetting.bulkWrite(bulkOps);

    // 3. Redis Pipeline for atomic batch update
    try {
      const pipeline = redis.pipeline();
      settingsArray.forEach((item) => {
        pipeline.set(`${this.CACHE_PREFIX}${item.key}`, JSON.stringify(item.value), 'EX', this.DEFAULT_TTL);
      });
      await pipeline.exec();
    } catch (redisErr) {
      console.warn('[SystemConfig] Bulk cache pipeline failed:', redisErr.message);
    }
  }

  /**
   * Declarative Maintenance Mode Evaluator
   */
  async isMaintenanceActive() {
    const states = await this.getSetting('systemStates', {});
    return {
      enabled: Boolean(states.globalMaintenance),
      notice: states.maintenanceNotice || 'Platform is under scheduled maintenance. Tenant access is temporarily suspended.',
    };
  }

  /**
   * Declarative Tier Entitlement Engine (Zero if/else clutter in business logic)
   */
  async canTenantAccessFeature(tenantTier, featureKey) {
    const matrix = await this.getSetting('matrixFeatures', []);
    const normalizedTier = (tenantTier || 'STARTER').toUpperCase();

    const feature = matrix.find((f) => f.id === featureKey);
    // If not constrained in matrix, allow by default
    if (!feature) return true;

    if (normalizedTier.includes('ENTERPRISE')) {
      return Boolean(feature.enterprise);
    }
    if (normalizedTier.includes('PRO') || normalizedTier.includes('BUSINESS')) {
      return Boolean(feature.pro);
    }
    return Boolean(feature.starter);
  }
}

export const systemConfig = new SystemConfigService();