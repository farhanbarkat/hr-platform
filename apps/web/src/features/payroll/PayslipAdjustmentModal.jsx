import React, { useState } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function PayslipAdjustmentModal({ slip, onClose, onSuccess }) {
  const [type, setType] = useState('ADDITION'); // 'ADDITION' | 'DEDUCTION'
  const [category, setCategory] = useState('BONUS');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!slip) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      // Audit reason format: "[CATEGORY] user_reason"
      const formattedReason = `[${category}] ${reason.trim()}`;

      await apiClient.post('/payslips/adjustments', {
        payslipId: slip._id,
        employeeId: slip.employeeId?._id || slip.employeeId,
        payrollRunId: slip.payrollRunId,
        type, // Strictly sends 'ADDITION' or 'DEDUCTION'
        amount: Number(amount),
        reason: formattedReason,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to log adjustment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white border border-[#E3DED4] rounded-lg shadow-xl w-full max-w-md p-5 font-sans">
        <div className="flex justify-between items-start pb-2 border-b border-[#E3DED4]">
          <div>
            <h3 className="text-sm font-bold text-[#16233B]">Post-Approval Payslip Adjustment</h3>
            <p className="text-xs text-[#728294] mt-0.5 font-mono">
              Immutable entry for {slip.employeeId?.firstName} {slip.employeeId?.lastName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#728294] hover:text-[#16233B] text-lg font-mono cursor-pointer leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="p-2.5 mt-3 bg-[#FDEEEB] border border-[#F5C2BA] text-[#B83E28] rounded text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 mt-4 text-xs">
          {/* Schema Enum Match: ADDITION vs DEDUCTION */}
          <div>
            <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
              Adjustment Flow (Schema Type)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType('ADDITION');
                  setCategory('BONUS');
                }}
                className={`py-2 px-3 rounded text-xs font-mono font-bold border transition-all cursor-pointer ${
                  type === 'ADDITION'
                    ? 'bg-[#EBF7F0] border-[#1E7E34] text-[#1E7E34]'
                    : 'bg-[#FAF8F5] border-[#D8D3C7] text-[#728294]'
                }`}
              >
                + ADDITION (Credit)
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('DEDUCTION');
                  setCategory('PENALTY');
                }}
                className={`py-2 px-3 rounded text-xs font-mono font-bold border transition-all cursor-pointer ${
                  type === 'DEDUCTION'
                    ? 'bg-[#FDEEEB] border-[#B83E28] text-[#B83E28]'
                    : 'bg-[#FAF8F5] border-[#D8D3C7] text-[#728294]'
                }`}
              >
                - DEDUCTION (Debit)
              </button>
            </div>
          </div>

          {/* Sub-Category for Audit Details */}
          <div>
            <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
              Category Reason Tag
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2 border border-[#D8D3C7] rounded outline-none font-mono focus:border-[#8C5D17]"
            >
              {type === 'ADDITION' ? (
                <>
                  <option value="BONUS">Bonus / Reward</option>
                  <option value="ARREARS">Arrears / Backpay</option>
                  <option value="INCENTIVE">Performance Incentive</option>
                  <option value="EXPENSE_REIMBURSEMENT">Approved Expense Settlement</option>
                </>
              ) : (
                <>
                  <option value="PENALTY">Late / Disciplinary Fine</option>
                  <option value="UNPAID_ABSENCE">Unrecorded Absence</option>
                  <option value="LOAN_CORRECTION">Loan EMI Recovery Adj.</option>
                  <option value="TAX_ADJUSTMENT">Tax Under-withholding</option>
                </>
              )}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
              Amount (PKR)
            </label>
            <input
              type="number"
              required
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full p-2 border border-[#D8D3C7] rounded outline-none font-mono focus:border-[#8C5D17]"
            />
          </div>

          {/* Mandatory Reason */}
          <div>
            <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1">
              Audit Reason & Justification
            </label>
            <textarea
              rows="3"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide exact business rationale for auditing records..."
              className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 font-mono">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-[#D8D3C7] rounded text-[#728294] cursor-pointer hover:bg-[#FAF8F5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-[#8C5D17] hover:bg-[#784F14] text-white font-bold rounded cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Logging...' : 'Confirm Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}