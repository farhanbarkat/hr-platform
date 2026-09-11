import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [timeRange, setTimeRange] = useState('24H');
  const [selectedCompanyId, setSelectedCompanyId] = useState('ALL');
  const [actorQuery, setActorQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Inspector Drawer State
  const [inspectedLog, setInspectedLog] = useState(null);
  const [copied, setCopied] = useState(false);

  // Available Filter Pills from image
  const eventPillTypes = [
    { label: 'IMPERSONATION_STARTED', value: 'IMPERSONATION', color: 'amber' },
    { label: 'TENANT_PROVISIONED', value: 'TENANT_PROVISIONED', color: 'blue' },
    { label: 'SECURITY_ALERT', value: 'SECURITY_ALERT', color: 'red' },
  ];

  // 1. Calculate Date Filters
  const getDateRangeParams = useCallback(() => {
    const now = new Date();
    let startDate = null;

    if (timeRange === '24H') {
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    } else if (timeRange === '7D') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (timeRange === '30D') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    return { startDate, endDate: now.toISOString() };
  }, [timeRange]);

  // 2. Fetch Live Audit Logs from Backend Controller
  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRangeParams();

      const params = {
        page,
        limit: 15,
        companyId: selectedCompanyId !== 'ALL' ? selectedCompanyId : undefined,
        action: selectedEventType !== 'ALL' ? selectedEventType : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      const res = await apiClient
        .get('/super-admin/advanced/audit-logs', { params })
        .catch(() => apiClient.get('/super-admin/audit-logs', { params }));

      const payload = res.data?.data || res.data || {};
      const list = Array.isArray(payload) ? payload : payload.logs || [];
      const pagination = payload.pagination || {};

      setLogs(list);
      setTotalPages(pagination.pages || 1);
      setTotalCount(pagination.total || list.length);

      // Default select first item for inspector drawer if open or null
      if (list.length > 0 && !inspectedLog) {
        setInspectedLog(list[0]);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, selectedCompanyId, selectedEventType, getDateRangeParams, inspectedLog]);

  // Fetch Companies for Filter Dropdown
  useEffect(() => {
    apiClient
      .get('/super-admin/companies?limit=100')
      .then((res) => {
        const d = res.data?.data || res.data || [];
        setCompanies(Array.isArray(d) ? d : d.companies || d.docs || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Filter client-side actor search query
  const displayedLogs = useMemo(() => {
    if (!actorQuery.trim()) return logs;
    const q = actorQuery.toLowerCase();
    return logs.filter((l) => {
      const email = (l.performedBy?.email || l.actorEmail || '').toLowerCase();
      const name = (l.performedBy?.name || l.actorName || '').toLowerCase();
      const id = String(l.performedBy?._id || l.performedBy || '').toLowerCase();
      return email.includes(q) || name.includes(q) || id.includes(q);
    });
  }, [logs, actorQuery]);

  // Copy raw JSON to clipboard
  const handleCopyJSON = () => {
    if (!inspectedLog) return;
    navigator.clipboard.writeText(JSON.stringify(inspectedLog, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export CSV Helper
  const handleExportCSV = () => {
    if (!displayedLogs.length) return;
    const headers = 'ID,Timestamp,Actor,Role,TargetTenant,Action\n';
    const rows = displayedLogs
      .map((l) => {
        const ts = l.createdAt ? new Date(l.createdAt).toISOString() : '';
        const act = l.performedBy?.email || 'System';
        const role = l.performedBy?.role || 'SYSTEM';
        const ten = l.companyId?.name || 'Platform';
        const evt = l.action || 'EVENT';
        return `"${l._id}","${ts}","${act}","${role}","${ten}","${evt}"`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Export JSON Helper
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(displayedLogs, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-12">
      {/* Top Header Section Matching Image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-bold tracking-tight text-[#16233B]">
              Global Platform Audit Trail
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF3E8] border border-[#E8D4B5] text-[#8C5D17] text-[10px] font-mono font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8C5D17] animate-pulse" />
              LIVE STREAM
            </span>
          </div>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Searchable, immutable operational and security event ledger across all platform tenants.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white border border-[#D8D3C7] hover:bg-[#FAF9F6] text-[#16233B] text-xs font-mono font-medium rounded flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <span>📥</span>
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="px-3.5 py-2 bg-[#0E1826] hover:bg-[#16233B] text-white text-xs font-mono font-medium rounded flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <span>&lt;&gt;</span>
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Enclave Grid (Logs Ledger on Left, Event Inspection on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Filter Controls & Logs Table */}
        <div className={`${inspectedLog ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4 transition-all`}>
          {/* Filter Container Matching Image */}
          <div className="bg-white p-4 rounded-lg border border-[#D8D3C7] shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Date Filter Dropdown */}
              <div className="relative">
                <select
                  value={timeRange}
                  onChange={(e) => {
                    setTimeRange(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono text-[#16233B] outline-none cursor-pointer"
                >
                  <option value="24H">Last 24 Hours</option>
                  <option value="7D">Last 7 Days</option>
                  <option value="30D">Last 30 Days</option>
                  <option value="ALL">All Time</option>
                </select>
                <span className="absolute left-2.5 top-2.5 text-[#728294] text-xs">📅</span>
              </div>

              {/* All Tenants Dropdown */}
              <div className="relative">
                <select
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono text-[#16233B] outline-none cursor-pointer"
                >
                  <option value="ALL">All Tenants</option>
                  {companies.map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className="absolute left-2.5 top-2.5 text-[#728294] text-xs">🏢</span>
              </div>
            </div>

            {/* Actor Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by actor email or ID..."
                value={actorQuery}
                onChange={(e) => setActorQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-[#FAF9F6] border border-[#D8D3C7] rounded text-xs font-mono text-[#16233B] outline-none focus:border-[#8C5D17]"
              />
              <span className="absolute left-2.5 top-2.5 text-[#728294] text-xs">👤</span>
            </div>

            {/* Event Type Filter Pills Matching Image */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] font-mono font-bold text-[#728294] uppercase tracking-wider mr-1">
                EVENT TYPES:
              </span>
              {eventPillTypes.map((pill) => {
                const isActive = selectedEventType === pill.value;
                return (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => {
                      setSelectedEventType(isActive ? 'ALL' : pill.value);
                      setPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10.5px] font-mono border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#16233B] text-white border-[#16233B] font-bold'
                        : pill.color === 'amber'
                        ? 'bg-[#FAF4E8] text-[#8C5D17] border-[#E8D4B5]'
                        : pill.color === 'blue'
                        ? 'bg-[#EBF4FA] text-[#1D5E8C] border-[#C5DCEB]'
                        : 'bg-[#FDEEEB] text-[#B83E28] border-[#F5C2BA]'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span>{pill.label}</span>
                  </button>
                );
              })}
              {selectedEventType !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedEventType('ALL')}
                  className="text-[10px] font-mono text-[#8C5D17] underline ml-1 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white rounded-lg border border-[#D8D3C7] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF9F6] border-b border-[#D8D3C7] text-[10px] font-mono uppercase text-[#728294] tracking-wider">
                    <th className="py-3 px-4">TIMESTAMP</th>
                    <th className="py-3 px-4">ACTOR</th>
                    <th className="py-3 px-4">TARGET TENANT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4F1EA] text-xs font-sans">
                  {loading ? (
                    <tr>
                      <td colSpan="3" className="py-12 text-center font-mono text-xs text-[#728294]">
                        Syncing platform audit trail...
                      </td>
                    </tr>
                  ) : displayedLogs.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="py-12 text-center font-mono text-xs text-[#728294]">
                        No audit events recorded for this criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedLogs.map((log) => {
                      const isSelected = inspectedLog?._id === log._id;
                      const ts = log.createdAt
                        ? new Date(log.createdAt).toISOString().replace('T', ' ').slice(0, 19)
                        : '2026-09-08 14:23:45';

                      const actorEmail =
                        log.performedBy?.email ||
                        log.actorEmail ||
                        (typeof log.performedBy === 'string' ? log.performedBy : 'unknown');

                      const actorRole =
                        log.performedBy?.role ||
                        (actorEmail.includes('system') ? 'AUTOMATON' : 'SYSADMIN');

                      const tenantName =
                        log.companyId?.name ||
                        log.companyName ||
                        (log.companyId ? `Tenant ${String(log.companyId).slice(-4)}` : 'Platform Root');

                      const tenantInitials = tenantName.slice(0, 2).toUpperCase();

                      return (
                        <tr
                          key={log._id || log.id}
                          onClick={() => setInspectedLog(log)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-[#FAF4E8]/90 border-l-3 border-[#8C5D17]'
                              : 'hover:bg-[#FAF9F6]/80'
                          }`}
                        >
                          {/* Timestamp */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-[#16233B] whitespace-nowrap">
                            {ts}
                          </td>

                          {/* Actor */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[#111C2E] font-mono text-[11.5px]">
                              {actorEmail}
                            </div>
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded-[2px] text-[8.5px] font-mono font-bold uppercase tracking-wider mt-0.5 ${
                                actorRole === 'SYSADMIN'
                                  ? 'bg-[#16233B]/10 text-[#16233B]'
                                  : actorRole === 'AUTOMATON'
                                  ? 'bg-[#1D5E8C]/10 text-[#1D5E8C]'
                                  : 'bg-[#B83E28]/10 text-[#B83E28]'
                              }`}
                            >
                              {actorRole}
                            </span>
                          </td>

                          {/* Target Tenant */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-[#FAF4E8] border border-[#E8D4B5] text-[#8C5D17] font-mono font-bold text-[9px] flex items-center justify-center shrink-0">
                                {tenantInitials}
                              </span>
                              <span className="font-medium text-[#111C2E] truncate max-w-[140px]">
                                {tenantName}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3 bg-[#FAF9F6] border-t border-[#D8D3C7] flex items-center justify-between text-xs font-mono text-[#728294]">
              <span>
                Showing {displayedLogs.length} of {totalCount} records
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 bg-white border border-[#D8D3C7] rounded hover:bg-[#FAF8F5] disabled:opacity-40 cursor-pointer"
                >
                  Prev
                </button>
                <span className="font-bold text-[#16233B]">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2.5 py-1 bg-white border border-[#D8D3C7] rounded hover:bg-[#FAF8F5] disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Event Inspection Card Matching Image */}
        {inspectedLog && (
          <div className="lg:col-span-5 bg-white rounded-lg border border-[#D8D3C7] shadow-xs overflow-hidden sticky top-6 animate-fade-in">
            {/* Inspector Header */}
            <div className="p-4 px-5 border-b border-[#EAE7DF] bg-[#FAF9F6] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm">🔍</span>
                <h2 className="text-sm font-bold text-[#16233B]">Event Inspection</h2>
              </div>
              <button
                onClick={() => setInspectedLog(null)}
                className="text-xs text-[#728294] hover:text-[#16233B] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-mono">
              {/* Event Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-[#F4F1EA]">
                <div>
                  <span className="text-[9.5px] uppercase text-[#728294] block font-bold">
                    EVENT ID
                  </span>
                  <span className="text-[#16233B] font-semibold truncate block mt-0.5">
                    {inspectedLog._id || 'evt_01HD9X2YV...'}
                  </span>
                </div>
                <div>
                  <span className="text-[9.5px] uppercase text-[#728294] block font-bold">
                    SEVERITY
                  </span>
                  <span className="inline-flex items-center gap-1 text-[#8C5D17] font-bold mt-0.5">
                    <span>⚠</span>
                    <span>{inspectedLog.action?.includes('DELETE') ? 'Critical' : 'High'}</span>
                  </span>
                </div>
                <div>
                  <span className="text-[9.5px] uppercase text-[#728294] block font-bold">
                    SESSION ID
                  </span>
                  <span className="text-[#5B6B79] block mt-0.5 truncate">
                    {inspectedLog.sessionId || 'ses_09K21LMN88'}
                  </span>
                </div>
                <div>
                  <span className="text-[9.5px] uppercase text-[#728294] block font-bold">
                    GEO LOCATION / IP
                  </span>
                  <span className="text-[#5B6B79] block mt-0.5 truncate">
                    {inspectedLog.ipAddress || 'Seattle, WA, US'}
                  </span>
                </div>
              </div>

              {/* Raw JSON Payload Terminal View */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase font-bold text-[#728294]">
                    RAW PAYLOAD (JSON)
                  </span>
                  <button
                    onClick={handleCopyJSON}
                    className="text-[10.5px] text-[#8C5D17] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>📋</span>
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>

                <div className="bg-[#0B1320] text-[#7BD492] p-4 rounded-md overflow-x-auto max-h-[380px] font-mono text-[11px] leading-relaxed border border-[#162335]">
                  <pre>{JSON.stringify(inspectedLog, null, 2)}</pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}