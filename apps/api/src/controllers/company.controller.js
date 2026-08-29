import { Company } from '../models/company.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { autoSeedCompanyTaxPreset } from '../services/taxCalculation.service.js';
import redis from '../db/redis.js';

/**
 * @desc    Create a new Company (Tenant)
 * @route   POST /api/v1/companies
 * @access  Super-Admin
 */
export const createCompany = asyncHandler(async (req, res) => {
  const { name, slug, country, currency, defaultTimezone, settings } = req.body;

  if (!name || !slug) {
    throw new ApiError(400, 'Company name and unique slug are required.');
  }

  // Check slug uniqueness
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

  // Auto-seed tax slab preset (TICKET-031B)
  if (company.country) {
    await autoSeedCompanyTaxPreset(company._id, company.country, req.user?._id, false);
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
  const companyId = req.companyId;

  if (!companyId) {
    throw new ApiError(403, 'Tenant context missing.');
  }

  // Redis Cached Retrieval
  const cacheKey = `tenant:${companyId}`;
  let tenantData = await redis.get(cacheKey);

  if (tenantData) {
    return res
      .status(200)
      .json(new ApiResponse(200, JSON.parse(tenantData), 'Company details fetched from cache.'));
  }

  const company = await Company.findById(companyId).lean();
  if (!company) {
    throw new ApiError(404, 'Company not found.');
  }

  // Cache for 1 Hour
  await redis.set(cacheKey, JSON.stringify(company), 'EX', 3600);

  return res
    .status(200)
    .json(new ApiResponse(200, company, 'Company details fetched from DB.'));
});

export const updateCompanySettings = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;

  if (!companyId) {
    throw new ApiError(400, 'Company ID not found in session.');
  }

  const { settings } = req.body;

  const updateFields = {};
  if (settings?.attendance) {
    for (const [key, value] of Object.entries(settings.attendance)) {
      updateFields[`settings.attendance.${key}`] = value;
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

  return res.status(200).json(
    new ApiResponse(200, company, 'Company settings updated successfully.')
  );
});