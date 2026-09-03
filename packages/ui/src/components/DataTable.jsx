import React from 'react';

/**
 * @typedef {'text' | 'mono' | 'actor' | 'badge' | 'action'} ColumnType
 *
 * @typedef {Object} ColumnDef
 * @property {string} key
 * @property {string} label
 * @property {ColumnType} [type='text']
 * @property {'left' | 'center' | 'right'} [align='left']
 * @property {(value: any, row: any) => React.ReactNode} [render]
 * @property {string} [actionLabel]
 * @property {(row: any) => void} [onAction]
 */

export const DataTable = ({
  columns = [],
  data = [],
  badgeColorMap = {},
  emptyMessage = 'No records found.',
  isLoading = false,
  className = '',
}) => {
  const defaultBadgeStyles = {
    green: 'bg-[#2E7D5B]/15 text-[#2E7D5B] border-[#2E7D5B]/30',
    blue: 'bg-[#3A6EA5]/15 text-[#3A6EA5] border-[#3A6EA5]/30',
    amber: 'bg-[#C68A2E]/15 text-[#C68A2E] border-[#C68A2E]/30',
    red: 'bg-[#B3432E]/15 text-[#B3432E] border-[#B3432E]/30',
    neutral: 'bg-[#16233B]/10 text-[#5B6B79] border-[#D8D3C7]',
  };

  const renderCellContent = (col, row) => {
    const rawVal = row[col.key];

    if (col.render) {
      return col.render(rawVal, row);
    }

    switch (col.type) {
      case 'mono':
        return (
          <span className="font-mono text-xs text-[#16233B]">
            {rawVal ? `[${rawVal}]` : '—'}
          </span>
        );

      case 'actor': {
        const name = row.actorName || row.name || rawVal || 'Unknown';
        const email = row.actorEmail || row.email || '';
        const initials = row.actorInitials || name.slice(0, 2).toUpperCase();

        return (
          <div className="flex items-center gap-2.5">
            {row.actorAvatar ? (
              <img
                src={row.actorAvatar}
                alt={name}
                className="w-7 h-7 rounded-full object-cover border border-[#D8D3C7]"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#16233B] text-[#F6F5F1] font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#16233B] truncate leading-tight">
                {name}
              </p>
              {email && (
                <p className="text-[11px] font-mono text-[#5B6B79] truncate">
                  {email}
                </p>
              )}
            </div>
          </div>
        );
      }

      case 'badge': {
        const badgeColorKey = badgeColorMap[rawVal] || 'neutral';
        const styleClass = defaultBadgeStyles[badgeColorKey] || defaultBadgeStyles.neutral;

        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-semibold tracking-wide uppercase border ${styleClass}`}
          >
            {rawVal}
          </span>
        );
      }

      case 'action':
        return (
          <button
            type="button"
            onClick={() => col.onAction && col.onAction(row)}
            className="text-xs font-semibold text-[#B9812E] hover:text-[#91621E] hover:underline cursor-pointer transition-colors"
          >
            {col.actionLabel || 'View'}
          </button>
        );

      case 'text':
      default:
        return <span className="text-xs text-[#16233B]">{rawVal ?? '—'}</span>;
    }
  };

  return (
    <div className={`w-full overflow-hidden border border-[#D8D3C7] rounded-[8px] bg-white shadow-2xs ${className}`}>
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-[#D8D3C7] bg-[#F6F5F1]/80">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-[10px] font-mono font-bold tracking-wider uppercase text-[#5B6B79] ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E0D5]">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-xs font-mono text-[#5B6B79]">
                  Loading records...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-xs text-[#5B6B79]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={row.id || row._id || idx} className="hover:bg-[#F6F5F1]/50 transition-colors">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3.5 align-middle ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                      }`}
                    >
                      {renderCellContent(col, row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};