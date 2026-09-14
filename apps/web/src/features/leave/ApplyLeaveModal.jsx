import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function ApplyLeaveModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);

  const [formData, setFormData] = useState({
    leaveTypeId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    reason: '',
  });

  useEffect(() => {
    if (!isOpen) return;

    const fetchLeaveTypes = async () => {
      try {
        const res = await apiClient.get('/leaves/types');
        const list = res.data?.data || res.data || [];
        const typesList = Array.isArray(list) ? list : [];
        setLeaveTypes(typesList);
        
        if (typesList.length > 0) {
          setFormData((prev) => ({ 
            ...prev, 
            leaveTypeId: typesList[0]._id || '' 
          }));
        }
      } catch (err) {
        console.error('Failed to load leave categories:', err);
      }
    };

    fetchLeaveTypes();
  }, [isOpen]);

  if (!isOpen) return null;

  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 1;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.leaveTypeId) {
      setError('Please select a valid Leave Category.');
      return;
    }

    setLoading(true);

    try {
      const selectedTypeObj = leaveTypes.find((t) => t._id === formData.leaveTypeId);

      // Backend controller validation requirements: leaveTypeId, startDate, endDate
      const payload = {
        leaveTypeId: formData.leaveTypeId,
        leaveType: selectedTypeObj?.name || selectedTypeObj?.code || 'LEAVE',
        startDate: formData.startDate,
        endDate: formData.endDate,
        totalDays: calculateDays(),
        reason: formData.reason.trim(),
      };

      await apiClient.post('/leaves/apply', payload);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to submit leave application.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none font-sans">
      <div className="bg-white border border-[#E3DED4] rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E3DED4] flex items-center justify-between bg-[#FAF8F5]">
          <div>
            <span className="text-[9px] font-mono tracking-widest text-[#728294] uppercase font-bold">
              ABSENCE MANAGEMENT
            </span>
            <h2 className="text-base font-bold text-[#16233B] mt-0.5">
              Submit Leave Application
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#728294] hover:text-[#16233B] text-xl font-mono leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded font-mono text-[11px]">
              ⚠️ {error}
            </div>
          )}

          {/* Leave Type */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
              Leave Category *
            </label>
            <select
              name="leaveTypeId"
              required
              value={formData.leaveTypeId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans text-xs"
            >
              <option value="">Select Category...</option>
              {leaveTypes.map((type) => (
                <option key={type._id} value={type._id}>
                  {type.name} {type.code ? `(${type.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                Start Date *
              </label>
              <input
                type="date"
                name="startDate"
                required
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
                End Date *
              </label>
              <input
                type="date"
                name="endDate"
                required
                min={formData.startDate}
                value={formData.endDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans text-xs"
              />
            </div>
          </div>

          <div className="px-3 py-2 bg-[#FAF8F5] border border-[#EFECE6] rounded flex justify-between items-center font-mono text-[11px]">
            <span className="text-[#728294]">Total Days Requested:</span>
            <span className="font-bold text-[#8C5D17]">{calculateDays()} Day(s)</span>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-[10px] font-mono uppercase text-[#728294] font-semibold mb-1">
              Reason / Justification *
            </label>
            <textarea
              name="reason"
              required
              rows={3}
              value={formData.reason}
              onChange={handleChange}
              placeholder="Provide justification for this leave request..."
              className="w-full px-3 py-2 border border-[#D8D3C7] rounded focus:outline-none focus:border-[#8C5D17] bg-[#FAF8F5]/30 font-sans text-xs"
            />
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-[#E3DED4] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#D8D3C7] hover:bg-[#FAF8F5] text-[#16233B] text-xs font-mono font-semibold rounded cursor-pointer transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#8C5D17] hover:bg-[#734B12] text-white text-xs font-mono font-bold rounded cursor-pointer disabled:opacity-50 transition-colors"
            >
              {loading ? 'SUBMITTING...' : 'APPLY FOR LEAVE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}