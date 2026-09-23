import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function OffboardingManagementDesk() {
  const [offboardings, setOffboardings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [selectedItem, setSelectedItem] = useState(null);
  const [checklist, setChecklist] = useState([]);

  const fetchOffboardings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/offboarding');
      setOffboardings(res.data?.data?.offboardings || []);
    } catch (err) {
      setFeedback({ type: 'error', text: 'Failed to load offboarding records.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffboardings();
  }, []);

  const handleAcknowledge = async (id) => {
    try {
      await apiClient.patch(`/offboarding/${id}/acknowledge`, {});
      setFeedback({ type: 'success', text: 'Resignation acknowledged & clearance initiated.' });
      fetchOffboardings();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Action failed.' });
    }
  };

  const handleSettle = async (id) => {
    try {
      await apiClient.post(`/offboarding/${id}/settle`, { encashLeaves: true });
      setFeedback({ type: 'success', text: 'Final settlement computed successfully.' });
      fetchOffboardings();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Settlement failed.' });
    }
  };

  const handleCompleteExit = async (id) => {
    try {
      await apiClient.post(`/offboarding/${id}/complete-exit`, {});
      setFeedback({ type: 'success', text: 'Employee exit completed and letters published!' });
      fetchOffboardings();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Exit completion failed.' });
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-24">
      <div className="flex justify-between items-center pb-4 border-b border-[#E3DED4]">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            HR GOVERNANCE // OFFBOARDING & SETTLEMENTS
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#16233B] mt-0.5">
            Offboarding & Exit Operations
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Manage resignations, clearance checklists, final financial settlements, and exit letters.
          </p>
        </div>
      </div>

      {feedback.text && (
        <div className={`p-3 rounded text-xs font-mono border ${
          feedback.type === 'success' ? 'bg-[#EBF7F0] border-[#C6EAD3] text-[#1E7E34]' : 'bg-[#FDEEEB] border-[#F5C2BA] text-[#B83E28]'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Offboarding Table */}
      <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-2xs space-y-4">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#728294]">
          ACTIVE EXIT CYCLES ({offboardings.length})
        </h3>

        {loading ? (
          <div className="py-12 text-center text-xs font-mono text-[#728294]">
            Loading offboarding records...
          </div>
        ) : offboardings.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-[#728294]">
            No offboarding or resignation records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E3DED4] text-[#728294] font-mono text-[10px] uppercase">
                  <th className="p-3">Employee</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">LWD</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4F1EA]">
                {offboardings.map((o) => (
                  <tr key={o._id} className="hover:bg-[#FAF8F5]">
                    <td className="p-3 font-bold text-[#16233B]">
                      {o.employeeId?.firstName} {o.employeeId?.lastName}
                      <span className="block text-[10px] font-mono text-[#728294] font-normal">{o.employeeId?.email}</span>
                    </td>
                    <td className="p-3 font-mono text-[11px] uppercase">{o.initiatedType}</td>
                    <td className="p-3">{o.reason}</td>
                    <td className="p-3 font-mono">{new Date(o.lastWorkingDate).toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FAF4E8] text-[#8C5D17] border border-[#E3DED4]">
                        {o.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {o.status === 'submitted' && (
                        <button
                          onClick={() => handleAcknowledge(o._id)}
                          className="px-2.5 py-1 bg-[#16233B] text-white font-mono rounded text-[10px] cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      )}
                      {(o.status === 'clearanceInProgress' || o.status === 'cleared') && (
                        <button
                          onClick={() => handleSettle(o._id)}
                          className="px-2.5 py-1 bg-[#8C5D17] text-white font-mono rounded text-[10px] cursor-pointer"
                        >
                          Run Settlement
                        </button>
                      )}
                      {o.status === 'settled' && (
                        <button
                          onClick={() => handleCompleteExit(o._id)}
                          className="px-2.5 py-1 bg-[#1E7E34] text-white font-mono rounded text-[10px] cursor-pointer"
                        >
                          Complete Exit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}