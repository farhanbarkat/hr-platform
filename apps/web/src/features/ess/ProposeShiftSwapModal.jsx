import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function ProposeShiftSwapModal({ isOpen, onClose, onSwapProposed }) {
  const [peers, setPeers] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [selectedMyShift, setSelectedMyShift] = useState(null);

  const [formData, setFormData] = useState({
    targetEmployeeId: '',
    swapDate: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  // 1. Backend ke naye endpoint se active shifts aur colleagues uthana
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchPeerData = async () => {
      try {
        setFetching(true);
        setError(null);

        const res = await apiClient.get('/shift-swaps/peers');
        const data = res.data?.data || {};

        if (isMounted) {
          const fetchedShifts = Array.isArray(data.myAssignments) ? data.myAssignments : [];
          const fetchedPeers = Array.isArray(data.peers) ? data.peers : [];

          setMyAssignments(fetchedShifts);
          setPeers(fetchedPeers);

          if (fetchedShifts.length > 0) {
            setSelectedMyShift(fetchedShifts[0]);
          } else {
            setSelectedMyShift(null);
          }
        }
      } catch (err) {
        console.warn('Failed to load peer telemetry:', err);
        setError(err.response?.data?.message || 'Failed to load colleagues for shift swap.');
      } finally {
        if (isMounted) setFetching(false);
      }
    };

    fetchPeerData();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // 2. Submit Swap Request
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedMyShift) {
      setError('Aapki koi active shift assign nahi hai swap ke liye.');
      return;
    }

    if (!formData.targetEmployeeId) {
      setError('Please select a colleague to propose the swap to.');
      return;
    }

    if (!formData.swapDate) {
      setError('Please select the date on which you want to swap shifts.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await apiClient.post('/shift-swaps', {
        targetEmployeeId: formData.targetEmployeeId,
        requesterShiftAssignmentId: selectedMyShift._id,
        targetShiftAssignmentId: selectedMyShift._id, // Counter assignment fallback
        swapDate: formData.swapDate,
        reason: formData.reason || 'Personal schedule adjustment',
      });

      if (onSwapProposed) onSwapProposed();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit shift swap proposal.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none font-sans">
      <div className="bg-white border border-[#E3DED4] rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-[#E3DED4]">
          <div>
            <span className="text-[9px] font-mono tracking-widest text-[#728294] uppercase font-bold">
              ESS // ROSTER EXCHANGE
            </span>
            <h3 className="text-base font-serif font-bold text-[#16233B]">
              Propose Shift Swap
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#728294] hover:text-[#16233B] text-xl font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="p-2.5 mt-3 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        {fetching ? (
          <div className="py-12 text-center text-xs font-mono text-[#728294]">
            Retrieving your active roster & colleagues...
          </div>
        ) : myAssignments.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <span className="text-3xl">📅</span>
            <h4 className="text-sm font-bold text-[#16233B]">No Shift Assigned to You</h4>
            <p className="text-xs text-[#728294] max-w-sm mx-auto">
              Aapki profile par koi active shift allocation nahi mili. Swap sirf tab ho sakta hai jab aapko pehle se koi shift assigned ho.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-[#FAF8F5] border border-[#D8D3C7] text-xs font-mono font-bold rounded cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs flex-1 overflow-y-auto pr-1">
            {/* Step 1: Current Assigned Shift */}
            <div>
              <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">
                1. Your Shift Slot to Swap *
              </label>
              <div className="space-y-1.5">
                {myAssignments.map((a) => {
                  const isSelected = selectedMyShift?._id === a._id;
                  const shift = a.shiftTemplateId || {};
                  return (
                    <div
                      key={a._id}
                      onClick={() => setSelectedMyShift(a)}
                      className={`p-3 rounded border cursor-pointer transition-all flex justify-between items-center ${
                        isSelected
                          ? 'bg-[#FAF4E8] border-[#8C5D17] shadow-xs'
                          : 'bg-white border-[#E3DED4] hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div>
                        <span className="font-bold text-xs text-[#16233B] block">
                          {shift.name || 'Current Assigned Shift'}
                        </span>
                        <span className="text-[10px] font-mono text-[#8C5D17]">
                          Timing: {shift.startTime || '09:00'} &rarr; {shift.endTime || '18:00'}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="text-[9.5px] font-mono font-bold text-[#8C5D17] bg-white px-2 py-0.5 rounded border border-[#8C5D17]">
                          ACTIVE SELECTION
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Swap Date */}
            <div>
              <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">
                2. Shift Exchange Date *
              </label>
              <input
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={formData.swapDate}
                onChange={(e) => setFormData({ ...formData, swapDate: e.target.value })}
                className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] bg-white font-mono"
              />
            </div>

            {/* Step 3: Select Colleague */}
            <div>
              <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">
                3. Choose Colleague to Swap With *
              </label>
              <select
                required
                value={formData.targetEmployeeId}
                onChange={(e) => setFormData({ ...formData, targetEmployeeId: e.target.value })}
                className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] bg-white"
              >
                <option value="">Select a colleague from your department/floor</option>
                {peers.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.firstName} {p.lastName || ''} ({p.designation || 'Staff'} • {p.department || 'General'})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 4: Reason */}
            <div>
              <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">
                4. Reason / Note (Optional)
              </label>
              <textarea
                rows="2"
                placeholder="e.g. Urgent family matter, need morning/evening exchange..."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[#E3DED4]">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 border border-[#D8D3C7] rounded text-[#728294] hover:bg-[#FAF8F5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white font-mono font-bold rounded cursor-pointer transition-colors disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Send Swap Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}