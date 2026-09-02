import React from 'react';
import { cn } from '../utils/utils.js';

// Base Card: 10px radius, 1px Ledger Line border, Level 1 elevation, 24px padding
export const Card = ({ children, className = '', ...props }) => (
  <div
    className={cn(
      'bg-white border border-[#D8D3C7] rounded-[10px] p-6 shadow-[0_1px_2px_rgba(22,35,59,0.08)]',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// Section A.4: Signature Element - Notched Stat Card
export const NotchedStatCard = ({
  title,
  value,
  subtitle,
  trend,
  className = '',
  ...props
}) => (
  <div
    className={cn(
      'relative bg-white border border-[#D8D3C7] rounded-[10px] p-6 shadow-[0_1px_2px_rgba(22,35,59,0.08)]',
      className
    )}
    style={{
      clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%)',
    }}
    {...props}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-[#5B6B79] uppercase tracking-wider font-sans">
        {title}
      </span>
      <span className="h-2 w-2 rounded-full bg-[#B9812E]" />
    </div>

    <div className="mt-3 font-mono text-2xl md:text-3xl font-bold text-[#16233B]">
      {value}
    </div>

    {(subtitle || trend) && (
      <div className="mt-2 flex items-center justify-between text-xs text-[#5B6B79]">
        {subtitle && <span className="font-sans">{subtitle}</span>}
        {trend && <span className="font-mono">{trend}</span>}
      </div>
    )}
  </div>
);

// Section A.5: List-Item Card with 3px left-edge semantic status color bar
export const ListItemCard = ({
  children,
  status = 'info',
  className = '',
  ...props
}) => {
  const statusBars = {
    success: 'border-l-[#2E7D5B]',
    warning: 'border-l-[#C68A2E]',
    error: 'border-l-[#B3432E]',
    info: 'border-l-[#3A6EA5]',
  };

  return (
    <div
      className={cn(
        'bg-white border border-[#D8D3C7] border-l-[3px] rounded-[10px] p-4 shadow-[0_1px_2px_rgba(22,35,59,0.08)]',
        statusBars[status],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};