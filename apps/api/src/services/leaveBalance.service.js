import mongoose from 'mongoose';
import { LeaveType } from '../models/leaveType.model.js';
import { LeaveBalance } from '../models/leaveBalance.model.js';
import { Employee } from '../models/employee.model.js';

/**
 * Ensures default leave types exist for a company
 */
export const seedDefaultLeaveTypes = async (companyId) => {
  const compId = new mongoose.Types.ObjectId(companyId);

  const defaults = [
    { name: 'Casual Leave', code: 'CASUAL', defaultAllotment: 10, isPaid: true, isDefault: true },
    { name: 'Sick Leave', code: 'SICK', defaultAllotment: 10, isPaid: true, isDefault: true },
    { name: 'Annual Leave', code: 'ANNUAL', defaultAllotment: 14, isPaid: true, isDefault: true },
  ];

  const operations = defaults.map((item) => ({
    updateOne: {
      filter: { companyId: compId, code: item.code },
      update: { $setOnInsert: { ...item, companyId: compId } },
      upsert: true,
    },
  }));

  if (operations.length > 0) {
    await LeaveType.bulkWrite(operations);
  }
};

/**
 * Initializes leave balances for all employees of a company for a target year
 */
export const initializeCompanyLeaveBalances = async (companyId, targetYear = new Date().getFullYear()) => {
  const compId = new mongoose.Types.ObjectId(companyId);
  await seedDefaultLeaveTypes(compId);

  // Flexible employee query: matches active status or all employees of this company
  const [employees, activeLeaveTypes] = await Promise.all([
    Employee.find({
      companyId: compId,
      $or: [
        { status: { $in: ['ACTIVE', 'active'] } },
        { employmentStatus: { $in: ['ACTIVE', 'active', 'PERMANENT', 'PROBATION'] } },
        { status: { $exists: false } }
      ]
    }).select('_id'),
    LeaveType.find({ companyId: compId, isActive: { $ne: false } }),
  ]);

  if (employees.length === 0 || activeLeaveTypes.length === 0) {
    return {
      employeesFound: employees.length,
      leaveTypesFound: activeLeaveTypes.length,
      initializedCount: 0
    };
  }

  const bulkOps = [];
  for (const emp of employees) {
    for (const lt of activeLeaveTypes) {
      bulkOps.push({
        updateOne: {
          filter: {
            companyId: compId,
            employeeId: emp._id,
            leaveTypeId: lt._id,
            year: targetYear,
          },
          update: {
            $setOnInsert: {
              companyId: compId,
              employeeId: emp._id,
              leaveTypeId: lt._id,
              year: targetYear,
              allotted: lt.defaultAllotment,
              used: 0,
              pending: 0,
              remaining: lt.defaultAllotment,
            },
          },
          upsert: true,
        },
      });
    }
  }

  const result = await LeaveBalance.bulkWrite(bulkOps);
  return {
    employeesCount: employees.length,
    leaveTypesCount: activeLeaveTypes.length,
    totalTargeted: bulkOps.length,
    upsertedCount: result.upsertedCount,
    modifiedCount: result.modifiedCount,
  };
};

/**
 * Atomic Balance Deduction on Leave Approval (Prevents Race Conditions)
 */
export const deductLeaveBalanceAtomic = async ({
  companyId,
  employeeId,
  leaveTypeId,
  days,
  year = new Date().getFullYear(),
  session = null,
}) => {
  const compId = new mongoose.Types.ObjectId(companyId);
  const empId = new mongoose.Types.ObjectId(employeeId);
  const ltId = new mongoose.Types.ObjectId(leaveTypeId);

  const query = {
    companyId: compId,
    employeeId: empId,
    leaveTypeId: ltId,
    year,
    remaining: { $gte: days },
  };

  const update = {
    $inc: {
      used: days,
      remaining: -days,
    },
  };

  const options = { new: true, session };
  const updatedBalance = await LeaveBalance.findOneAndUpdate(query, update, options);

  if (!updatedBalance) {
    throw new Error('Insufficient leave balance or balance document does not exist.');
  }

  return updatedBalance;
};