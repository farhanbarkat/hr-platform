import { TaxSlab } from '../models/taxSlab.model.js';
import { Company } from '../models/company.model.js';

/**
 * Calculates progressive tax for an employee based on company tax slabs
 * 
 * @param {ObjectId} companyId - Tenant Company ID
 * @param {Number} monthlyTaxableIncome - Employee taxable monthly gross
 * @param {Object} options - Optional overrides (country, taxYear)
 * @returns {Object} Tax breakdown with monthlyTax, annualTax, and applicable slabs
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

  // Determine Country from options or Company settings
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

  // Fallback: Check if company has any active tax configuration for that country
  if (!taxConfig) {
    taxConfig = await TaxSlab.findOne({
      companyId,
      country: targetCountry,
      isActive: true,
    }).sort({ createdAt: -1 });
  }

  // If no tax configuration found for this tenant, default to 0 tax
  if (!taxConfig || !taxConfig.slabs || taxConfig.slabs.length === 0) {
    return {
      monthlyTax: 0,
      annualTax: 0,
      effectiveTaxRate: 0,
      appliedSlabs: [],
      taxableAnnualIncome: monthlyTaxableIncome * 12,
      note: 'No active tax slab configured. Tax defaulted to 0.',
    };
  }

  // Sort brackets by minIncome ascending
  const brackets = [...taxConfig.slabs].sort((a, b) => a.minIncome - b.minIncome);

  // Convert monthly to annual income for standard calculation
  const isAnnualConfig = taxConfig.frequency === 'ANNUAL';
  const grossAnnual = isAnnualConfig ? monthlyTaxableIncome * 12 : monthlyTaxableIncome;

  // 2. Apply Standard Deductions & Exemptions
  const totalExemptions = (taxConfig.standardExemption || 0) + (taxConfig.taxFreeAllowance || 0);
  const netTaxableIncome = Math.max(0, grossAnnual - totalExemptions);

  let totalTax = 0;
  const appliedSlabs = [];

  // 3. Progressive Bracket Execution
  for (const slab of brackets) {
    const min = slab.minIncome;
    const max = slab.maxIncome !== null && slab.maxIncome !== undefined ? slab.maxIncome : Infinity;
    const rate = slab.rate || 0;
    const fixedAmount = slab.fixedAmount || 0;

    if (netTaxableIncome > min) {
      // Calculate portion of income that falls in this bracket
      const taxableInBracket = Math.min(netTaxableIncome, max) - min;
      const bracketTax = (taxableInBracket * rate) / 100;

      totalTax += bracketTax;

      // Add fixed amount only if this is the active bracket tier
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

  // 4. Apply Tax Rebate (if configured)
  if (taxConfig.rebatePercentage > 0) {
    const rebateAmount = (totalTax * taxConfig.rebatePercentage) / 100;
    totalTax = Math.max(0, totalTax - rebateAmount);
  }

  // Round results to 2 decimal places
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
    appliedSlabs,
  };
};