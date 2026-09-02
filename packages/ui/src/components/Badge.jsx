import React from 'react';
import { cn } from '../utils/utils.js';

export const Badge = ({
  children,
  variant = 'info',
  className = '',
}) => {
  const variants = {
    success: 'bg-[#2E7D5B]/15 text-[#2E7D5B] border-[#2E7D5B]/30',
    warning: 'bg-[#C68A2E]/15 text-[#C68A2E] border-[#C68A2E]/30',
    error: 'bg-[#B3432E]/15 text-[#B3432E] border-[#B3432E]/30',
    info: 'bg-[#3A6EA5]/15 text-[#3A6EA5] border-[#3A6EA5]/30',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border font-sans tracking-wide uppercase',
        variants[variant],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
};