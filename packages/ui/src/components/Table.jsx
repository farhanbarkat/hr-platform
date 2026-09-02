import React from 'react';
import { cn } from '../utils/utils.js';

export const Table = ({ children, className = '', ...props }) => (
  <div className="w-full overflow-x-auto border border-[#D8D3C7] rounded-[8px] bg-white">
    <table className={cn('w-full border-collapse text-left text-sm', className)} {...props}>
      {children}
    </table>
  </div>
);

export const TableHead = ({ children, className = '', ...props }) => (
  <thead className={cn('bg-[#F6F5F1] border-b border-[#D8D3C7] text-xs font-semibold text-[#5B6B79] uppercase tracking-wider', className)} {...props}>
    {children}
  </thead>
);

export const TableBody = ({ children, className = '', ...props }) => (
  <tbody className={cn('divide-y divide-[#D8D3C7] text-[#16233B]', className)} {...props}>
    {children}
  </tbody>
);

export const TableRow = ({ children, className = '', ...props }) => (
  <tr className={cn('hover:bg-[#F6F5F1]/60 transition-colors', className)} {...props}>
    {children}
  </tr>
);

export const TableCell = ({
  children,
  isMono = false,
  isRight = false,
  className = '',
  ...props
}) => (
  <td
    className={cn(
      'px-4 py-3 text-sm align-middle',
      isMono && 'font-mono text-[13px]',
      isRight && 'text-right',
      className
    )}
    {...props}
  >
    {children}
  </td>
);