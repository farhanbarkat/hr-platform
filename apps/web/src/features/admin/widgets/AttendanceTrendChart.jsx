import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export default function AttendanceTrendChart({ data = [], loading = false }) {
  // Ensure we always have an array of 7 points even if loading
  const chartData = data && data.length > 0 ? data : [
    { day: 'Mon', present: 0, absent: 0 },
    { day: 'Tue', present: 0, absent: 0 },
    { day: 'Wed', present: 0, absent: 0 },
    { day: 'Thu', present: 0, absent: 0 },
    { day: 'Fri', present: 0, absent: 0 },
    { day: 'Sat', present: 0, absent: 0 },
    { day: 'Sun', present: 0, absent: 0 },
  ];

  return (
    <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 border-b border-[#F4F1EA]">
        <div>
          <span className="text-[9.5px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            WORKFORCE TELEMETRY
          </span>
          <h3 className="text-sm font-bold text-[#16233B] mt-0.5">7-Day Attendance Velocity</h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E3DED4] text-[#8C5D17]">
          {loading ? 'SYNCING...' : 'LIVE SYNC ACTIVE'}
        </span>
      </div>

      <div className="h-[220px] w-full pt-4 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="presentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C98A2C" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#C98A2C" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE1" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="#8C9BAE"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              fontFamily="monospace"
            />
            <YAxis
              stroke="#8C9BAE"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              fontFamily="monospace"
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0B1320',
                borderColor: '#162235',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '11px',
                fontFamily: 'monospace',
              }}
            />
            <Area
              type="monotone"
              dataKey="present"
              name="Present Staff"
              stroke="#C98A2C"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#presentGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}