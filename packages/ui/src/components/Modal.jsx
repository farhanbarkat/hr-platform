import React, { useEffect } from 'react';
import { cn } from '../utils/utils.js';

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'sm', // 'sm' = 480px, 'md' = 720px
  isIrreversible = false,
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isIrreversible) onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isIrreversible, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isIrreversible) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0E1826]/60 backdrop-blur-[2px]"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'w-full bg-white border border-[#D8D3C7] rounded-[12px] shadow-[0_8px_24px_rgba(22,35,59,0.16)] flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150',
          size === 'sm' ? 'max-w-[480px]' : 'max-w-[720px]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8D3C7]">
          <h2 className="text-xl font-semibold text-[#16233B] font-sans">{title}</h2>
          {!isIrreversible && (
            <button
              onClick={onClose}
              className="text-[#5B6B79] hover:text-[#16233B] p-1.5 rounded-[6px] hover:bg-black/[0.04] transition-colors"
              aria-label="Close modal"
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto text-sm text-[#16233B] font-sans">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#D8D3C7] bg-[#F6F5F1]/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};