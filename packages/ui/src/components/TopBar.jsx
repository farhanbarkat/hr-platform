import React from 'react';

/**
 * @typedef {Object} TopBarProps
 * @property {string} [searchPlaceholder]
 * @property {string} [searchValue]
 * @property {(value: string) => void} [onSearchChange]
 * @property {(e: React.FormEvent) => void} [onSearchSubmit]
 * @property {boolean} [showSearch=true]
 * @property {boolean} [showNotifications=true]
 * @property {number} [unreadCount=0]
 * @property {() => void} [onNotificationsClick]
 * @property {boolean} [showHelp=true]
 * @property {() => void} [onHelpClick]
 * @property {React.ReactNode} [actions]
 * @property {React.ReactNode} [leading]
 * @property {string} [className]
 */

export const TopBar = ({
  searchPlaceholder = 'Search commands or entities...',
  searchValue,
  onSearchChange,
  onSearchSubmit,
  showSearch = true,
  showNotifications = true,
  unreadCount = 0,
  onNotificationsClick,
  showHelp = true,
  onHelpClick,
  actions,
  leading,
  className = '',
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearchSubmit) onSearchSubmit(e);
  };

  return (
    <header
      className={`h-16 px-6 bg-[#F6F5F1] border-b border-[#D8D3C7] flex items-center justify-between gap-4 sticky top-0 z-30 select-none ${className}`}
    >
      {/* Left Slot: Optional Leading element (e.g., Breadcrumb or mobile toggle) */}
      <div className="flex items-center gap-4 min-w-0">
        {leading}

        {showSearch && (
          <form onSubmit={handleSubmit} className="relative w-72 sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5B6B79]">
              <svg
                style={{ width: '16px', height: '16px', minWidth: '16px' }}
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-[#D8D3C7] rounded-[6px] text-[#16233B] placeholder-[#8796A5] font-sans focus:outline-none focus:border-[#B9812E] focus:ring-1 focus:ring-[#B9812E] transition-all shadow-2xs"
            />
            <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono uppercase bg-[#F6F5F1] text-[#5B6B79] border border-[#D8D3C7] rounded">
                ⌘K
              </kbd>
            </div>
          </form>
        )}
      </div>

      {/* Right Slot: Notifications, Help, Custom Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {actions}

        {showNotifications && (
          <button
            type="button"
            onClick={onNotificationsClick}
            aria-label="Open notifications"
            className="relative p-2 rounded-[6px] text-[#5B6B79] hover:text-[#16233B] hover:bg-[#E4E0D5]/60 transition-colors cursor-pointer"
          >
            <svg
              style={{ width: '18px', height: '18px', minWidth: '18px' }}
              className="w-[18px] h-[18px] shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>

            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[15px] h-[15px] px-0.5 text-[9px] font-mono font-bold leading-none bg-[#B3432E] text-white rounded-full ring-2 ring-[#F6F5F1]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        )}

        {showHelp && (
          <button
            type="button"
            onClick={onHelpClick}
            aria-label="Help documentation"
            className="p-2 rounded-[6px] text-[#5B6B79] hover:text-[#16233B] hover:bg-[#E4E0D5]/60 transition-colors cursor-pointer"
          >
            <svg
              style={{ width: '18px', height: '18px', minWidth: '18px' }}
              className="w-[18px] h-[18px] shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
};