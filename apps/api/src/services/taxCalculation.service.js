import { TaxSlab } from '../models/taxSlab.model.js';
import { Company } from '../models/company.model.js';
import { getTaxPreset, hasTaxPreset } from '../constants/taxPresets.js';

/**
 * Auto-seeds or applies standard preset tax slab for a company
 * Called on company creation, country change, or manual reset request
 */
export const autoSeedCompanyTaxPreset = async (companyId, countryCode, userId = null, force = false) => {
  if (!countryCode) return { presetApplied: false, requiresManualConfig: true };

  const country = countryCode.toUpperCase();
  const preset = getTaxPreset(country);

  if (!preset) {
    return {
      presetApplied: false,
      requiresManualConfig: true,
      message: `No pre-built tax slab preset available for country '${country}'. Manual configuration required.`,
    };
  }

  // Check if active slab already exists for this company
  const existingActive = await TaxSlab.findOne({
    companyId,
    country,
    isActive: true,
  });

  if (existingActive && !force) {
    return {
      presetApplied: false,
      requiresManualConfig: false,
      message: 'Active tax slab already exists. Existing configuration preserved.',
      taxSlab: existingActive,
    };
  }

  // Deactivate any existing active slabs if forcing a fresh preset
  if (force) {
    await TaxSlab.updateMany({ companyId, country }, { isActive: false });
  }

  // Create editable TaxSlab document from preset template
  const newTaxSlab = await TaxSlab.create({
    companyId,
    country: preset.country,
    taxYear: preset.taxYear,
    frequency: preset.frequency,
    slabs: preset.slabs,
    standardExemption: preset.standardExemption || 0,
    taxFreeAllowance: preset.taxFreeAllowance || 0,
    rebatePercentage: preset.rebatePercentage || 0,
    isActive: true,
    createdBy: userId,
  });

  return {
    presetApplied: true,
    requiresManualConfig: false,
    message: `Applied default '${preset.countryName}' tax regime (${preset.taxYear}). Fully editable by HR.`,
    taxSlab: newTaxSlab,
  };
};

/**
 * Calculates progressive tax for an employee based on company tax slabs
 */
export const calculateProgressiveTax = async (companyId, monthlyTaxableIncome = 0, options = {}) => {
  if (monthlyTaxableIncome <= 0) {
    return {
      monthlyTax: 0,
      annualTax: 0,
      effectiveTaxRate: 0,
      appliedSlabs: [],
      taxableAnnualIncome: 0,
    };
  }

  let targetCountry = options.country;
  if (!targetCountry) {
    const company = await Company.findById(companyId).select('country');
    targetCountry = company?.country || 'PK';
  }
  targetCountry = targetCountry.toUpperCase();

  const currentTaxYear = options.taxYear || '2026-2027';

  // 1. Fetch Active Tax Slab configuration
  let taxConfig = await TaxSlab.findOne({
    companyId,
    country: targetCountry,
    taxYear: currentTaxYear,
    isActive: true,
  });

  // Fallback: Check for any active configuration for that country
  if (!taxConfig) {
    taxConfig = await TaxSlab.findOne({
      companyId,
      country: targetCountry,
      isActive: true,
    }).sort({ createdAt: -1 });
  }

  // Auto-seed if missing and preset exists
  if (!taxConfig && hasTaxPreset(targetCountry)) {
    const seedResult = await autoSeedCompanyTaxPreset(companyId, targetCountry, null, false);
    if (seedResult.presetApplied) {
      taxConfig = seedResult.taxSlab;
    }
  }

  if (!taxConfig || !taxConfig.slabs || taxConfig.slabs.length === 0) {
    return {
      monthlyTax: 0,
      annualTax: 0,
      effectiveTaxRate: 0,
      appliedSlabs: [],
      taxableAnnualIncome: monthlyTaxableIncome * 12,
      requiresManualConfig: true,
      note: `No tax slab configured for country '${targetCountry}'. Please configure tax slabs in Settings.`,
    };
  }

  const brackets = [...taxConfig.slabs].sort((a, b) => a.minIncome - b.minIncome);
  const isAnnualConfig = taxConfig.frequency === 'ANNUAL';
  const grossAnnual = isAnnualConfig ? monthlyTaxableIncome * 12 : monthlyTaxableIncome;

  const totalExemptions = (taxConfig.standardExemption || 0) + (taxConfig.taxFreeAllowance || 0);
  const netTaxableIncome = Math.max(0, grossAnnual - totalExemptions);

  let totalTax = 0;
  const appliedSlabs = [];

  for (const slab of brackets) {
    const min = slab.minIncome;
    const max = slab.maxIncome !== null && slab.maxIncome !== undefined ? slab.maxIncome : Infinity;
    const rate = slab.rate || 0;
    const fixedAmount = slab.fixedAmount || 0;

    if (netTaxableIncome > min) {
      const taxableInBracket = Math.min(netTaxableIncome, max) - min;
      const bracketTax = (taxableInBracket * rate) / 100;
      totalTax += bracketTax;

      if (fixedAmount > 0 && netTaxableIncome <= max) {
        totalTax += fixedAmount;
      }

      appliedSlabs.push({
        minIncome: min,
        maxIncome: max === Infinity ? 'Above' : max,
        rate: `${rate}%`,
        taxableAmount: taxableInBracket,
        taxAmount: Math.round((bracketTax + (netTaxableIncome <= max ? fixedAmount : 0)) * 100) / 100,
      });
    }
  }

  if (taxConfig.rebatePercentage > 0) {
    const rebateAmount = (totalTax * taxConfig.rebatePercentage) / 100;
    totalTax = Math.max(0, totalTax - rebateAmount);
  }

  const finalAnnualTax = Math.round(totalTax * 100) / 100;
  const finalMonthlyTax = isAnnualConfig
    ? Math.round((finalAnnualTax / 12) * 100) / 100
    : finalAnnualTax;

  const effectiveRate =
    netTaxableIncome > 0
      ? Math.round(((finalAnnualTax / (monthlyTaxableIncome * 12)) * 100) * 100) / 100
      : 0;

  return {
    monthlyTax: finalMonthlyTax,
    annualTax: finalAnnualTax,
    effectiveTaxRate: effectiveRate,
    taxableAnnualIncome: isAnnualConfig ? netTaxableIncome : netTaxableIncome * 12,
    country: targetCountry,
    taxYear: taxConfig.taxYear,
    requiresManualConfig: false,
    appliedSlabs,
  };
};