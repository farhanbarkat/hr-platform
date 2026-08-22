import mongoose from 'mongoose';
import { SalaryStructure } from '../models/salaryStructure.model.js';
import { ApiError } from '../utils/ApiError.js';

export class SalaryStructureService {
  /**
   * Create a new immutable salary structure revision.
   * Never overwrites existing structures.
   */
  static async createSalaryStructure({
    companyId,
    employeeId,
    effectiveFrom,
    basicPay,
    allowances = [],
    currency = 'PKR',
    notes = '',
    createdBy,
  }) {
    if (!companyId || !employeeId || !effectiveFrom || basicPay === undefined) {
      throw new ApiError(400, 'companyId, employeeId, effectiveFrom, and basicPay are required.');
    }

    const effectiveDate = new Date(effectiveFrom);
    if (isNaN(effectiveDate.getTime())) {
      throw new ApiError(400, 'Invalid effectiveFrom date format.');
    }

    // Convert basicPay to Decimal128
    const decimalBasicPay = mongoose.Types.Decimal128.fromString(basicPay.toString());

    // Convert all allowance amounts to Decimal128
    const formattedAllowances = allowances.map((item) => {
      if (!item.name || item.amount === undefined) {
        throw new ApiError(400, 'Each allowance must have a name and amount.');
      }
      return {
        name: item.name.trim(),
        amount: mongoose.Types.Decimal128.fromString(item.amount.toString()),
        isTaxable: item.isTaxable !== undefined ? item.isTaxable : true,
      };
    });

    // Check if an exact same effectiveFrom already exists for this employee
    const existing = await SalaryStructure.findOne({
      companyId,
      employeeId,
      effectiveFrom: effectiveDate,
    });

    if (existing) {
      throw new ApiError(
        409,
        `A salary structure effective from ${effectiveDate.toISOString().split('T')[0]} already exists. Create with a new effective date.`
      );
    }

    const newStructure = await SalaryStructure.create({
      companyId,
      employeeId,
      effectiveFrom: effectiveDate,
      basicPay: decimalBasicPay,
      allowances: formattedAllowances,
      currency,
      notes,
      createdBy,
    });

    return newStructure;
  }

  /**
   * Resolves the exact salary structure active on a given historical or current date.
   * Query pattern: effectiveFrom <= queryDate ORDER BY effectiveFrom DESC LIMIT 1
   */
  static async getActiveSalaryStructure(employeeId, queryDate = new Date()) {
    const targetDate = new Date(queryDate);
    if (isNaN(targetDate.getTime())) {
      throw new ApiError(400, 'Invalid date provided for salary structure resolution.');
    }

    const structure = await SalaryStructure.findOne({
      employeeId,
      effectiveFrom: { $lte: targetDate },
    })
      .sort({ effectiveFrom: -1 })
      .lean();

    if (!structure) {
      return null;
    }

    // Helper helper to return plain serializable numbers alongside Decimal128
    return {
      ...structure,
      basicPayDecimal: structure.basicPay.toString(),
      allowances: structure.allowances.map((a) => ({
        name: a.name,
        amountDecimal: a.amount.toString(),
        isTaxable: a.isTaxable,
      })),
    };
  }

  /**
   * Retrieve complete revision history for an employee
   */
  static async getSalaryHistory(companyId, employeeId) {
    return await SalaryStructure.find({ companyId, employeeId })
      .sort({ effectiveFrom: -1 })
      .populate('createdBy', 'name email');
  }
}