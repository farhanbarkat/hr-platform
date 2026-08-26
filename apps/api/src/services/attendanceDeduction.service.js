import mongoose from 'mongoose';
import { Company } from '../models/company.model.js';
import { Attendance } from '../models/attendance.model.js';

export class AttendanceDeductionService {
  /**
   * Aggregates total late minutes and early leaves for an employee in a specific pay period
   * and maps them into monetary deductions based on company configurations.
   */
  static async calculatePeriodDeductions({ companyId, employeeId, startDate, endDate, basicSalary }) {
    // 1. Fetch Company settings
    const company = await Company.findById(companyId);
    const attSettings = company?.settings?.attendance || {
      deductionCalculationMode: 'DYNAMIC_HOURLY',
      gracePeriodMinutes: 15,
    };

    // 2. Query attendance records
    const attendanceRecords = await Attendance.find({
      companyId,
      employeeId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    });

    let totalLateMinutes = 0;
    let totalEarlyLeaveMinutes = 0;

    for (const record of attendanceRecords) {
      if (record.status === 'PRESENT' || record.status === 'HALF_DAY') {
        if (record.lateMinutes && record.lateMinutes > (attSettings.gracePeriodMinutes || 15)) {
          totalLateMinutes += record.lateMinutes;
        }
        if (record.earlyLeaveMinutes && record.earlyLeaveMinutes > 0) {
          totalEarlyLeaveMinutes += record.earlyLeaveMinutes;
        }
      }
    }

    const totalPenaltyMinutes = totalLateMinutes + totalEarlyLeaveMinutes;
    const basicSalaryNum = parseFloat(basicSalary.toString());
    let hourlyRate = 0;

    // 3. Compute rate based on configuration
    if (attSettings.deductionCalculationMode === 'FIXED_RATE') {
      hourlyRate = parseFloat(attSettings.fixedDeductionRatePerHour?.toString() || '0');
    } else {
      // Dynamic: Assume standard 22 days month with 8 hours daily shift = 176 working hours
      const standardMonthlyHours = 22 * 8;
      hourlyRate = standardMonthlyHours > 0 ? basicSalaryNum / standardMonthlyHours : 0;
    }

    const lateDeductionAmount = ((totalLateMinutes / 60) * hourlyRate).toFixed(2);
    const earlyLeaveDeductionAmount = ((totalEarlyLeaveMinutes / 60) * hourlyRate).toFixed(2);
    const totalDeductions = ((totalPenaltyMinutes / 60) * hourlyRate).toFixed(2);

    return {
      summary: {
        totalLateMinutes,
        totalEarlyLeaveMinutes,
        totalPenaltyMinutes,
      },
      hourlyRate: hourlyRate.toFixed(2),
      deductions: {
        lateDeductions: mongoose.Types.Decimal128.fromString(lateDeductionAmount),
        earlyLeaveDeductions: mongoose.Types.Decimal128.fromString(earlyLeaveDeductionAmount),
        totalLateEarlyDeductions: mongoose.Types.Decimal128.fromString(totalDeductions),
      },
    };
  }
}