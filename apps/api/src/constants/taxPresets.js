/**
 * Built-in Country Tax Slab Presets
 * Stored in the exact shape of TaxSlab model for seamless seeding and HR customizability.
 */
export const COUNTRY_TAX_PRESETS = {
  PK: {
    country: 'PK',
    countryName: 'Pakistan',
    taxYear: '2026-2027',
    frequency: 'ANNUAL',
    currency: 'PKR',
    description: 'Federal Board of Revenue (FBR) Salaried Individual Tax Slabs',
    standardExemption: 0,
    taxFreeAllowance: 0,
    rebatePercentage: 0,
    slabs: [
      { minIncome: 0, maxIncome: 600000, rate: 0, fixedAmount: 0 },
      { minIncome: 600000, maxIncome: 1200000, rate: 5, fixedAmount: 0 },
      { minIncome: 1200000, maxIncome: 2200000, rate: 15, fixedAmount: 0 },
      { minIncome: 2200000, maxIncome: 3200000, rate: 25, fixedAmount: 0 },
      { minIncome: 3200000, maxIncome: null, rate: 35, fixedAmount: 0 },
    ],
  },
  AE: {
    country: 'AE',
    countryName: 'United Arab Emirates',
    taxYear: '2026',
    frequency: 'ANNUAL',
    currency: 'AED',
    description: 'Zero Individual Income Tax Regime',
    standardExemption: 0,
    taxFreeAllowance: 0,
    rebatePercentage: 0,
    slabs: [{ minIncome: 0, maxIncome: null, rate: 0, fixedAmount: 0 }],
  },
  SA: {
    country: 'SA',
    countryName: 'Saudi Arabia',
    taxYear: '2026',
    frequency: 'ANNUAL',
    currency: 'SAR',
    description: 'Zero Personal Income Tax (GOSI handled separately)',
    standardExemption: 0,
    taxFreeAllowance: 0,
    rebatePercentage: 0,
    slabs: [{ minIncome: 0, maxIncome: null, rate: 0, fixedAmount: 0 }],
  },
  US: {
    country: 'US',
    countryName: 'United States',
    taxYear: '2026',
    frequency: 'ANNUAL',
    currency: 'USD',
    description: 'US Federal Standard Single Filer Brackets (Starting Template)',
    standardExemption: 14600,
    taxFreeAllowance: 0,
    rebatePercentage: 0,
    slabs: [
      { minIncome: 0, maxIncome: 11600, rate: 10, fixedAmount: 0 },
      { minIncome: 11600, maxIncome: 47150, rate: 12, fixedAmount: 0 },
      { minIncome: 47150, maxIncome: 100525, rate: 22, fixedAmount: 0 },
      { minIncome: 100525, maxIncome: 191950, rate: 24, fixedAmount: 0 },
      { minIncome: 191950, maxIncome: null, rate: 32, fixedAmount: 0 },
    ],
  },
};

/**
 * Check if a country has a pre-built preset
 */
export const hasTaxPreset = (countryCode = '') => {
  if (!countryCode) return false;
  return Boolean(COUNTRY_TAX_PRESETS[countryCode.toUpperCase()]);
};

/**
 * Retrieve preset or return null
 */
export const getTaxPreset = (countryCode = '') => {
  if (!countryCode) return null;
  return COUNTRY_TAX_PRESETS[countryCode.toUpperCase()] || null;
};