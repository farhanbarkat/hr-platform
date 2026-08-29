import { TaxSlab } from '../models/taxSlab.model.js';
import { calculateProgressiveTax } from '../services/taxCalculation.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * 1. Create or Update Tax Slab Configuration
 * POST /api/v1/tax-slabs
 */
export const upsertTaxSlab = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const {
    country,
    taxYear,
    frequency,
    slabs,
    standardExemption,
    taxFreeAllowance,
    rebatePercentage,
    isActive,
  } = req.body;

  if (!country || !taxYear || !Array.isArray(slabs) || slabs.length === 0) {
    throw new ApiError(400, 'Country, taxYear, and at least one slab bracket are required.');
  }

  // Validate bracket boundaries
  const sortedSlabs = [...slabs].sort((a, b) => a.minIncome - b.minIncome);
  for (let i = 0; i < sortedSlabs.length; i++) {
    const current = sortedSlabs[i];
    if (current.minIncome < 0 || current.rate < 0 || current.rate > 100) {
      throw new ApiError(400, `Invalid bracket values at index ${i}.`);
    }
  }

  // Deactivate existing active config if creating a new active one
  if (isActive !== false) {
    await TaxSlab.updateMany(
      { companyId, country: country.toUpperCase(), taxYear },
      { isActive: false }
    );
  }

  const taxSlab = await TaxSlab.create({
    companyId,
    country: country.toUpperCase(),
    taxYear,
    frequency: frequency || 'ANNUAL',
    slabs: sortedSlabs,
    standardExemption: standardExemption || 0,
    taxFreeAllowance: taxFreeAllowance || 0,
    rebatePercentage: rebatePercentage || 0,
    isActive: isActive !== undefined ? isActive : true,
    createdBy: req.user._id,
  });

  return res.status(201).json(
    new ApiResponse(201, taxSlab, 'Tax slab configuration saved successfully.')
  );
});

/**
 * 2. Get Active Tax Slab Configurations for Company
 * GET /api/v1/tax-slabs
 */
export const getTaxSlabs = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { country, taxYear, all } = req.query;

  const query = { companyId };
  if (country) query.country = country.toUpperCase();
  if (taxYear) query.taxYear = taxYear;
  if (all !== 'true') query.isActive = true;

  const slabs = await TaxSlab.find(query).sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, slabs, 'Tax slab configurations retrieved successfully.')
  );
});

/**
 * 3. Simulate / Preview Tax Calculation for an Income Amount
 * POST /api/v1/tax-slabs/simulate
 */
export const simulateTaxCalculation = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { monthlyGross, country, taxYear } = req.body;

  if (monthlyGross === undefined || monthlyGross === null || monthlyGross < 0) {
    throw new ApiError(400, 'Valid monthlyGross income amount is required.');
  }

  const calculation = await calculateProgressiveTax(companyId, Number(monthlyGross), {
    country,
    taxYear,
  });

  return res.status(200).json(
    new ApiResponse(200, calculation, 'Tax simulation calculated successfully.')
  );
});