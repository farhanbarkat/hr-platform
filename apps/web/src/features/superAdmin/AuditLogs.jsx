import React, { useState, useMemo } from 'react';
import { DataTable, Button } from '@repo/ui';

export default function AuditLogs() {
  const [actorFilter, setActorFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const rawLogs = [
    { id: '1', timestamp: '2026-09-03 14:12', actorName: 'Sarah Connor', actorEmail: 'admin@apex.io', tenant: 'Apex Corp', event: 'PROVISIONED' },
    { id: '2', timestamp: '2026-09-03 13:45', actorName: 'Root System', actorEmail: 'root@platform.io', tenant: 'GlobalTech', event: 'IMPERSONATION' },
    { id: '3', timestamp: '2026-09-03 11:20', actorName: 'John Miller', actorEmail: 'jm@cloudlogic.com', tenant: 'CloudLogic', event: 'APPROVED' },
    { id: '4', timestamp: '2026-09-02 09:05', actorName: 'David Lee', actorEmail: 'd.lee@quantum.org', tenant: 'Quantum Inc', event: 'SUSPENDED' },
    { id: '5', timestamp: '2026-09-02 08:30', actorName: 'Security Bot', actorEmail: 'sec@platform.io', tenant: 'All Tenants', event: 'INFO' },
    { id: '6', timestamp: '2026-09-01 16:40', actorName: 'Sarah Connor', actorEmail: 'admin@apex.io', tenant: 'Apex Corp', event: 'CONFIG_CHANGE' },
  ];

  const filteredLogs = useMemo(() => {
    return rawLogs.filter((l) => {
      const matchActor = actorFilter === 'ALL' || l.actorName === actorFilter;
      const matchCompany = companyFilter === 'ALL' || l.tenant === companyFilter;
      return matchActor && matchCompany;
    });
  }, [actorFilter, companyFilter]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns = [
    { key: 'timestamp', label: 'Timestamp', type: 'mono' },
    { key: 'actor', label: 'Actor', type: 'actor' },
    { key: 'tenant', label: 'Tenant Target', type: 'text' },
    { key: 'event', label: 'Event Action', type: 'badge' },
    { key: 'action', label: 'Trace', align: 'right', render: (_, r) => <button onClick={() => alert(`Trace ID: ${r.id}`)} className="text-xs font-mono text-[#B9812E] hover:underline">Inspect</button> },
  ];

  const badgeMap = {
    PROVISIONED: 'green',
    APPROVED: 'green',
    IMPERSONATION: 'blue',
    INFO: 'blue',
    CONFIG_CHANGE: 'amber',
    SUSPENDED: 'red',
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#D8D3C7] pb-4">
        <h1 className="text-xl font-bold font-mono text-[#16233B]">Audit Logs</h1>
        <p className="text-xs font-mono text-[#5B6B79] mt-0.5">Immutable tenant and super-admin security activity trail</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border border-[#D8D3C7] rounded-[8px]">
        <div className="flex items-center gap-4 text-xs font-mono">
          <label className="flex items-center gap-2">
            <span className="text-[#5B6B79]">Tenant:</span>
            <select value={companyFilter} onChange={(e) => { setCompanyFilter(e.target.value); setCurrentPage(1); }} className="border border-[#D8D3C7] rounded px-2 py-1 bg-white">
              <option value="ALL">All Tenants</option>
              <option value="Apex Corp">Apex Corp</option>
              <option value="GlobalTech">GlobalTech</option>
              <option value="CloudLogic">CloudLogic</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-[#5B6B79]">Actor:</span>
            <select value={actorFilter} onChange={(e) => { setActorFilter(e.target.value); setCurrentPage(1); }} className="border border-[#D8D3C7] rounded px-2 py-1 bg-white">
              <option value="ALL">All Actors</option>
              <option value="Sarah Connor">Sarah Connor</option>
              <option value="Root System">Root System</option>
            </select>
          </label>
        </div>
        <span className="text-xs font-mono text-[#5B6B79]">{filteredLogs.length} events</span>
      </div>

      <DataTable columns={columns} data={paginatedLogs} badgeColorMap={badgeMap} />

      <div className="flex justify-between items-center text-xs font-mono pt-2">
        <span className="text-[#5B6B79]">Page {currentPage} of {totalPages}</span>
        <div className="flex gap-2">
          <Button variant="secondary" className="text-xs py-1 px-3" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Prev</Button>
          <Button variant="secondary" className="text-xs py-1 px-3" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
