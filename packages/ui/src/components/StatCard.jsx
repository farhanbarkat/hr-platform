import React from 'react';

/**
 * @typedef {'success' | 'warning' | 'error' | 'neutral'} DeltaVariant
 */

/**
 * @param {Object} props
 * @param {string} props.label
 * @param {string|number} props.value
 * @param {string} [props.deltaText]
 * @param {DeltaVariant} [props.deltaVariant='neutral']
 * @param {string} [props.caption]
 * @param {string} [props.className]
 */
export const StatCard = ({
  label,
  value,
  deltaText,
  deltaVariant = 'neutral',
  caption,
  className = '',
}) => {
  const variantStyles = {
    success: 'bg-[#2E7D5B]/15 text-[#2E7D5B] border-[#2E7D5B]/30',
    warning: 'bg-[#C68A2E]/15 text-[#C68A2E] border-[#C68A2E]/30',
    error: 'bg-[#B3432E]/15 text-[#B3432E] border-[#B3432E]/30',
    neutral: 'bg-[#16233B]/10 text-[#5B6B79] border-[#D8D3C7]',
  };

  return (
    <div
      style={{
        clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
      }}
      className={`relative p-5 bg-white border border-[#D8D3C7] shadow-2xs space-y-2 select-none ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono tracking-wider text-[#5B6B79] uppercase truncate">
          {label}
        </span>
      </div>

      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-3xl font-bold font-mono text-[#16233B] tracking-tight">
          {value}
        </span>

        {deltaText && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
              variantStyles[deltaVariant] || variantStyles.neutral
            }`}
          >
            {deltaText}
          </span>
        )}
      </div>

      {caption && (
        <p className="text-xs text-[#5B6B79] font-sans pt-1 border-t border-[#F6F5F1] truncate">
          {caption}
        </p>
      )}
    </div>
  );
};