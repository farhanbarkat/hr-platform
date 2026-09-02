import React from 'react';
import { cn } from '../utils/utils.js';

export const Button = React.forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  ...props
}, ref) => {
  // Base 6px radius, min 44x44 tap target per Section A.5
  const baseStyles = 'inline-flex items-center justify-center font-sans font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#B9812E]/30 disabled:opacity-40 disabled:cursor-not-allowed rounded-[6px] min-h-[44px] min-w-[44px] select-none';

  const variants = {
    primary: 'bg-[#B9812E] text-white hover:bg-[#A37126] active:bg-[#8F6120] border-0 shadow-[0_1px_2px_rgba(22,35,59,0.08)]',
    secondary: 'bg-transparent text-[#16233B] border border-[#D8D3C7] hover:bg-black/[0.04] active:bg-black/[0.08]',
    destructive: 'bg-[#B3432E] text-white hover:bg-[#9B3A27] active:bg-[#853121] border-0 shadow-[0_1px_2px_rgba(22,35,59,0.08)]',
    ghost: 'bg-transparent text-[#5B6B79] hover:text-[#16233B] hover:bg-black/[0.04] active:bg-black/[0.08] border-0',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
});

Button.displayName = 'Button';