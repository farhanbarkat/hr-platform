import mongoose from 'mongoose';
import { Loan } from '../models/loan.model.js';
import { LoanRepayment } from '../models/loanRepayment.model.js';

const getPayslipModel = () =>
  mongoose.models.Payslip ||
  mongoose.models.PayslipRecord ||
  mongoose.model(
    'Payslip',
    new mongoose.Schema(
      {
        companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
        employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
        month: { type: String, required: true },
        year: { type: Number, required: true },
        basicSalary: { type: mongoose.Schema.Types.Decimal128, required: true },
        allowances: { type: mongoose.Schema.Types.Decimal128, required: true },
        grossSalary: { type: mongoose.Schema.Types.Decimal128, required: true },
        deductions: { type: mongoose.Schema.Types.Decimal128, required: true },
        loanDeduction: { type: mongoose.Schema.Types.Decimal128, default: 0 },
        netSalary: { type: mongoose.Schema.Types.Decimal128, required: true },
        status: { type: String, enum: ['GENERATED', 'PAID', 'CANCELLED'], default: 'GENERATED' },
      },
      { timestamps: true }
    )
  );

export const generatePayslipWithLoanDeduction = async ({
  companyId,
  employee,
  salaryStructure,
  payrollMonth,
  payrollYear,
  session,
}) => {
  const employeeId = employee._id;
  const PayslipModel = getPayslipModel();

  // 1. Fetch active approved loan inside transaction session
  const activeLoan = await Loan.findOne({
    companyId,
    employeeId,
    status: 'APPROVED',
    remainingBalance: { $gt: mongoose.Types.Decimal128.fromString('0') },
  }).session(session);

  let emiDeductionAmount = 0;
  let repaymentRecordData = null;

  if (activeLoan) {
    const currentBalance = parseFloat(activeLoan.remainingBalance.toString());
    const configuredEmi = parseFloat(activeLoan.monthlyEmi.toString());

    emiDeductionAmount = Math.min(configuredEmi, currentBalance);
    const newRemainingBalance = parseFloat((currentBalance - emiDeductionAmount).toFixed(2));

    // Update Loan State atomically
    activeLoan.remainingBalance = mongoose.Types.Decimal128.fromString(newRemainingBalance.toFixed(2));
    if (newRemainingBalance <= 0) {
      activeLoan.status = 'COMPLETED';
    }
    await activeLoan.save({ session });

    repaymentRecordData = {
      loanId: activeLoan._id,
      amount: emiDeductionAmount,
      principalBefore: currentBalance,
      principalAfter: newRemainingBalance,
    };
  }

  // 2. Compute Net Pay with Loan EMI
  const basicSalary = parseFloat(salaryStructure.basicSalary?.toString() || 80000);
  const allowances = parseFloat(salaryStructure.allowances?.toString() || 10000);
  const standardDeductions = parseFloat(salaryStructure.deductions?.toString() || 5000);
  const grossSalary = basicSalary + allowances;
  const totalDeductions = standardDeductions + emiDeductionAmount;
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  // 3. Create Payslip within session
  const [payslip] = await PayslipModel.create(
    [
      {
        companyId,
        employeeId,
        month: payrollMonth,
        year: payrollYear,
        basicSalary: mongoose.Types.Decimal128.fromString(basicSalary.toFixed(2)),
        allowances: mongoose.Types.Decimal128.fromString(allowances.toFixed(2)),
        grossSalary: mongoose.Types.Decimal128.fromString(grossSalary.toFixed(2)),
        deductions: mongoose.Types.Decimal128.fromString(totalDeductions.toFixed(2)),
        loanDeduction: mongoose.Types.Decimal128.fromString(emiDeductionAmount.toFixed(2)),
        netSalary: mongoose.Types.Decimal128.fromString(netSalary.toFixed(2)),
        status: 'GENERATED',
      },
    ],
    { session }
  );

  // 4. Create LoanRepayment audit record within session
  if (repaymentRecordData && emiDeductionAmount > 0) {
    await LoanRepayment.create(
      [
        {
          companyId,
          loanId: repaymentRecordData.loanId,
          employeeId,
          payslipId: payslip._id,
          amount: mongoose.Types.Decimal128.fromString(emiDeductionAmount.toFixed(2)),
          principalBefore: mongoose.Types.Decimal128.fromString(
            repaymentRecordData.principalBefore.toFixed(2)
          ),
          principalAfter: mongoose.Types.Decimal128.fromString(
            repaymentRecordData.principalAfter.toFixed(2)
          ),
          repaymentDate: new Date(),
        },
      ],
      { session }
    );
  }

  return payslip;
};