import React, { useState } from 'react';

/**
 * @typedef {Object} NavItem
 * @property {string} id
 * @property {string} label
 * @property {React.ReactNode} icon
 * @property {string} [route]
 * @property {boolean} [active]
 * @property {() => void} [onClick]
 * @property {string|number} [badge]
 */

/**
 * @param {Object} props
 * @param {React.ReactNode} [props.logo]
 * @param {string} props.productName
 * @param {string} [props.subtitle]
 * @param {string} [props.badgeText]
 * @param {NavItem[]} props.navItems
 * @param {Object} [props.user]
 * @param {string} [props.user.name]
 * @param {string} [props.user.email]
 * @param {string} [props.user.avatarUrl]
 * @param {string} [props.user.initials]
 * @param {() => void} [props.onLogout]
 * @param {string} [props.logoutLabel]
 * @param {string} [props.className]
 */
export const Sidebar = ({
  logo,
  productName,
  subtitle,
  badgeText,
  navItems = [],
  user,
  onLogout,
  logoutLabel = 'Logout',
  className = '',
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <aside
      style={{ width: '256px', minWidth: '256px', backgroundColor: '#0E1826' }}
      className={`w-64 min-w-[16rem] h-full flex flex-col justify-between bg-[#0E1826] text-[#F6F5F1] select-none border-r border-[#16233B] ${className}`}
    >
      {/* Top Section */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Header Branding */}
        <div className="p-5 border-b border-[#16233B]/60 space-y-3">
          <div className="flex items-center gap-3">
            {logo ? (
              <div className="shrink-0 flex items-center justify-center">
                {logo}
              </div>
            ) : (
              <div className="w-8 h-8 rounded bg-[#B9812E]/20 text-[#B9812E] font-bold font-mono flex items-center justify-center border border-[#B9812E]/40 text-sm">
                {productName ? productName.charAt(0) : 'P'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold tracking-wider uppercase text-white truncate font-mono">
                {productName}
              </h2>
              {subtitle && (
                <p className="text-[11px] text-[#5B6B79] uppercase tracking-widest font-mono truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Pill Badge */}
          {badgeText && (
            <div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wide uppercase bg-[#B9812E]/15 text-[#B9812E] border border-[#B9812E]/30">
                {badgeText}
              </span>
            </div>
          )}
        </div>

        {/* Navigation List */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = Boolean(item.active);
            return (
              <button
                key={item.id || item.label}
                type="button"
                onClick={() => {
                  if (item.onClick) item.onClick();
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-xs font-medium tracking-normal transition-all duration-150 ${
                  isActive
                    ? 'bg-[#16233B] text-white shadow-sm'
                    : 'text-[#8796A5] hover:text-white hover:bg-[#16233B]/40'
                }`}
              >
                {/* Icon wrapper: active gets Timecard Brass accent */}
                <span
                  className={`shrink-0 flex items-center justify-center w-5 h-5 transition-colors duration-150 ${
                    isActive ? 'text-[#B9812E]' : 'text-[#5B6B79]'
                  }`}
                >
                  {item.icon}
                </span>

                <span className="flex-1 text-left truncate">{item.label}</span>

                {item.badge && (
                  <span
                    className={`ml-auto text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                      isActive
                        ? 'bg-[#B9812E]/20 text-[#B9812E] border-[#B9812E]/40'
                        : 'bg-[#16233B] text-[#8796A5] border-[#5B6B79]/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Anchored User Section */}
      <div className="p-4 border-t border-[#16233B]/60 bg-[#0E1826] space-y-3">
        {user && (
          <div className="flex items-center gap-3 px-1">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || 'User'}
                className="w-9 h-9 rounded-full object-cover border border-[#D8D3C7]/20"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#16233B] border border-[#5B6B79]/30 text-[#F6F5F1] font-mono text-xs font-semibold flex items-center justify-center">
                {user.initials ||
                  (user.name ? user.name.slice(0, 2).toUpperCase() : 'U')}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">
                {user.name}
              </p>
              <p className="text-[11px] font-mono text-[#5B6B79] truncate">
                {user.email}
              </p>
            </div>
          </div>
        )}

        {/* Full-width Logout Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[6px] border border-[#B3432E]/30 bg-[#B3432E]/10 hover:bg-[#B3432E]/20 text-[#B3432E] text-xs font-medium transition-colors"
          >
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
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>{logoutLabel}</span>
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile Drawer Trigger Bar */}
      <div className="md:hidden flex items-center justify-between p-3 bg-[#0E1826] border-b border-[#16233B]">
        <span className="text-xs font-mono font-bold text-white uppercase">
          {productName}
        </span>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded text-[#8796A5] hover:text-white bg-[#16233B]"
          aria-label="Open navigation menu"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block">{sidebarContent}</div>

      {/* Mobile Overlay Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
