import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function CompanyFinance() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('ALL'); // 'ALL' | 'PAYROLL' | 'MANUAL'
  const [searchQuery, setSearchQuery] = useState('');

  // Period Selector (Defaults to Current Month & Year)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Form: Expense
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'FACILITIES',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // Form: Income
  const [incomeForm, setIncomeForm] = useState({
    title: '',
    source: 'CLIENT_RETAINER',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // Form: Alert Thresholds
  const [thresholdForm, setThresholdForm] = useState({
    lowProfitMarginThreshold: 15,
    minProfitAmountThreshold: 0,
    currency: 'PKR',
  });

  // 1. Fetch Real Live Data from Backend
  const fetchFinanceMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/finance/dashboard', {
        params: {
          year: selectedYear,
          month: selectedMonth,
          monthsCount: 6,
        },
      });

      const payload = res.data?.data;
      setData(payload || null);

      if (payload?.thresholds) {
        setThresholdForm({
          lowProfitMarginThreshold: payload.thresholds.lowProfitMarginThreshold ?? 15,
          minProfitAmountThreshold: payload.thresholds.minProfitAmountThreshold ?? 0,
          currency: payload.thresholds.currency || 'PKR',
        });
      }
    } catch (err) {
      console.error('Error fetching finance telemetry:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchFinanceMetrics();
  }, [fetchFinanceMetrics]);

  // 2. Submit Real Expense to Database (POST /api/v1/finance/expenses)
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!expenseForm.title.trim() || !expenseForm.amount || Number(expenseForm.amount) <= 0) {
      setActionError('Valid title and positive amount are required.');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.post('/finance/expenses', {
        title: expenseForm.title.trim(),
        category: expenseForm.category,
        amount: Number(expenseForm.amount),
        date: expenseForm.date,
        notes: expenseForm.notes.trim(),
      });

      setShowExpenseModal(false);
      setExpenseForm({
        title: '',
        category: 'FACILITIES',
        amount: '',
        date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      fetchFinanceMetrics();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to record expense.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Submit Real Income to Database (POST /api/v1/finance/income)
  const handleIncomeSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!incomeForm.title.trim() || !incomeForm.amount || Number(incomeForm.amount) <= 0) {
      setActionError('Valid title and positive amount are required.');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.post('/finance/income', {
        title: incomeForm.title.trim(),
        source: incomeForm.source,
        amount: Number(incomeForm.amount),
        date: incomeForm.date,
        notes: incomeForm.notes.trim(),
      });

      setShowIncomeModal(false);
      setIncomeForm({
        title: '',
        source: 'CLIENT_RETAINER',
        amount: '',
        date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      fetchFinanceMetrics();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to record income.');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Update Financial Thresholds (PUT /api/v1/finance/settings/thresholds)
  const handleThresholdSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    try {
      setActionLoading(true);
      await apiClient.put('/finance/settings/thresholds', {
        lowProfitMarginThreshold: Number(thresholdForm.lowProfitMarginThreshold),
        minProfitAmountThreshold: Number(thresholdForm.minProfitAmountThreshold),
        currency: thresholdForm.currency.toUpperCase(),
      });

      setShowThresholdModal(false);
      fetchFinanceMetrics();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update alert thresholds.');
    } finally {
      setActionLoading(false);
    }
  };

  // Exact Values straight from Backend
  const grossIncome = Number(data?.totalIncome || 0);
  const payrollExpense = Number(data?.totalPayroll || 0);
  const operationalExpense = Number(data?.totalOperationalExpenses || data?.totalExpensesWithoutPayroll || 0);
  const totalOutflow = Number(data?.totalExpenses || (payrollExpense + operationalExpense));
  const netProfit = Number(data?.netProfit !== undefined ? data.netProfit : (grossIncome - totalOutflow));

  const profitMarginNum = grossIncome > 0 ? (netProfit / grossIncome) * 100 : 0;
  const profitMarginStr = profitMarginNum.toFixed(1);
  const payrollRatio = totalOutflow > 0 ? ((payrollExpense / totalOutflow) * 100).toFixed(1) : '0.0';

  const thresholdMargin = Number(data?.thresholds?.lowProfitMarginThreshold ?? thresholdForm.lowProfitMarginThreshold ?? 15);
  const isHealthWarning = grossIncome > 0 && profitMarginNum < thresholdMargin;

  // Real Database 6-Month Trajectory History
  const trajectoryList = Array.isArray(data?.monthlyTrajectory || data?.history)
    ? data.monthlyTrajectory || data.history
    : [];

  const maxTrajectoryVal = Math.max(
    ...trajectoryList.map((m) => Math.max(Number(m.income || 0), Number(m.expense || m.expenses || 0))),
    10000
  );

  // Real Ledger Entries from Backend
  const ledgerList = Array.isArray(data?.ledgerEntries || data?.expenses)
    ? data.ledgerEntries || data.expenses
    : [];

  // Filter Ledger by search and subtab
  const filteredLedger = ledgerList.filter((item) => {
    const itemType = item.type || (item.payrollRunId ? 'PAYROLL' : 'MANUAL');
    const matchesTab =
      activeSubTab === 'ALL'
        ? true
        : activeSubTab === 'PAYROLL'
        ? itemType === 'PAYROLL'
        : itemType === 'MANUAL';

    const q = searchQuery.toLowerCase();
    const title = (item.title || item.name || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    const idStr = String(item._id || item.id || '').toLowerCase();

    const matchesSearch = !searchQuery.trim() || title.includes(q) || cat.includes(q) || idStr.includes(q);
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-4 max-w-[1440px] mx-auto select-none font-sans text-[#1D2530] pb-16">
      {/* Top Banner & Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 px-6 rounded-lg border border-[#E3DED4] shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-[#111C2E]">Financial Health & Profit Telemetry</h1>
          <p className="text-[11px] text-[#69788A] mt-0.5">
            Aggregate tracking of payroll overhead, operating expenses, disbursements, and net operational margin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Real Period Picker */}
          <div className="flex items-center gap-1 bg-[#FAF8F5] border border-[#D5CEC2] rounded px-2 py-1">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-mono text-[#111C2E] outline-none cursor-pointer"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-mono text-[#111C2E] outline-none cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Configure Margin Alert */}
          <button
            onClick={() => {
              setActionError('');
              setShowThresholdModal(true);
            }}
            className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D5CEC2] rounded text-xs font-mono font-medium text-[#111C2E] flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <span>⚙️</span>
            <span>Configure Margin Alert</span>
          </button>

          {/* Record Income */}
          <button
            onClick={() => {
              setActionError('');
              setShowIncomeModal(true);
            }}
            className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#F2EFE9] border border-[#D5CEC2] rounded text-xs font-mono font-medium text-[#1E7E34] flex items-center gap-1 cursor-pointer transition-all"
          >
            <span>+</span>
            <span>Record Income</span>
          </button>

          {/* Record Operating Expense */}
          <button
            onClick={() => {
              setActionError('');
              setShowExpenseModal(true);
            }}
            className="px-3 py-1.5 bg-[#111C2E] hover:bg-[#1E2B3E] text-white rounded text-xs font-mono font-semibold flex items-center gap-1 cursor-pointer shadow-xs transition-all"
          >
            <span>+</span>
            <span>Record Operating Expense</span>
          </button>
        </div>
      </div>

      {/* Real Financial Health Notice Alert Banner (Dynamic) */}
      {isHealthWarning && (
        <div className="p-3.5 px-4 bg-[#FFF9F2] border-l-4 border-[#B83E28] border border-[#F5E1D5] rounded-r-lg flex items-start gap-3 shadow-2xs">
          <span className="text-[#B83E28] text-base leading-tight mt-0.5">⚠️</span>
          <div className="space-y-0.5">
            <div className="font-bold text-[#8C3423] text-xs font-mono">Financial Health Notice</div>
            <p className="text-[11px] text-[#7A3F33] leading-relaxed">
              Current cycle expenses and payroll (PKR {totalOutflow.toLocaleString()}) have reached{' '}
              <strong>{((totalOutflow / grossIncome) * 100).toFixed(1)}%</strong> of total recorded revenue (PKR{' '}
              {grossIncome.toLocaleString()}). Profit margin ({profitMarginStr}%) is below the configured {thresholdMargin}% threshold.
            </p>
          </div>
        </div>
      )}

      {/* Top 4 KPI Metrics (Direct from MongoDB calculations) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* TOTAL GROSS INCOME */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider">
              <span>TOTAL GROSS INCOME</span>
              <span className="text-[#1E7E34]">↗</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold text-[#111C2E] font-mono">PKR</span>
              <span className="text-2xl font-serif font-bold text-[#111C2E]">
                {grossIncome.toLocaleString()}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#728294]">
              Recorded for {selectedMonth}/{selectedYear}
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#1E7E34] text-sm">
            💰
          </div>
        </div>

        {/* PAYROLL EXPENDITURE */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider">
              <span>PAYROLL EXPENDITURE</span>
              <span>👥</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold text-[#111C2E] font-mono">PKR</span>
              <span className="text-2xl font-serif font-bold text-[#111C2E]">
                {payrollExpense.toLocaleString()}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#728294]">
              {payrollRatio}% of total outflow
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#728294] text-sm">
            💼
          </div>
        </div>

        {/* OPERATING EXPENSES */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider">
              <span>OPERATING EXPENSES</span>
              <span>📋</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold text-[#111C2E] font-mono">PKR</span>
              <span className="text-2xl font-serif font-bold text-[#111C2E]">
                {operationalExpense.toLocaleString()}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#B83E28]">
              Verified non-payroll disbursements
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#B83E28] text-sm">
            🧾
          </div>
        </div>

        {/* NET OPERATIONAL PROFIT */}
        <div className="bg-white p-4 px-5 rounded-lg border border-[#E3DED4] shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[9.5px] font-mono font-bold text-[#728294] uppercase tracking-wider">
              <span>NET OPERATIONAL PROFIT</span>
              <span>💵</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold text-[#111C2E] font-mono">PKR</span>
              <span className={`text-2xl font-serif font-bold ${netProfit < 0 ? 'text-[#B83E28]' : 'text-[#111C2E]'}`}>
                {netProfit.toLocaleString()}
              </span>
            </div>
            <div className="text-[10px] font-mono">
              <span className={netProfit < 0 || isHealthWarning ? 'text-[#B83E28] font-bold' : 'text-[#1E7E34] font-bold'}>
                {profitMarginStr}% Margin {isHealthWarning && '(Warning)'}
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded bg-[#FAF8F5] border border-[#E3DED4] flex items-center justify-center text-[#8C5D17] text-sm">
            📊
          </div>
        </div>
      </div>

      {/* Trajectory Curve & Cost Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Income vs Total Expense Trajectory */}
        <div className="lg:col-span-8 bg-white p-5 rounded-lg border border-[#E3DED4] shadow-xs space-y-4 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F4F1EA] pb-3">
            <div>
              <h2 className="text-xs font-bold text-[#111C2E]">Income vs Total Expense Trajectory</h2>
              <p className="text-[10.5px] text-[#69788A]">
                6-month historical curve comparing cash influx and combined outflows
              </p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono text-[#546274]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#111C2E]" />
                <span>Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#64748B]" />
                <span>Expenses</span>
              </div>
            </div>
          </div>

          {/* Histogram Bar Graphic from Real Aggregations */}
          <div className="h-44 pt-6 px-4 flex items-end justify-between gap-4 border-b border-[#EAE6DD]">
            {trajectoryList.length === 0 ? (
              <div className="w-full text-center font-mono text-xs text-[#728294] py-12">
                No historical records aggregated yet for preceding months.
              </div>
            ) : (
              trajectoryList.map((m, idx) => {
                const inc = Number(m.income || 0);
                const exp = Number(m.expense || m.expenses || 0);
                const incHeight = Math.min(100, (inc / maxTrajectoryVal) * 100);
                const expHeight = Math.min(100, (exp / maxTrajectoryVal) * 100);

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex justify-center items-end gap-1.5 h-32">
                      <div
                        style={{ height: `${Math.max(incHeight, 4)}%` }}
                        className="w-5 bg-[#111C2E] rounded-t-xs transition-all"
                        title={`Revenue: PKR ${inc.toLocaleString()}`}
                      />
                      <div
                        style={{ height: `${Math.max(expHeight, 4)}%` }}
                        className="w-5 bg-[#64748B] rounded-t-xs transition-all"
                        title={`Expenses: PKR ${exp.toLocaleString()}`}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[#728294] font-medium">
                      {m.label || `${m.month}/${String(m.year).slice(-2)}`}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Cost Distribution Breakdown */}
        <div className="lg:col-span-4 bg-white p-5 rounded-lg border border-[#E3DED4] shadow-xs space-y-4 flex flex-col justify-between">
          <div className="border-b border-[#F4F1EA] pb-3">
            <h2 className="text-xs font-bold text-[#111C2E]">Cost Distribution Breakdown</h2>
            <p className="text-[10.5px] text-[#69788A]">
              Granular allocation of operational outflows
            </p>
          </div>

          <div className="space-y-3.5 text-xs font-mono">
            {/* Fixed Staff Salaries */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#111C2E] font-medium">Fixed Staff Salaries (Payroll)</span>
                <span className="font-bold text-[#111C2E]">{payrollRatio}%</span>
              </div>
              <div className="w-full bg-[#FAF8F5] h-2 rounded-full overflow-hidden border border-[#E3DED4]">
                <div
                  className="bg-[#111C2E] h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Number(payrollRatio))}%` }}
                />
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#111C2E] font-medium">Facilities & Operations</span>
                <span className="font-bold text-[#111C2E]">
                  {totalOutflow > 0 ? ((operationalExpense / totalOutflow) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="w-full bg-[#FAF8F5] h-2 rounded-full overflow-hidden border border-[#E3DED4]">
                <div
                  className="bg-[#64748B] h-full rounded-full transition-all"
                  style={{
                    width: `${totalOutflow > 0 ? Math.min(100, (operationalExpense / totalOutflow) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operating Expense Registry & Loan Flow Ledger */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-[#E3DED4] shadow-xs">
          <div>
            <h2 className="text-xs font-bold text-[#111C2E]">Operating Expense Registry & Ledger Flow</h2>
            <p className="text-[10.5px] text-[#69788A]">
              Real-time ledger entries directly from Atlas database
            </p>
          </div>

          <div className="relative min-w-[260px]">
            <span className="absolute left-3 top-2 text-[#8C9BAE] text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search by ID or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded pl-8 pr-3 py-1.5 text-xs text-[#1D2530] placeholder-[#8C9BAE] outline-none focus:border-[#8C5D17]"
            />
          </div>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="flex items-center gap-4 text-xs font-mono px-1">
          <button
            onClick={() => setActiveSubTab('ALL')}
            className={`pb-1 cursor-pointer transition-all ${
              activeSubTab === 'ALL'
                ? 'border-b-2 border-[#111C2E] font-bold text-[#111C2E]'
                : 'text-[#728294] hover:text-[#111C2E]'
            }`}
          >
            All Entries
          </button>
          <button
            onClick={() => setActiveSubTab('PAYROLL')}
            className={`pb-1 cursor-pointer transition-all ${
              activeSubTab === 'PAYROLL'
                ? 'border-b-2 border-[#111C2E] font-bold text-[#111C2E]'
                : 'text-[#728294] hover:text-[#111C2E]'
            }`}
          >
            Payroll Runs
          </button>
          <button
            onClick={() => setActiveSubTab('MANUAL')}
            className={`pb-1 cursor-pointer transition-all ${
              activeSubTab === 'MANUAL'
                ? 'border-b-2 border-[#111C2E] font-bold text-[#111C2E]'
                : 'text-[#728294] hover:text-[#111C2E]'
            }`}
          >
            Manual OpEx
          </button>
        </div>

        {/* Ledger Table (Real Data) */}
        <div className="bg-white rounded-lg border border-[#E3DED4] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E3DED4] text-[9.5px] font-mono uppercase tracking-wider text-[#728294]">
                  <th className="py-3 px-4">TRANSACTION ID</th>
                  <th className="py-3 px-4">CATEGORY / TITLE</th>
                  <th className="py-3 px-4">TYPE</th>
                  <th className="py-3 px-4">RECORDED BY</th>
                  <th className="py-3 px-4">DATE</th>
                  <th className="py-3 px-4 text-right">AMOUNT (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F1EA] text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center font-mono text-[#728294]">
                      Loading real financial transactions...
                    </td>
                  </tr>
                ) : filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center font-mono text-[#728294]">
                      No expense or payroll entries recorded for {selectedMonth}/{selectedYear}. Click "+ Record Operating Expense" to add.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((tx) => {
                    const isPayroll = Boolean(tx.payrollRunId || tx.type === 'PAYROLL');
                    const txId = tx.transactionId || (tx._id ? `EXP-${String(tx._id).slice(-6).toUpperCase()}` : 'EXP');
                    const creatorName = tx.createdBy?.name || tx.createdBy?.firstName || 'System User';

                    return (
                      <tr key={tx._id || tx.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-semibold text-[#111C2E]">
                          {txId}
                        </td>

                        <td className="py-3.5 px-4 text-[#111C2E] font-medium">
                          {tx.title || tx.category || 'Operational Outflow'}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                              isPayroll
                                ? 'bg-[#FAF3E8] text-[#8C5D17] border-[#E8D4B5]'
                                : 'bg-[#FAF8F5] text-[#546274] border-[#D5CEC2]'
                            }`}
                          >
                            {isPayroll ? 'Payroll Run' : 'Manual OpEx'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-[#546274] font-medium text-xs">
                          {creatorName}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#546274]">
                          {tx.date ? String(tx.date).slice(0, 10) : 'N/A'}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-[#B83E28] text-right">
                          - PKR {Number(tx.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal 1: Record Operating Expense (POST /api/v1/finance/expenses) */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#111C2E]">Record Operating Expense</h2>
              <button onClick={() => setShowExpenseModal(false)} className="text-xs text-[#728294] cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleExpenseSubmit} className="p-5 space-y-3.5 text-xs">
              {actionError && (
                <div className="p-2 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
                  {actionError}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Expense Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Generator Fuel / Maintenance"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none focus:border-[#8C5D17]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Category *</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none cursor-pointer"
                  >
                    <option value="FACILITIES">Facilities & Utilities</option>
                    <option value="FLEET">Fleet & Transport</option>
                    <option value="MAINTENANCE">IT & Hardware</option>
                    <option value="LEGAL">Legal & Professional</option>
                    <option value="MISCELLANEOUS">Miscellaneous</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Amount (PKR) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="25000"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Expense Date *</label>
                <input
                  type="date"
                  required
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Notes / Description</label>
                <textarea
                  rows="2"
                  placeholder="Voucher or invoice tracking remarks..."
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-3.5 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-[#111C2E] hover:bg-[#1E2B3E] text-white rounded font-semibold text-xs cursor-pointer disabled:opacity-50 font-mono shadow-xs"
                >
                  {actionLoading ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Record Company Income (POST /api/v1/finance/income) */}
      {showIncomeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#111C2E]">Record Company Inflow / Revenue</h2>
              <button onClick={() => setShowIncomeModal(false)} className="text-xs text-[#728294] cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleIncomeSubmit} className="p-5 space-y-3.5 text-xs">
              {actionError && (
                <div className="p-2 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
                  {actionError}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Revenue / Income Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Enterprise Client Retainer"
                  value={incomeForm.title}
                  onChange={(e) => setIncomeForm({ ...incomeForm, title: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none focus:border-[#8C5D17]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Income Source *</label>
                  <select
                    value={incomeForm.source}
                    onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none cursor-pointer"
                  >
                    <option value="CLIENT_RETAINER">Client Retainer</option>
                    <option value="PROJECT_MILESTONE">Project Milestone</option>
                    <option value="INVESTMENT">Investment / Capital</option>
                    <option value="MISCELLANEOUS">Other Inflow</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#111C2E] block">Amount (PKR) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="1500000"
                    value={incomeForm.amount}
                    onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Deposit Date *</label>
                <input
                  type="date"
                  required
                  value={incomeForm.date}
                  onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setShowIncomeModal(false)}
                  className="px-3.5 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-[#1E7E34] hover:bg-[#176329] text-white rounded font-semibold text-xs cursor-pointer disabled:opacity-50 font-mono shadow-xs"
                >
                  {actionLoading ? 'Recording...' : 'Record Revenue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Configure Margin Alert Thresholds (PUT /api/v1/finance/settings/thresholds) */}
      {showThresholdModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 px-5 border-b border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
              <h2 className="text-sm font-bold text-[#111C2E]">Configure Margin Alert Thresholds</h2>
              <button onClick={() => setShowThresholdModal(false)} className="text-xs text-[#728294] cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleThresholdSubmit} className="p-5 space-y-3.5 text-xs">
              {actionError && (
                <div className="p-2 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
                  {actionError}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Low Profit Margin Threshold (%) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="100"
                  value={thresholdForm.lowProfitMarginThreshold}
                  onChange={(e) =>
                    setThresholdForm({ ...thresholdForm, lowProfitMarginThreshold: e.target.value })
                  }
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none font-mono"
                />
                <span className="text-[10px] text-[#728294]">
                  An operational health alert banner will trigger if net profit margin falls below this %
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#111C2E] block">Minimum Safe Profit Buffer (PKR) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={thresholdForm.minProfitAmountThreshold}
                  onChange={(e) =>
                    setThresholdForm({ ...thresholdForm, minProfitAmountThreshold: e.target.value })
                  }
                  className="w-full bg-[#FAF8F5] border border-[#D5CEC2] rounded px-3 py-1.5 outline-none font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setShowThresholdModal(false)}
                  className="px-3.5 py-1.5 bg-[#FAF8F5] border border-[#D5CEC2] rounded text-xs text-[#546274] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-[#8C5D17] text-white rounded font-semibold text-xs cursor-pointer disabled:opacity-50 font-mono shadow-xs"
                >
                  {actionLoading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}