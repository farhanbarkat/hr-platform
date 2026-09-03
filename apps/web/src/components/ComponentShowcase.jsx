import React from 'react';
import { StatCard, AreaTrendChart, DonutChart } from '@repo/ui';

export default function ComponentShowcase() {
  // SA-FE-004 Mock Data
  const xMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
  const trendSeries = [
    { name: 'Active Companies', color: '#B9812E', data: [12, 18, 25, 34, 45, 60, 72, 85] },
    { name: 'Total Headcount', color: '#16233B', data: [120, 240, 390, 520, 780, 1100, 1420, 1890] },
  ];

  // SA-FE-005 Mock Data
  const planDistribution = [
    { label: 'Enterprise', value: 45, percent: '45.0%', color: '#B9812E' },
    { label: 'Professional', value: 35, percent: '35.0%', color: '#16233B' },
    { label: 'Starter', value: 20, percent: '20.0%', color: '#5B6B79' },
  ];

  return (
    <div className="min-h-screen bg-[#F6F5F1] p-8 space-y-8">
      <div>
        <h1 className="text-xl font-bold font-mono text-[#16233B]">
          SA-FE-003, SA-FE-004, SA-FE-005 Component Verification
        </h1>
        <p className="text-xs font-mono text-[#5B6B79] mt-1">
          Stat Cards + Two-Series Area Trend Chart + Donut Chart with Legend
        </p>
      </div>

      {/* SA-FE-003: Stat Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Tenants"
          value="128"
          deltaText="+12% vs last month"
          deltaVariant="success"
          caption="Active organizations"
        />
        <StatCard
          label="System Health"
          value="99.98%"
          deltaText="Normal"
          deltaVariant="neutral"
          caption="All services operational"
        />
        <StatCard
          label="Pending Audits"
          value="14"
          deltaText="3 High-Priority"
          deltaVariant="error"
          caption="Requires immediate action"
        />
        <StatCard
          label="API Usage"
          value="84.2%"
          deltaText="Near Limit"
          deltaVariant="warning"
          caption="Rate threshold warning"
        />
      </div>

      {/* SA-FE-004 & SA-FE-005: Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AreaTrendChart
            title="Tenant Growth & Headcount Trend"
            xLabels={xMonths}
            series={trendSeries}
          />
        </div>
        <div>
          <DonutChart
            title="Plan Tier Distribution"
            segments={planDistribution}
          />
        </div>
      </div>
    </div>
  );
}