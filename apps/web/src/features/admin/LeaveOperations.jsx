import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ApplyLeaveModal from '../leave/ApplyLeaveModal.jsx';

export default function LeaveOperations() {
  const { user, isSuperAdmin } = useAuth();

  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING'); // PENDING | ALL
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchPendingQueue = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/leaves/pending-approvals');
      const list = res.data?.data || res.data || [];
      setPendingRequests(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load leave approvals queue:', err);
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingQueue();
  }, []);

  const handleDecision = async (requestId, decision) => {
    try {
      setActionLoading(requestId);
      setFeedback(null);

      // Multi-stage check: HR vs Manager
      const isHrOrAdmin = isSuperAdmin || user?.role === 'COMPANY_ADMIN' || user?.role === 'ADMIN' || user?.role === 'HR';
      const endpoint = decision === 'APPROVE'
        ? (isHrOrAdmin ? `/leaves/requests/${requestId}/hr-approve` : `/leaves/requests/${requestId}/manager-approve`)
        : `/leaves/requests/${requestId}/reject`;

      await apiClient.patch(endpoint, {
        remarks: decision === 'APPROVE' ? 'Approved through Operational Desk' : 'Rejected by reviewer',
      });

      setFeedback({
        text: `Request successfully ${decision === 'APPROVE' ? 'approved' : 'rejected'}.`,
        ok: true,
      });

      fetchPendingQueue();
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || `Failed to process ${decision.toLowerCase()}.`,
        ok: false,
      });
    } finally {
      setActionLoading(null);
    }
  };

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
            Active Approval Queue: <span className="font-mono font-bold text-[#8C5D17]">{pendingRequests.length}</span> requests pending decision
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
          <span className="text-[10px] font-mono text-[#8C5D17] bg-white px-2 py-0.5 border border-[#E3DED4] rounded">
            Live Queue
          </span>
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
            ) : pendingRequests.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center font-mono text-xs text-[#728294]">
                  Queue clear. No pending leave applications require review.
                </td>
              </tr>
            ) : (
              pendingRequests.map((req) => (
                <tr key={req._id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#16233B]">
                      {req.employeeId?.firstName
                        ? `${req.employeeId.firstName} ${req.employeeId.lastName || ''}`
                        : req.employeeName || 'Staff Member'}
                    </div>
                    <div className="text-[10px] font-mono text-[#728294]">
                      {req.employeeId?.employeeId || req.employeeId?.email || 'EMP'}
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
                    <button
                      onClick={() => handleDecision(req._id, 'APPROVE')}
                      disabled={actionLoading === req._id}
                      className="px-2.5 py-1 bg-[#1E7E34] hover:bg-[#18662A] text-white text-[10px] font-mono font-bold rounded cursor-pointer transition-colors disabled:opacity-50"
                    >
                      {actionLoading === req._id ? '...' : 'APPROVE'}
                    </button>
                    <button
                      onClick={() => handleDecision(req._id, 'REJECT')}
                      disabled={actionLoading === req._id}
                      className="px-2.5 py-1 bg-[#B83E28] hover:bg-[#97321F] text-white text-[10px] font-mono font-bold rounded cursor-pointer transition-colors disabled:opacity-50"
                    >
                      REJECT
                    </button>
                  </td>
                </tr>
              ))
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
    </div>
  );
}