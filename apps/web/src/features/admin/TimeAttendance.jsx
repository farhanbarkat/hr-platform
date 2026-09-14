import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PERMISSIONS } from '../../config/permissions.js';

export default function TimeAttendance() {
  const { user, isSuperAdmin, hasPermission } = useAuth();
  
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const canManage = isSuperAdmin || user?.role === 'COMPANY_ADMIN' || user?.role === 'ADMIN' || hasPermission(PERMISSIONS.ATTENDANCE.MANAGE);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/attendance?date=${selectedDate}&limit=200`);
      const raw = res.data?.data || res.data || [];
      const list = Array.isArray(raw) ? raw : (raw.records || raw.data || []);
      setRecords(list);
    } catch (err) {
      console.error('Failed to load attendance ledger:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate]);

  // Format HH:MM AM/PM safely
  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Metrics calculation
  const onFloorCount = records.filter((r) => (r.clockIn || r.checkIn) && !(r.clockOut || r.checkOut)).length;
  const lateCount = records.filter((r) => r.isLate).length;
  const missingCount = records.filter((r) => r.isMissingCheckout).length;

  const filteredRecords = records.filter((rec) => {
    const term = search.toLowerCase();
    const empName = `${rec.employeeId?.firstName || ''} ${rec.employeeId?.lastName || ''}`.toLowerCase();
    const empCode = (rec.employeeId?.employeeCode || rec.employeeId?.employeeId || '').toLowerCase();
    const matchesSearch = empName.includes(term) || empCode.includes(term);

    const matchesStatus = statusFilter === 'ALL' || rec.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-12">
      
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3DED4] gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            TELEMETRY ENGINE // TIME & ATTENDANCE
          </span>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
            Shift Attendance Ledger
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Audit logs for operational shifts, biometric punches, and web clock events.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 bg-white border border-[#D8D3C7] rounded text-xs font-mono font-bold text-[#16233B] focus:outline-none focus:border-[#8C5D17] shadow-2xs cursor-pointer"
          />
          <button
            onClick={fetchAttendance}
            className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#FAF4E8] border border-[#D8D3C7] text-[#8C5D17] text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs"
          >
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* 2. Top Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">TOTAL LOGGED</span>
          <div className="text-xl font-bold font-mono text-[#16233B] mt-1">{records.length}</div>
          <div className="text-[10px] text-[#728294] mt-0.5">Shift punch records</div>
        </div>

        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">CURRENTLY ON FLOOR</span>
          <div className="text-xl font-bold font-mono text-[#1E7E34] mt-1">{onFloorCount}</div>
          <div className="text-[10px] text-[#1E7E34] mt-0.5">Active clocked-in staff</div>
        </div>

        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">LATE ARRIVALS</span>
          <div className="text-xl font-bold font-mono text-[#8C5D17] mt-1">{lateCount}</div>
          <div className="text-[10px] text-[#8C5D17] mt-0.5">Past grace threshold</div>
        </div>

        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">MISSING CHECKOUT</span>
          <div className="text-xl font-bold font-mono text-[#B83E28] mt-1">{missingCount}</div>
          <div className="text-[10px] text-[#B83E28] mt-0.5">Unclosed work sessions</div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="bg-white border border-[#E3DED4] rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="w-full sm:max-w-xs">
          <input
            type="text"
            placeholder="Search employee name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded text-xs focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/40 font-sans"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-[10px] font-mono uppercase text-[#728294]">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-[#D8D3C7] rounded text-xs font-mono focus:outline-none focus:border-[#8C5D17] bg-white"
          >
            <option value="ALL">ALL STATUSES</option>
            <option value="PRESENT">PRESENT</option>
            <option value="LATE">LATE</option>
            <option value="HALF_DAY">HALF DAY</option>
            <option value="ABSENT">ABSENT</option>
          </select>
        </div>
      </div>

      {/* 4. Ledger Table */}
      <div className="bg-white border border-[#E3DED4] rounded-lg overflow-hidden shadow-2xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E3DED4] bg-[#FAF8F5] text-[10px] font-mono uppercase tracking-wider text-[#728294]">
              <th className="py-3 px-4">Employee</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Clock In</th>
              <th className="py-3 px-4">Clock Out</th>
              <th className="py-3 px-4">Total Hours</th>
              <th className="py-3 px-4">Source</th>
              <th className="py-3 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFECE6] text-xs">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center font-mono text-xs text-[#728294]">
                  Querying tenant attendance records...
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center font-mono text-xs text-[#728294]">
                  No attendance entries recorded for {selectedDate}.
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec) => {
                const inTime = rec.clockIn || rec.checkIn;
                const outTime = rec.clockOut || rec.checkOut;
                const totalHours = rec.totalWorkHours || rec.workHours || (outTime && inTime ? ((new Date(outTime) - new Date(inTime)) / 36e5).toFixed(1) : '--');

                return (
                  <tr key={rec._id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#16233B]">
                        {rec.employeeId?.firstName 
                          ? `${rec.employeeId.firstName} ${rec.employeeId.lastName || ''}`
                          : rec.employeeName || 'Staff Member'}
                      </div>
                      <div className="text-[10px] font-mono text-[#728294]">
                        {rec.employeeId?.employeeCode || rec.employeeId?.employeeId || 'ID-N/A'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[#5B6B79]">
                      {new Date(rec.date || rec.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold text-[#16233B]">
                      {formatTime(inTime)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[#5B6B79]">
                      {formatTime(outTime)}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[#16233B]">
                      {totalHours !== '--' ? `${totalHours} hrs` : '--'}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[10px] text-[#728294]">
                      {rec.source || 'WEB'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <span className={`inline-block px-2 py-0.5 text-[9px] font-mono rounded font-bold uppercase ${
                        rec.status === 'PRESENT' ? 'bg-[#EBF7F0] text-[#1E7E34] border border-[#C6EAD3]' :
                        rec.status === 'LATE' ? 'bg-[#FAF4E8] text-[#8C5D17] border border-[#E3DED4]' :
                        rec.status === 'HALF_DAY' ? 'bg-[#FAF4E8] text-[#8C5D17] border border-[#E3DED4]' :
                        'bg-[#FDEEEB] text-[#B83E28] border border-[#F5C2BA]'
                      }`}>
                        {rec.status || 'RECORDED'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}