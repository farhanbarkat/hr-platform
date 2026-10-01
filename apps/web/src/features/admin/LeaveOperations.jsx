import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ApplyLeaveModal from '../leave/ApplyLeaveModal.jsx';

export default function LeaveOperations() {
  const { user, isSuperAdmin } = useAuth();

  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [unpaidPrompt, setUnpaidPrompt] = useState(null);

  const fetchPendingQueue = async () => {
    try {
      setLoading(true);
      const [queueResponse, employeeResponse, departmentResponse] = await Promise.all([
        apiClient.get('/leaves/pending-approvals'),
        apiClient.get('/employees?limit=200'),
        apiClient.get('/departments'),
      ]);
      const res = queueResponse;
      if (!res?.data) throw new Error('Access denied or data unavailable');
      const list = res.data?.data || res.data || [];
      setPendingRequests(Array.isArray(list) ? list : []);
      const employeePayload = employeeResponse.data?.data || employeeResponse.data || [];
      const employeeList = Array.isArray(employeePayload) ? employeePayload : employeePayload.employees || [];
      setEmployees(employeeList);
      const departmentPayload = departmentResponse.data?.data || departmentResponse.data || [];
      setDepartments(Array.isArray(departmentPayload) ? departmentPayload : []);
    } catch (err) {
      console.error('Failed to load leave approvals queue:', err);
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => fetchPendingQueue(), 0);
    return () => clearTimeout(timeout);
  }, []);

  const handleDecision = async (requestId, decision) => {
    return processDecision(requestId, decision, false);
  };

  const processDecision = async (requestId, decision, approveAsUnpaid) => {
    try {
      setActionLoading(requestId);
      setFeedback(null);

      const isHrOrAdmin = isSuperAdmin || ['COMPANY_ADMIN', 'ADMIN', 'HR', 'HR_MANAGER'].includes(String(user?.role || '').toUpperCase());
      const endpoint = decision === 'APPROVE'
        ? (isHrOrAdmin ? `/leaves/requests/${requestId}/hr-approve` : `/leaves/requests/${requestId}/manager-approve`)
        : `/leaves/requests/${requestId}/reject`;

      await apiClient.patch(endpoint, {
        notes: decision === 'APPROVE' ? 'Approved through Operational Desk' : undefined,
        reason: decision === 'REJECT' ? 'Rejected by reviewer' : undefined,
        approveAsUnpaid,
      });

      setFeedback({
        text: `Request successfully ${decision === 'APPROVE' ? 'approved' : 'rejected'}.`,
        ok: true,
      });

      setUnpaidPrompt(null);
      setSelectedRequest(null);
      await fetchPendingQueue();
    } catch (err) {
      const message = err.response?.data?.message || `Failed to process ${decision.toLowerCase()}.`;
      if (decision === 'APPROVE' && !approveAsUnpaid && /balance|negative|insufficient|quota/i.test(message)) {
        setUnpaidPrompt(requestId);
      }
      setFeedback({
        text: /already|processed|actioned|status/i.test(message)
          ? `${message} Refreshing the request timeline to show the latest actor.`
          : message,
        ok: false,
      });
      if (/already|processed|actioned|status/i.test(message)) openRequest(selectedRequest?._id || requestId);
    } finally {
      setActionLoading(null);
    }
  };

  const openRequest = async (request) => {
    const requestId = request?._id || request;
    setSelectedRequest(typeof request === 'object' ? request : null);
    try {
      setTimelineLoading(true);
      const response = await apiClient.get(`/leaves/requests/${requestId}/timeline`);
      const payload = response.data?.data || response.data || {};
      setSelectedRequest(payload.leaveRequest || (typeof request === 'object' ? request : null));
      setTimeline(Array.isArray(payload.timeline) ? payload.timeline : []);
    } catch (err) {
      setFeedback({ ok: false, text: err.response?.data?.message || 'Unable to load leave request timeline.' });
    } finally {
      setTimelineLoading(false);
    }
  };

  const employeeById = new Map(employees.map((employee) => [String(employee._id), employee]));
  const visibleRequests = pendingRequests.filter((request) => {
    const employeeId = request.employeeId?._id || request.employeeId;
    const employee = employeeById.get(String(employeeId));
    const departmentId = employee?.department?._id || employee?.departmentId?._id || employee?.departmentId;
    return departmentFilter === 'ALL' || String(departmentId) === String(departmentFilter);
  });
  const isHrOrAdmin = isSuperAdmin || ['COMPANY_ADMIN', 'ADMIN', 'HR', 'HR_MANAGER'].includes(String(user?.role || '').toUpperCase());

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E3DED4] gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            WORKFLOW ENGINE // ABSENCE GOVERNANCE
          </span>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-[#16233B] mt-0.5">
            Leave Operations & Approval Desk
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Active Approval Queue: <span className="font-mono font-bold text-[#8C5D17]">{visibleRequests.length}</span> requests pending decision
          </p>
        </div>

        <button
          onClick={() => setIsApplyModalOpen(true)}
          className="px-4 py-2 bg-[#8C5D17] hover:bg-[#734B12] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs self-start sm:self-auto"
        >
          + APPLY FOR LEAVE
        </button>
      </div>

      {/* Action Feedback Banner */}
      {feedback && (
        <div className={`p-3 text-xs font-mono rounded border ${
          feedback.ok
            ? 'bg-[#EBF7F0] border-[#C6EAD3] text-[#1E7E34]'
            : 'bg-[#FDEEEB] border-[#F5C2BA] text-[#B83E28]'
        }`}>
          {feedback.ok ? '✓ ' : '⚠️ '}
          {feedback.text}
        </div>
      )}

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">QUEUE VOLUME</span>
          <div className="text-xl font-bold font-mono text-[#8C5D17] mt-1">{pendingRequests.length}</div>
          <div className="text-[10px] text-[#728294] mt-0.5">Awaiting line or HR action</div>
        </div>

        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">COMPLEX WORKFLOW MATRIX</span>
          <div className="text-xl font-bold font-mono text-[#1E7E34] mt-1">2-STAGE</div>
          <div className="text-[10px] text-[#728294] mt-0.5">Manager Review &rarr; HR Final Dec</div>
        </div>

        <div className="bg-white border border-[#E3DED4] rounded-lg p-3.5 shadow-2xs">
          <span className="text-[9px] font-mono text-[#728294] uppercase tracking-wider block">POLICY GOVERNANCE</span>
          <div className="text-xl font-bold font-mono text-[#16233B] mt-1">ACTIVE</div>
          <div className="text-[10px] text-[#728294] mt-0.5">Quota deduction on approval</div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white border border-[#E3DED4] rounded-lg overflow-hidden shadow-2xs">
        <div className="px-4 py-3 border-b border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#728294] font-bold">
            Pending Leave Requests Waiting For Action
          </span>
          <div className="flex items-center gap-2">
            <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="rounded border border-[#D8D3C7] bg-white px-2 py-1 text-[10px] font-mono text-[#16233B]">
              <option value="ALL">All departments</option>
              {departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
            </select>
            <span className="text-[10px] font-mono text-[#8C5D17] bg-white px-2 py-0.5 border border-[#E3DED4] rounded">Live Queue</span>
          </div>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E3DED4] text-[10px] font-mono uppercase tracking-wider text-[#728294] bg-[#FAF8F5]/50">
              <th className="py-3 px-4">Applicant</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-4">Reason / Remarks</th>
              <th className="py-3 px-4">Stage</th>
              <th className="py-3 px-4 text-right">Review Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFECE6] text-xs">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center font-mono text-xs text-[#728294]">
                  Synchronizing leave approval queue...
                </td>
              </tr>
            ) : visibleRequests.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center font-mono text-xs text-[#728294]">
                  Queue clear. No pending leave applications require review.
                </td>
              </tr>
            ) : (
              visibleRequests.map((req) => {
                const applicant = employeeById.get(String(req.employeeId?._id || req.employeeId));
                const applicantName = req.employeeId?.firstName
                  ? `${req.employeeId.firstName} ${req.employeeId.lastName || ''}`
                  : applicant ? `${applicant.firstName} ${applicant.lastName || ''}` : req.employeeName || 'Staff Member';
                const canApproveStage = req.status === (isHrOrAdmin ? 'PENDING_HR' : 'PENDING_MANAGER');
                return (
                <tr key={req._id} onClick={() => openRequest(req)} className="cursor-pointer hover:bg-[#FAF8F5]/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#16233B]">
                      {applicantName}
                    </div>
                    <div className="text-[10px] font-mono text-[#728294]">
                      {req.employeeId?.employeeId || applicant?.employeeId || req.employeeId?.email || applicant?.email || 'EMP'}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-[#8C5D17]">
                    {req.leaveType}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono text-[#16233B]">
                      {new Date(req.startDate).toLocaleDateString()} &rarr; {new Date(req.endDate).toLocaleDateString()}
                    </div>
                    <div className="text-[10px] font-mono text-[#728294]">
                      Total: <b className="text-[#16233B]">{req.totalDays} day(s)</b>
                    </div>
                  </td>
                  <td className="py-3 px-4 max-w-xs truncate text-[#5B6B79]" title={req.reason}>
                    {req.reason || 'No justification provided.'}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-block px-2 py-0.5 text-[9px] font-mono rounded font-bold uppercase bg-[#FAF4E8] text-[#8C5D17] border border-[#E3DED4]">
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button type="button" onClick={(event) => { event.stopPropagation(); openRequest(req); }} className="px-2.5 py-1 bg-[#16233B] text-white text-[10px] font-mono font-bold rounded">DETAILS</button>
                    <button
                      onClick={(event) => { event.stopPropagation(); handleDecision(req._id, 'APPROVE'); }}
                      disabled={actionLoading === req._id || !canApproveStage}
                      className="px-2.5 py-1 bg-[#1E7E34] hover:bg-[#18662A] text-white text-[10px] font-mono font-bold rounded cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {actionLoading === req._id ? '...' : canApproveStage ? 'APPROVE' : 'WAITING'}
                    </button>
                    <button
                      onClick={(event) => { event.stopPropagation(); handleDecision(req._id, 'REJECT'); }}
                      disabled={actionLoading === req._id || !canApproveStage}
                      className="px-2.5 py-1 bg-[#B83E28] hover:bg-[#97321F] text-white text-[10px] font-mono font-bold rounded cursor-pointer transition-colors disabled:opacity-50"
                    >
                      REJECT
                    </button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Apply Leave Modal */}
      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        onSuccess={fetchPendingQueue}
      />

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-[#E3DED4] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E3DED4] bg-[#FAF8F5] px-5 py-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#728294]">Leave Request // STATUS TIMELINE</span>
                <h2 className="mt-1 text-lg font-serif font-bold text-[#16233B]">{selectedRequest.leaveTypeId?.name || selectedRequest.leaveType || 'Leave request'}</h2>
              </div>
              <button type="button" onClick={() => { setSelectedRequest(null); setUnpaidPrompt(null); }} className="p-1 text-xl text-[#728294]">&times;</button>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div><span className="block text-[10px] font-mono uppercase text-[#728294]">Applicant</span><b>{selectedRequest.employeeId?.firstName || 'Employee'} {selectedRequest.employeeId?.lastName || ''}</b></div>
                <div><span className="block text-[10px] font-mono uppercase text-[#728294]">Status</span><b className="text-[#8C5D17]">{selectedRequest.status}</b></div>
                <div><span className="block text-[10px] font-mono uppercase text-[#728294]">From</span><b>{new Date(selectedRequest.startDate).toLocaleDateString()}</b></div>
                <div><span className="block text-[10px] font-mono uppercase text-[#728294]">To</span><b>{new Date(selectedRequest.endDate).toLocaleDateString()}</b></div>
              </div>
              <div className="rounded border border-[#E3DED4] p-4">
                <h3 className="mb-3 text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">Audit timeline</h3>
                {timelineLoading ? <p className="text-xs text-[#728294]">Loading status history...</p> : timeline.length === 0 ? <p className="text-xs text-[#728294]">No timeline records found.</p> : <div className="space-y-3">{timeline.map((entry) => <div key={entry._id} className="border-l-2 border-[#8C5D17] pl-3 text-xs"><p className="font-bold text-[#16233B]">{entry.fromStatus || 'SUBMITTED'} &rarr; {entry.toStatus}</p><p className="text-[#5B6B79]">{entry.actedBy?.name || entry.actedBy?.email || 'System'} · {new Date(entry.timestamp).toLocaleString()}</p>{entry.note && <p className="text-[#728294]">{entry.note}</p>}</div>)}</div>}
              </div>
              {unpaidPrompt === selectedRequest._id && <div className="rounded border border-[#E8D4B5] bg-[#FAF4E8] p-3 text-xs text-[#8C5D17]">Leave balance is insufficient. Approving as unpaid requires explicit confirmation.</div>}
              <div className="flex justify-end gap-2 border-t border-[#E3DED4] pt-4">
                <button type="button" onClick={() => setSelectedRequest(null)} className="rounded border border-[#D8D3C7] px-4 py-2 text-xs font-mono font-bold">CLOSE</button>
                {selectedRequest.status === (isHrOrAdmin ? 'PENDING_HR' : 'PENDING_MANAGER') && <>
                  <button type="button" onClick={() => processDecision(selectedRequest._id, 'REJECT', false)} className="rounded bg-[#B83E28] px-4 py-2 text-xs font-mono font-bold text-white">REJECT</button>
                  <button type="button" onClick={() => processDecision(selectedRequest._id, 'APPROVE', unpaidPrompt === selectedRequest._id)} className="rounded bg-[#1E7E34] px-4 py-2 text-xs font-mono font-bold text-white">{unpaidPrompt === selectedRequest._id ? 'APPROVE AS UNPAID' : 'APPROVE'}</button>
                </>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}