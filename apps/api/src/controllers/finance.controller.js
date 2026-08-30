import { OperationalExpense } from '../models/operationalExpense.model.js';
import { CompanyIncome } from '../models/companyIncome.model.js';
import { Company } from '../models/company.model.js';
import { getCompanyFinancialMetrics } from '../services/financeAggregation.service.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * 1. Get Financial Dashboard Data
 * GET /api/v1/finance/dashboard
 */
export const getFinanceDashboard = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { year, month, monthsCount } = req.query;

  const data = await getCompanyFinancialMetrics(companyId, {
    year,
    month,
    monthsCount: monthsCount ? parseInt(monthsCount, 10) : 6,
  });

  return res.status(200).json(new ApiResponse(200, data, 'Finance dashboard metrics retrieved.'));
});

/**
 * 2. Update Company Financial Threshold Configuration
 * PUT /api/v1/finance/settings/thresholds
 */
export const updateThresholdConfig = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { lowProfitMarginThreshold, minProfitAmountThreshold, currency } = req.body;

  const updateFields = {};
  if (lowProfitMarginThreshold !== undefined) {
    updateFields['financeSettings.lowProfitMarginThreshold'] = Number(lowProfitMarginThreshold);
  }
  if (minProfitAmountThreshold !== undefined) {
    updateFields['financeSettings.minProfitAmountThreshold'] = Number(minProfitAmountThreshold);
  }
  if (currency) {
    updateFields['financeSettings.currency'] = currency.toUpperCase();
  }

  const company = await Company.findByIdAndUpdate(
    companyId,
    { $set: updateFields },
    { new: true }
  ).select('financeSettings name');

  return res
    .status(200)
    .json(new ApiResponse(200, company.financeSettings, 'Financial thresholds updated successfully.'));
});

/**
 * 3. Create Operational Expense Entry
 * POST /api/v1/finance/expenses
 */
export const createOperationalExpense = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { title, category, amount, date, notes } = req.body;

  if (!title || !amount || Number(amount) <= 0) {
    throw new ApiError(400, 'Valid title and positive amount are required.');
  }

  const expenseDate = date ? new Date(date) : new Date();
  const month = expenseDate.getMonth() + 1;
  const year = expenseDate.getFullYear();
  const monthYear = `${year}-${String(month).padStart(2, '0')}`;

  const opEx = await OperationalExpense.create({
    companyId,
    title,
    category: category || 'MISCELLANEOUS',
    amount: Number(amount),
    date: expenseDate,
    period: { month, year },
    monthYear,
    notes,
    createdBy: req.user._id,
  });

  return res.status(201).json(new ApiResponse(201, opEx, 'Operational expense added.'));
});

/**
 * 4. Create Income Entry
 * POST /api/v1/finance/income
 */
export const createCompanyIncome = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user.companyId;
  const { title, source, amount, date, notes } = req.body;

  if (!title || !amount || Number(amount) <= 0) {
    throw new ApiError(400, 'Valid title and positive amount are required.');
  }

  const incomeDate = date ? new Date(date) : new Date();
  const month = incomeDate.getMonth() + 1;
  const year = incomeDate.getFullYear();
  const monthYear = `${year}-${String(month).padStart(2, '0')}`;

  const income = await CompanyIncome.create({
    companyId,
    title,
    source: source || 'CLIENT_RETAINER',
    amount: Number(amount),
    date: incomeDate,
    period: { month, year },
    monthYear,
    notes,
    createdBy: req.user._id,
  });

  return res.status(201).json(new ApiResponse(201, income, 'Company income recorded.'));
});