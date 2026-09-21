import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ShiftSwapDesk({ isManagerView = false }) {
  const { user } = useAuth();
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [isProposeModalOpen, setIsProposeModalOpen] = useState(false);

  // Form states for proposing a swap
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    targetEmployeeId: '',
    requesterShiftAssignmentId: '',
    targetShiftAssignmentId: '',
    swapDate: '',
    reason: '',
  });

  const loadSwaps = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/shift-swaps');
      setSwaps(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      console.warn('Shift swaps load notice:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSwaps();
  }, [loadSwaps]);

  // Load colleagues for swap proposal modal
  const openProposeModal = async () => {
    try {
      const empRes = await apiClient.get('/employees');
      const list = empRes.data?.data?.employees || empRes.data?.data || [];
      setEmployees(Array.isArray(list) ? list : []);
      setIsProposeModalOpen(true);
    } catch (err) {
      alert('Failed to load colleague list.');
    }
  };

  // 1. Peer Colleague Accept / Reject
  const handlePeerResponse = async (id, action) => {
    try {
      setActionLoadingId(id);
      await apiClient.put(`/shift-swaps/${id}/peer-response`, { action });
      loadSwaps();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process peer response.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 2. Manager / Shift Incharge Final Approval
  const handleManagerApproval = async (id, action) => {
    const comments = window.prompt(`Enter optional remarks for ${action}:`) || '';
    try {
      setActionLoadingId(id);
      await apiClient.put(`/shift-swaps/${id}/manager-approval`, { action, comments });
      loadSwaps();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process manager review.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // 3. Propose Swap Submit
  const handleProposeSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/shift-swaps', formData);
      setIsProposeModalOpen(false);
      setFormData({
        targetEmployeeId: '',
        requesterShiftAssignmentId: '',
        targetShiftAssignmentId: '',
        swapDate: '',
        reason: '',
      });
      loadSwaps();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to propose swap.');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING_PEER_ACCEPTANCE: 'bg-[#FFF8E6] text-[#B9812E] border-[#F3E2B8]',
      PENDING_MANAGER_APPROVAL: 'bg-[#EBF3FC] text-[#2062B7] border-[#C3DCF8]',
      APPROVED: 'bg-[#EAF7ED] text-[#1E7E34] border-[#BCE8C5]',
      PEER_REJECTED: 'bg-[#FDEEEB] text-[#B83E28] border-[#F5C2BA]',
      MANAGER_REJECTED: 'bg-[#FDEEEB] text-[#B83E28] border-[#F5C2BA]',
      EXPIRED: 'bg-[#F7F6F2] text-[#728294] border-[#E3DED4]',
    };
    return badges[status] || 'bg-white text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center pb-2 border-b border-[#E3DED4]">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-bold">
            SHIFT EXCHANGE // SQUAD ROSTER
          </span>
          <h2 className="text-lg font-serif font-bold text-[#16233B]">
            Shift Swap Operations
          </h2>
        </div>
        {!isManagerView && (
          <button
            onClick={openProposeModal}
            className="px-3 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-xs"
          >
            + Propose Shift Swap
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-8 bg-white border border-[#E3DED4] rounded-lg text-center text-xs font-mono text-[#728294]">
          Loading shift exchange requests...
        </div>
      ) : swaps.length === 0 ? (
        <div className="p-8 bg-white border border-[#E3DED4] rounded-lg text-center text-xs font-mono text-[#728294]">
          No pending or recorded shift swap requests found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {swaps.map((item) => {
            const isPeer = item.targetEmployeeId?._id === user?.employeeId || item.targetEmployeeId?.email === user?.email;
            const isManager = isManagerView || ['COMPANY_ADMIN', 'ADMIN', 'HR', 'MANAGER'].includes(user?.role);

            return (
              <div
                key={item._id}
                className="p-4 bg-white border border-[#E3DED4] rounded-lg shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#16233B]">
                      {item.requesterId?.firstName} {item.requesterId?.lastName}
                    </span>
                    <span className="text-[10px] font-mono text-[#728294]">⇄</span>
                    <span className="text-xs font-bold text-[#16233B]">
                      {item.targetEmployeeId?.firstName} {item.targetEmployeeId?.lastName}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${getStatusBadge(
                        item.status
                      )}`}
                    >
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#5B6B79]">
                    Date: <strong className="text-[#16233B]">{new Date(item.swapDate).toLocaleDateString()}</strong> • Reason: {item.reason || 'No justification provided'}
                  </p>
                </div>

                {/* Action Buttons based on User Persona */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Peer Response Actions */}
                  {isPeer && item.status === 'PENDING_PEER_ACCEPTANCE' && (
                    <>
                      <button
                        onClick={() => handlePeerResponse(item._id, 'ACCEPT')}
                        disabled={actionLoadingId === item._id}
                        className="px-3 py-1 bg-[#1E7E34] text-white text-[11px] font-mono font-bold rounded cursor-pointer"
                      >
                        Accept Swap
                      </button>
                      <button
                        onClick={() => handlePeerResponse(item._id, 'REJECT')}
                        disabled={actionLoadingId === item._id}
                        className="px-3 py-1 bg-[#B83E28] text-white text-[11px] font-mono font-bold rounded cursor-pointer"
                      >
                        Decline
                      </button>
                    </>
                  )}

                  {/* Manager / Incharge Final Approval Actions */}
                  {isManager && item.status === 'PENDING_MANAGER_APPROVAL' && (
                    <>
                      <button
                        onClick={() => handleManagerApproval(item._id, 'APPROVE')}
                        disabled={actionLoadingId === item._id}
                        className="px-3 py-1 bg-[#1E7E34] text-white text-[11px] font-mono font-bold rounded cursor-pointer"
                      >
                        ✓ Authorize Swap
                      </button>
                      <button
                        onClick={() => handleManagerApproval(item._id, 'REJECT')}
                        disabled={actionLoadingId === item._id}
                        className="px-3 py-1 bg-[#B83E28] text-white text-[11px] font-mono font-bold rounded cursor-pointer"
                      >
                        ✕ Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Propose Swap Modal */}
      {isProposeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#E3DED4] rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-sm font-serif font-bold text-[#16233B] pb-2 border-b border-[#E3DED4]">
              Propose Shift Exchange
            </h3>
            <form onSubmit={handleProposeSubmit} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                  Exchange With Colleague *
                </label>
                <select
                  required
                  value={formData.targetEmployeeId}
                  onChange={(e) => setFormData({ ...formData, targetEmployeeId: e.target.value })}
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none"
                >
                  <option value="">Select Colleague</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName || ''} ({emp.designation || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                  Exchange Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.swapDate}
                  onChange={(e) => setFormData({ ...formData, swapDate: e.target.value })}
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
                  Reason / Notes
                </label>
                <textarea
                  rows="2"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="State reason for shifting roster..."
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setIsProposeModalOpen(false)}
                  className="px-3 py-1 border border-[#D8D3C7] rounded text-[#728294]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 bg-[#8C5D17] text-white font-mono font-bold rounded"
                >
                  Submit Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}