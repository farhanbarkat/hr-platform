import mongoose from 'mongoose';
import { Company } from '../models/company.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { autoSeedCompanyTaxPreset } from '../services/taxCalculation.service.js';
import redis from '../db/redis.js';

/**
 * @desc    Create a new Company (Tenant)
 * @route   POST /api/v1/companies
 * @access  Super-Admin / Admin
 */
export const createCompany = asyncHandler(async (req, res) => {
  const { name, slug, country, currency, defaultTimezone, settings } = req.body;

  if (!name || !slug) {
    throw new ApiError(400, 'Company name and unique slug are required.');
  }

  const existingCompany = await Company.findOne({ slug: slug.toLowerCase() });
  if (existingCompany) {
    throw new ApiError(409, 'Company slug already exists.');
  }

  const companyCountry = country ? country.toUpperCase() : 'PK';

  const company = await Company.create({
    name,
    slug: slug.toLowerCase(),
    country: companyCountry,
    currency: currency || 'PKR',
    defaultTimezone: defaultTimezone || 'Asia/Karachi',
    settings: settings || {},
  });

  if (company.country) {
    try {
      await autoSeedCompanyTaxPreset(company._id, company.country, req.user?._id, false);
    } catch (taxErr) {
      console.error('[Tax AutoSeed Warning]:', taxErr.message);
    }
  }

  return res
    .status(201)
    .json(new ApiResponse(201, company, 'Company registered successfully.'));
});

/**
 * @desc    Get Current Tenant Information
 * @route   GET /api/v1/companies/me
 * @access  Authenticated Users
 */
export const getCurrentCompany = asyncHandler(async (req, res) => {
  // Safe Company ID fallback extraction
  const rawId = req.companyId || req.user?.companyId || req.user?.company?._id || req.user?.company;

  if (!rawId) {
    throw new ApiError(403, 'Tenant context missing in current session.');
  }

  const companyId = String(rawId);
  const cacheKey = `tenant:${companyId}`;

  // Check Redis Cache
  try {
    const tenantData = await redis.get(cacheKey);
    if (tenantData) {
      return res
        .status(200)
        .json(new ApiResponse(200, JSON.parse(tenantData), 'Company details fetched from cache.'));
    }
  } catch (redisErr) {
    console.warn('[Redis Cache Error]:', redisErr.message);
  }

  const company = await Company.findById(companyId).lean();
  if (!company) {
    throw new ApiError(404, 'Company record not found.');
  }

  // Cache for 1 Hour safely
  try {
    await redis.set(cacheKey, JSON.stringify(company), 'EX', 3600);
  } catch (redisSetErr) {
    console.warn('[Redis Set Error]:', redisSetErr.message);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, company, 'Company details fetched from DB.'));
});

/**
 * @desc    Update Company Settings
 * @route   PUT /api/v1/companies/settings
 * @access  Admin
 */
export const updateCompanySettings = asyncHandler(async (req, res) => {
  const rawId = req.companyId || req.user?.companyId || req.user?.company?._id || req.user?.company;

  if (!rawId) {
    throw new ApiError(400, 'Company ID not found in session context.');
  }

  const companyId = String(rawId);
  const { settings, name, currency, defaultTimezone } = req.body;

  const updateFields = {};

  if (name) updateFields.name = name;
  if (currency) updateFields.currency = currency;
  if (defaultTimezone) updateFields.defaultTimezone = defaultTimezone;

  // Support comprehensive settings payload without wiping existing keys
  if (settings && typeof settings === 'object') {
    for (const [sectionKey, sectionVal] of Object.entries(settings)) {
      if (typeof sectionVal === 'object' && sectionVal !== null) {
        for (const [subKey, subVal] of Object.entries(sectionVal)) {
          updateFields[`settings.${sectionKey}.${subKey}`] = subVal;
        }
      } else {
        updateFields[`settings.${sectionKey}`] = sectionVal;
      }
    }
  }

  const company = await Company.findByIdAndUpdate(
    companyId,
    { $set: updateFields },
    { new: true, runValidators: true }
  );

  if (!company) {
    throw new ApiError(404, 'Company not found.');
  }

  // FIX 2: Invalidate stale Redis cache on mutation
  try {
    await redis.del(`tenant:${companyId}`);
  } catch (cacheDelErr) {
    console.warn('[Redis Del Error]:', cacheDelErr.message);
  }

  return res.status(200).json(
    new ApiResponse(200, company, 'Company settings updated successfully.')
  );
});

