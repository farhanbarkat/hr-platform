import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function ManageMembersModal({
  isOpen,
  onClose,
  team,
  onMembersUpdated,
}) {
  const [employees, setEmployees] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Sync existing members and fetch directory
  useEffect(() => {
    if (!isOpen || !team) return;

    // Existing team members ki IDs initialize karein
    const currentIds = (team.members || []).map((m) =>
      typeof m === 'object' ? m._id : m
    );
    setSelectedMemberIds(currentIds);

    let isMounted = true;
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.get('/employees');
        const list = res.data?.data?.employees || res.data?.data || [];
        if (isMounted) {
          setEmployees(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.warn('Failed to load employee directory:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchEmployees();
    return () => {
      isMounted = false;
    };
  }, [isOpen, team]);

  if (!isOpen || !team) return null;

  const handleToggle = (empId) => {
    setSelectedMemberIds((prev) =>
      prev.includes(empId)
        ? prev.filter((id) => id !== empId)
        : [...prev, empId]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      await apiClient.patch(`/teams/${team._id}/members`, {
        memberIds: selectedMemberIds,
      });

      if (onMembersUpdated) onMembersUpdated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update squad members.');
    } finally {
      setSaving(false);
    }
  };

  // Manager ko member list se exclude karein
  const managerId = team.managerId?._id || team.managerId || team.manager?._id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 select-none font-sans">
      <div className="bg-white border border-[#E3DED4] rounded-lg shadow-xl w-full max-w-md p-6 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start pb-3 border-b border-[#E3DED4]">
          <div>
            <span className="text-[9px] font-mono tracking-widest text-[#728294] uppercase font-bold">
              SQUAD ROSTER // {team.name}
            </span>
            <h3 className="text-base font-serif font-bold text-[#16233B]">
              Manage Squad Members
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

        {loading ? (
          <div className="py-12 text-center text-xs font-mono text-[#728294]">
            Loading employees list...
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex-1 flex flex-col justify-between mt-3 overflow-hidden">
            <div className="space-y-2 overflow-y-auto max-h-[350px] pr-1">
              <div className="text-[11px] font-mono text-[#728294] mb-2 flex justify-between">
                <span>Select members to add/remove:</span>
                <span className="font-bold text-[#8C5D17]">{selectedMemberIds.length} Selected</span>
              </div>

              {employees.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#728294] font-mono">
                  No employees found in directory.
                </div>
              ) : (
                employees
                  .filter((emp) => emp._id !== managerId)
                  .map((emp) => {
                    const isChecked = selectedMemberIds.includes(emp._id);
                    return (
                      <label
                        key={emp._id}
                        className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-[#FAF4E8] border-[#8C5D17]'
                            : 'bg-white border-[#E3DED4] hover:bg-[#FAF8F5]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggle(emp._id)}
                            className="accent-[#8C5D17]"
                          />
                          <div>
                            <span className="text-xs font-bold text-[#16233B] block">
                              {emp.firstName} {emp.lastName || ''}
                            </span>
                            <span className="text-[10px] text-[#728294] font-mono">
                              {emp.designation || 'Staff'} • {emp.department || 'General'}
                            </span>
                          </div>
                        </div>
                        {isChecked && (
                          <span className="text-[10px] font-mono text-[#1E7E34] font-bold">
                            Active Member
                          </span>
                        )}
                      </label>
                    );
                  })
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-[#E3DED4] mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 border border-[#D8D3C7] rounded text-xs text-[#728294] hover:bg-[#FAF8F5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}