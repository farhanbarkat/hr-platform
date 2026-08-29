import { TaxSlab } from '../models/taxSlab.model.js';
import { calculateProgressiveTax, autoSeedCompanyTaxPreset } from '../services/taxCalculation.service.js';
import { COUNTRY_TAX_PRESETS, getTaxPreset, hasTaxPreset } from '../constants/taxPresets.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * 1. Create or Update Tax Slab Configuration (Manual Customization)
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

  const sortedSlabs = [...slabs].sort((a, b) => a.minIncome - b.minIncome);

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
 * 2. Get Tax Slabs for Company (with metadata if country requires manual config)
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

  const countryToCheck = (country || req.user.company?.country || 'PK').toUpperCase();
  const hasPreset = hasTaxPreset(countryToCheck);

  const responsePayload = {
    slabs,
    country: countryToCheck,
    hasBuiltInPreset: hasPreset,
    requiresManualConfig: slabs.length === 0 && !hasPreset,
    notice:
      slabs.length === 0 && !hasPreset
        ? `No built-in tax preset available for '${countryToCheck}'. Please configure tax brackets manually.`
        : null,
  };

  return res.status(200).json(
    new ApiResponse(200, responsePayload, 'Tax slab configurations retrieved successfully.')
  );
});

/**
 * 3. Get Available Country Presets / Preview Preset
 * GET /api/v1/tax-slabs/presets/:country?
 */
export const getTaxPresets = asyncHandler(async (req, res) => {
  const { country } = req.params;

  if (country) {
    const preset = getTaxPreset(country);
    if (!preset) {
      return res.status(200).json(
        new ApiResponse(
          200,
          { hasPreset: false, preset: null },
          `No built-in preset found for country code '${country.toUpperCase()}'. Manual configuration required.`
        )
      );
    }
    return res.status(200).json(
      new ApiResponse(200, { hasPreset: true, preset }, 'Country tax preset retrieved.')
    );
  }

  // Return list of all available presets
  return res.status(200).json(
    new ApiResponse(200, COUNTRY_TAX_PRESETS, 'Available tax presets retrieved.')
  );
});

/**
 * 4. Apply / Reset Tax Slab from Built-in Preset
 * POST /api/v1/tax-slabs/apply-preset
 */
export const applyTaxPreset = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { country, force } = req.body;

  if (!country) {
    throw new ApiError(400, 'Country code is required to apply tax preset.');
  }

  const result = await autoSeedCompanyTaxPreset(companyId, country, req.user._id, force === true);

  if (result.requiresManualConfig) {
    return res.status(404).json(new ApiResponse(404, result, result.message));
  }

  return res.status(200).json(new ApiResponse(200, result, result.message));
});

/**
 * 5. Simulate Tax Calculation
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