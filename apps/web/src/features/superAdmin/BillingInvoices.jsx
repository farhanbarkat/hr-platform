import React, { useState, useMemo } from 'react';
import { StatCard, DataTable } from '@repo/ui';

export default function BillingInvoices() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState('ALL');

  const rawBillingRecords = [
    { id: 'INV-1092', company: 'CloudLogic Inc', period: 'Aug 2026', amount: '$1,299.00', status: 'PAID', invoiceDate: '2026-08-01' },
    { id: 'INV-1093', company: 'Apex Technologies', period: 'Aug 2026', amount: '$499.00', status: 'PAID', invoiceDate: '2026-08-01' },
    { id: 'INV-1094', company: 'Quantum Health', period: 'Aug 2026', amount: '$199.00', status: 'PENDING', invoiceDate: '2026-08-01' },
    { id: 'INV-1095', company: 'Nexus Logistics', period: 'Jul 2026', amount: '$199.00', status: 'OVERDUE', invoiceDate: '2026-07-01' },
  ];

  const filteredData = useMemo(() => {
    return rawBillingRecords.filter((r) => {
      const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const matchDate = dateRange === 'ALL' || r.invoiceDate.startsWith(dateRange);
      return matchStatus && matchDate;
    });
  }, [statusFilter, dateRange]);

  const columns = [
    { key: 'id', label: 'Invoice Ref', type: 'mono' },
    { key: 'company', label: 'Organization', type: 'text' },
    { key: 'period', label: 'Billing Period', type: 'text' },
    { key: 'amount', label: 'Amount', align: 'right', render: (val) => <span className="font-mono text-xs font-semibold text-[#16233B]">{val}</span> },
    { key: 'status', label: 'Status', type: 'badge' },
    { key: 'action', label: 'Receipt', align: 'right', render: (_, r) => <button onClick={() => alert(`Receipt: ${r.id}`)} className="text-xs font-mono text-[#B9812E] hover:underline">PDF</button> },
  ];

  const badgeMap = { PAID: 'green', PENDING: 'amber', OVERDUE: 'red' };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#D8D3C7] pb-4">
        <h1 className="text-xl font-bold font-mono text-[#16233B]">Billing & Invoices</h1>
        <p className="text-xs font-mono text-[#5B6B79] mt-0.5">Platform accounts receivable & tier billing</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Revenue This Month" value="$48,200.00" deltaText="+8.4%" deltaVariant="success" caption="Monthly aggregate run-rate" />
        <StatCard label="Overdue Receivables" value="$698.00" deltaText="2 Invoices" deltaVariant="error" caption="Past due accounts" />
        <StatCard label="Active Subscriptions" value="128" deltaText="100% Active" deltaVariant="neutral" caption="Recurring tier instances" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border border-[#D8D3C7] rounded-[8px]">
        <div className="flex items-center gap-4 text-xs font-mono">
          <label className="flex items-center gap-2">
            <span className="text-[#5B6B79]">Status:</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-[#D8D3C7] rounded px-2 py-1 bg-white">
              <option value="ALL">All</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-[#5B6B79]">Period:</span>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="border border-[#D8D3C7] rounded px-2 py-1 bg-white">
              <option value="ALL">All Periods</option>
              <option value="2026-08">August 2026</option>
              <option value="2026-07">July 2026</option>
            </select>
          </label>
        </div>
        <span className="text-xs font-mono text-[#5B6B79]">Showing {filteredData.length} records</span>
      </div>

      <DataTable columns={columns} data={filteredData} badgeColorMap={badgeMap} />
    </div>
  );
}
