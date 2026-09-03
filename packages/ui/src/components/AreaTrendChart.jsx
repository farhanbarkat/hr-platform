import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/**
 * @typedef {Object} SeriesItem
 * @property {string} name
 * @property {string} color
 * @property {number[]} data
 */

/**
 * @param {Object} props
 * @param {string[]} props.xLabels
 * @param {SeriesItem[]} props.series
 * @param {string} [props.title]
 * @param {string} [props.className]
 */
export const AreaTrendChart = ({
  xLabels = [],
  series = [],
  title,
  className = '',
}) => {
  const chartData = xLabels.map((label, index) => {
    const item = { label };
    series.forEach((s) => {
      item[s.name] = s.data[index] ?? 0;
    });
    return item;
  });

  return (
    <div
      className={`p-5 bg-white border border-[#D8D3C7] rounded-[8px] space-y-4 shadow-2xs ${className}`}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        {title && (
          <h3 className="text-xs font-mono font-bold tracking-wider text-[#16233B] uppercase">
            {title}
          </h3>
        )}

        {/* Dynamic Legend */}
        <div className="flex items-center gap-4 text-xs font-sans">
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-[#5B6B79] font-medium text-[11px]">{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {series.map((s, idx) => (
                <linearGradient
                  key={s.name}
                  id={`area-grad-${idx}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.0} />
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E0D5" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: '#D8D3C7' }}
              tick={{ fill: '#5B6B79', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: '#D8D3C7' }}
              tick={{ fill: '#5B6B79', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0E1826',
                borderColor: '#16233B',
                borderRadius: '6px',
                color: '#F6F5F1',
                fontSize: '11px',
                fontFamily: 'IBM Plex Mono',
              }}
              itemStyle={{ color: '#F6F5F1' }}
            />
            {series.map((s, idx) => (
              <Area
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#area-grad-${idx})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};