import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

/**
 * @typedef {Object} DonutSegment
 * @property {string} label
 * @property {number} value
 * @property {number|string} percent
 * @property {string} color
 */

/**
 * @param {Object} props
 * @param {DonutSegment[]} props.segments
 * @param {string} [props.title]
 * @param {string} [props.className]
 */
export const DonutChart = ({ segments = [], title, className = '' }) => {
  return (
    <div
      className={`p-5 bg-white border border-[#D8D3C7] rounded-[8px] space-y-4 shadow-2xs select-none ${className}`}
    >
      {title && (
        <h3 className="text-xs font-mono font-bold tracking-wider text-[#16233B] uppercase">
          {title}
        </h3>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut Ring Chart */}
        <div className="w-44 h-44 shrink-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0E1826',
                  borderColor: '#16233B',
                  borderRadius: '6px',
                  color: '#F6F5F1',
                  fontSize: '11px',
                  fontFamily: 'IBM Plex Mono',
                }}
              />
              <Pie
                data={segments}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={68}
                paddingAngle={2}
                stroke="#FFFFFF"
                strokeWidth={1.5}
              >
                {segments.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Right Legend */}
        <div className="flex-1 w-full space-y-2">
          {segments.map((seg) => (
            <div
              key={seg.label}
              className="flex items-center justify-between py-1 border-b border-[#F6F5F1] last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-[2px] shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-xs text-[#16233B] font-medium truncate">
                  {seg.label}
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-[#16233B] ml-4">
                {typeof seg.percent === 'number' ? `${seg.percent}%` : seg.percent}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};