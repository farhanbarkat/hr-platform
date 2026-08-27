/**
 * Helper to safely parse numbers and Mongoose Decimal128 values
 */
const safeNumber = (val) => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'object' && val.toString) {
    const parsed = Number(val.toString());
    return isNaN(parsed) ? 0 : parsed;
  }
  const parsed = Number(val);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Strategy Pattern Calculation Engine
 */
export const calculateEmployeeGrossSalary = ({
  structure,
  salaryType,
  variableInput = { unitsWorked: 0, metricValue: 0 },
}) => {
  // Extract basic pay correctly (schema uses basicPay, with baseSalary fallback)
  const base = safeNumber(structure?.basicPay ?? structure?.baseSalary);
  
  // Calculate total allowances safely handling Decimal128
  const allowancesTotal = Array.isArray(structure?.allowances)
    ? structure.allowances.reduce((acc, a) => acc + safeNumber(a?.amount), 0)
    : 0;

  // 1. Fallback / Plain Fixed Salary
  if (!salaryType || salaryType.type === 'FIXED') {
    const grossSalary = base + allowancesTotal;
    return {
      typeUsed: 'FIXED',
      grossSalary,
      breakdown: {
        basicPay: base,
        allowances: allowancesTotal,
        description: 'Standard fixed monthly structure.',
        formula: `${base} (Basic) + ${allowancesTotal} (Allowances)`,
      },
    };
  }

  // 2. Per-Unit Calculation Strategy
  if (salaryType.type === 'PER_UNIT') {
    const unitLabel = salaryType.perUnitConfig?.unitLabel || 'unit';
    const rate = safeNumber(salaryType.perUnitConfig?.ratePerUnit);
    const units = safeNumber(variableInput?.unitsWorked);
    const calculatedAmount = units * rate;
    const grossSalary = calculatedAmount + allowancesTotal;

    return {
      typeUsed: 'PER_UNIT',
      grossSalary,
      breakdown: {
        unitLabel,
        ratePerUnit: rate,
        unitsWorked: units,
        allowances: allowancesTotal,
        formula: allowancesTotal > 0 
          ? `(${units} ${unitLabel} × ${rate}) + ${allowancesTotal} (Allowances)`
          : `${units} ${unitLabel} × ${rate} per unit`,
      },
    };
  }

  // 3. Performance-Based Strategy
  if (salaryType.type === 'PERFORMANCE_BASED') {
    const basePay = safeNumber(salaryType.performanceConfig?.basePay);
    const bonusPercent = safeNumber(salaryType.performanceConfig?.bonusPercent);
    const metricSource = salaryType.performanceConfig?.metricSource || 'sales';
    const metricVal = safeNumber(variableInput?.metricValue);
    const incentiveAmount = (metricVal * bonusPercent) / 100;
    const grossSalary = basePay + incentiveAmount + allowancesTotal;

    return {
      typeUsed: 'PERFORMANCE_BASED',
      grossSalary,
      breakdown: {
        basePay,
        metricSource,
        metricValue: metricVal,
        bonusPercent,
        incentiveAmount,
        allowances: allowancesTotal,
        formula: allowancesTotal > 0
          ? `${basePay} Base + (${metricVal} ${metricSource} × ${bonusPercent}%) + ${allowancesTotal} (Allowances)`
          : `${basePay} Base + (${metricVal} ${metricSource} × ${bonusPercent}%)`,
      },
    };
  }

  // Default safe fallback
  return {
    typeUsed: 'FIXED',
    grossSalary: base + allowancesTotal,
    breakdown: { basicPay: base, allowances: allowancesTotal },
  };
};