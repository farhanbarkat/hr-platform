import mongoose from 'mongoose';
import { Payslip } from '../models/payslip.model.js';
import { Loan } from '../models/loan.model.js';
import { OperationalExpense } from '../models/operationalExpense.model.js';
import { CompanyIncome } from '../models/companyIncome.model.js';
import { Company } from '../models/company.model.js';

export const getCompanyFinancialMetrics = async (companyId, { year, month, monthsCount = 6 }) => {
  const companyObjectId = new mongoose.Types.ObjectId(companyId);
  const company = await Company.findById(companyObjectId).select('financeSettings name currency');

  const now = new Date();
  const targetYear = year ? parseInt(year, 10) : now.getFullYear();
  const targetMonth = month ? parseInt(month, 10) : now.getMonth() + 1;
  const currentMonthYear = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;

  // Generate range of past N months for trend lines
  const trendMonthYears = [];
  let currY = targetYear;
  let currM = targetMonth;
  for (let i = 0; i < monthsCount; i++) {
    trendMonthYears.unshift(`${currY}-${String(currM).padStart(2, '0')}`);
    currM--;
    if (currM === 0) {
      currM = 12;
      currY--;
    }
  }

 // 1. Aggregate Payroll Expenses (Safe period reconstruction & decimal handling)
  const payrollAgg = await Payslip.aggregate([
    {
      $match: {
        $or: [{ companyId: companyObjectId }, { companyId: companyId.toString() }],
        status: { $in: ['APPROVED', 'PAID', 'GENERATED', 'PROCESSED'] },
      },
    },
    {
      $addFields: {
        computedMonthYear: {
          $ifNull: [
            '$monthYear',
            {
              $cond: {
                if: { $and: ['$period.year', '$period.month'] },
                then: {
                  $concat: [
                    { $toString: '$period.year' },
                    '-',
                    {
                      $cond: {
                        if: { $lt: ['$period.month', 10] },
                        then: { $concat: ['0', { $toString: '$period.month' }] },
                        else: { $toString: '$period.month' },
                      },
                    },
                  ],
                },
                else: {
                  $dateToString: {
                    format: '%Y-%m',
                    date: { $ifNull: ['$paymentDate', '$createdAt'] },
                  },
                },
              },
            },
          ],
        },
        computedGross: {
          $toDouble: {
            $ifNull: [
              '$earnings.grossPay',
              {
                $ifNull: [
                  '$grossPay',
                  {
                    $ifNull: [
                      '$grossSalary',
                      {
                        $ifNull: [
                          '$totalGross',
                          { $ifNull: ['$netPay', 0] }
                        ]
                      }
                    ]
                  }
                ]
              }
            ],
          },
        },
      },
    },
    {
      $match: {
        computedMonthYear: { $in: trendMonthYears },
      },
    },
    {
      $group: {
        _id: '$computedMonthYear',
        totalPayroll: { $sum: '$computedGross' },
      },
    },
  ]);

  // 2. Aggregate Loan Disbursements (Convert Decimal128 to Double)
  const loanAgg = await Loan.aggregate([
    {
      $match: {
        companyId: companyObjectId,
        status: { $in: ['APPROVED', 'PAID', 'COMPLETED', 'CLOSED', 'ACTIVE'] },
      },
    },
    {
      $project: {
        rawAmount: { $ifNull: ['$principal', '$amount'] },
        effectiveDate: { $ifNull: ['$disbursedAt', '$createdAt'] },
      },
    },
    {
      $project: {
        amountDouble: { $toDouble: '$rawAmount' },
        monthYear: {
          $dateToString: { format: '%Y-%m', date: '$effectiveDate' },
        },
      },
    },
    {
      $match: {
        monthYear: { $in: trendMonthYears },
      },
    },
    {
      $group: {
        _id: '$monthYear',
        totalLoanDisbursed: { $sum: '$amountDouble' },
      },
    },
  ]);

  // 3. Aggregate Operational Expenses
  const opExAgg = await OperationalExpense.aggregate([
    {
      $match: {
        companyId: companyObjectId,
        monthYear: { $in: trendMonthYears },
      },
    },
    {
      $project: {
        monthYear: 1,
        category: 1,
        amountDouble: { $toDouble: '$amount' },
      },
    },
    {
      $group: {
        _id: { monthYear: '$monthYear', category: '$category' },
        totalAmount: { $sum: '$amountDouble' },
      },
    },
  ]);

  // 4. Aggregate Company Incomes
  const incomeAgg = await CompanyIncome.aggregate([
    {
      $match: {
        companyId: companyObjectId,
        monthYear: { $in: trendMonthYears },
      },
    },
    {
      $project: {
        monthYear: 1,
        source: 1,
        amountDouble: { $toDouble: '$amount' },
      },
    },
    {
      $group: {
        _id: { monthYear: '$monthYear', source: '$source' },
        totalAmount: { $sum: '$amountDouble' },
      },
    },
  ]);

  // Format Map Lookups (Always coerce to clean Numbers)
  const payrollMap = Object.fromEntries(
    payrollAgg.map((r) => [r._id, Number(r.totalPayroll) || 0])
  );
  const loanMap = Object.fromEntries(
    loanAgg.map((r) => [r._id, Number(r.totalLoanDisbursed) || 0])
  );

  const opExMonthMap = {};
  const opExCategoryCurrentMonth = {};
  opExAgg.forEach((item) => {
    const m = item._id.monthYear;
    const amt = Number(item.totalAmount) || 0;
    opExMonthMap[m] = (opExMonthMap[m] || 0) + amt;
    if (m === currentMonthYear) {
      opExCategoryCurrentMonth[item._id.category] =
        (opExCategoryCurrentMonth[item._id.category] || 0) + amt;
    }
  });

  const incomeMonthMap = {};
  const incomeSourceCurrentMonth = {};
  incomeAgg.forEach((item) => {
    const m = item._id.monthYear;
    const amt = Number(item.totalAmount) || 0;
    incomeMonthMap[m] = (incomeMonthMap[m] || 0) + amt;
    if (m === currentMonthYear) {
      incomeSourceCurrentMonth[item._id.source] =
        (incomeSourceCurrentMonth[item._id.source] || 0) + amt;
    }
  });

  // Assemble Monthly Trend Data
  const monthlyTrends = trendMonthYears.map((my) => {
    const payroll = Number(payrollMap[my]) || 0;
    const loans = Number(loanMap[my]) || 0;
    const opEx = Number(opExMonthMap[my]) || 0;
    const totalExpense = payroll + loans + opEx;
    const totalIncome = Number(incomeMonthMap[my]) || 0;
    const netProfit = totalIncome - totalExpense;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    return {
      monthYear: my,
      totalIncome,
      payrollExpense: payroll,
      loanDisbursement: loans,
      operationalExpense: opEx,
      totalExpense,
      netProfit,
      profitMargin: Number(profitMargin.toFixed(2)),
    };
  });

  // Current Month Summary
  const currentSummary =
    monthlyTrends.find((t) => t.monthYear === currentMonthYear) || {
      monthYear: currentMonthYear,
      totalIncome: 0,
      payrollExpense: 0,
      loanDisbursement: 0,
      operationalExpense: 0,
      totalExpense: 0,
      netProfit: 0,
      profitMargin: 0,
    };

  // Company Threshold Alert Evaluation
  const minMarginThreshold = company?.financeSettings?.lowProfitMarginThreshold ?? 20;
  const minProfitAmount = company?.financeSettings?.minProfitAmountThreshold ?? 0;

  let alertLevel = 'HEALTHY';
  let alertMessage = null;

  if (currentSummary.totalExpense > currentSummary.totalIncome) {
    alertLevel = 'CRITICAL';
    alertMessage = `Overspending Alert: Total expenses (PKR ${currentSummary.totalExpense.toLocaleString()}) exceed total income (PKR ${currentSummary.totalIncome.toLocaleString()}) by PKR ${Math.abs(currentSummary.netProfit).toLocaleString()}.`;
  } else if (
    currentSummary.profitMargin < minMarginThreshold ||
    currentSummary.netProfit < minProfitAmount
  ) {
    alertLevel = 'WARNING';
    alertMessage = `Low Profit Warning: Current profit margin of ${currentSummary.profitMargin}% is below your company threshold of ${minMarginThreshold}%.`;
  }

  const expenseBreakdown = [
    ...(currentSummary.payrollExpense > 0
      ? [{ name: 'Payroll & Salaries', value: currentSummary.payrollExpense }]
      : []),
    ...(currentSummary.loanDisbursement > 0
      ? [{ name: 'Loan Disbursements', value: currentSummary.loanDisbursement }]
      : []),
    ...Object.entries(opExCategoryCurrentMonth).map(([cat, amt]) => ({
      name: cat.replace(/_/g, ' '),
      value: amt,
    })),
  ];

  const incomeBreakdown = Object.entries(incomeSourceCurrentMonth).map(([src, amt]) => ({
    name: src.replace(/_/g, ' '),
    value: amt,
  }));

  return {
    period: currentMonthYear,
    currency: company?.financeSettings?.currency || 'PKR',
    thresholdConfig: {
      lowProfitMarginThreshold: minMarginThreshold,
      minProfitAmountThreshold: minProfitAmount,
    },
    alert: {
      level: alertLevel,
      message: alertMessage,
      isOverspending: currentSummary.totalExpense > currentSummary.totalIncome,
    },
    currentMonth: currentSummary,
    monthlyTrends,
    expenseBreakdown,
    incomeBreakdown,
  };
};