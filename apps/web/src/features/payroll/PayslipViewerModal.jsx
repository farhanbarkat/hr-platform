import React, { useState } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function PayslipViewerModal({ slip, onClose, onAdjustmentTriggered }) {
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  if (!slip) return null;

  const emp = slip.employeeId;
  const earnings = slip.earnings || {};
  const deductions = slip.deductions || {};

  const basicSalary = Number(earnings.basicSalary || slip.basicSalary || slip.grossPay || 0);
  const allowances = Number(earnings.allowances || 0);
  const overtimePay = Number(earnings.overtimePay || 0);
  const grossPay = Number(slip.grossPay || earnings.grossPay || earnings.totalEarnings || basicSalary + allowances + overtimePay);

  const attendanceDeduction = Number(deductions.lateDeductions || deductions.attendanceDeduction || slip.attendanceDeduction || 0);
  const unpaidLeaveDeduction = Number(deductions.unpaidLeaveDeductions || deductions.unpaidLeaveDeduction || slip.unpaidLeavesDeduction || 0);
  const loanEmi = Number(deductions.loanEmiPlaceholder || deductions.loanEmi || 0);
  const tax = Number(deductions.taxPlaceholder || deductions.tax || 0);
  const totalDeductions = Number(slip.totalDeductions || deductions.totalDeductions || (attendanceDeduction + unpaidLeaveDeduction + loanEmi + tax));

  const netPay = Number(slip.netPay || Math.max(0, grossPay - totalDeductions));

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      setFeedback(null);

      // Step A: Trigger Generation
      try {
        await apiClient.post(`/payslips/${slip._id}/generate-pdf`);
      } catch (genErr) {
        console.warn('PDF generation service fallback notice:', genErr);
      }

      // Step B: Get Secure URL
      const res = await apiClient.get(`/payslips/${slip._id}/download`);
      const downloadUrl = res.data?.data?.url || res.data?.data?.downloadUrl || res.data?.data;

      if (downloadUrl && typeof downloadUrl === 'string') {
        window.open(downloadUrl, '_blank');
      } else {
        window.print();
      }
    } catch (err) {
      setFeedback({
        text: 'Cloud PDF engine offline. Direct print view ready.',
        ok: false,
      });
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-[#E3DED4] rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E3DED4] flex justify-between items-center bg-[#FAF8F5]">
          <div>
            <span className="text-[9px] font-mono uppercase tracking-widest text-[#728294] font-bold">
              PAYROLL LEDGER AUDIT // COMPENSATION BREAKDOWN
            </span>
            <h2 className="text-base font-serif font-bold text-[#16233B]">
              Salary Voucher: {emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : (slip.employeeName || 'Staff Member')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#728294] hover:text-[#16233B] text-xl font-mono leading-none cursor-pointer p-1"
          >
            &times;
          </button>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className="p-2 text-xs font-mono text-center bg-[#FAF4E8] text-[#8C5D17] border-b border-[#E3DED4]">
            {feedback.text}
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
          {/* Metadata Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF8F5] p-3.5 rounded border border-[#E3DED4]">
            <div>
              <span className="text-[9px] font-mono text-[#728294] uppercase block">EMPLOYEE CODE</span>
              <span className="font-mono font-bold text-[#16233B]">
                {emp?.employeeCode || 'EMP-N/A'}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-mono text-[#728294] uppercase block">PERIOD</span>
              <span className="font-mono font-bold text-[#16233B]">
                {slip.period?.month || '--'}/{slip.period?.year || '--'}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-mono text-[#728294] uppercase block">STATUS</span>
              <span className="font-mono font-bold text-[#8C5D17]">
                {slip.status}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-mono text-[#728294] uppercase block">SETTLED DAYS</span>
              <span className="font-mono font-bold text-[#16233B]">
                {slip.attendanceSummary?.workedDays ?? slip.workedDays ?? 30} Days
              </span>
            </div>
          </div>

          {/* Earnings vs Deductions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Earnings */}
            <div className="border border-[#E3DED4] rounded-lg p-3.5 space-y-2.5">
              <div className="text-[10px] font-mono uppercase text-[#1E7E34] font-bold pb-1 border-b border-[#E3DED4] flex justify-between">
                <span>EARNINGS COMPONENT</span>
                <span>AMOUNT (PKR)</span>
              </div>

              <div className="flex justify-between font-mono text-xs">
                <span className="text-[#5B6B79]">Basic Salary</span>
                <span className="font-semibold text-[#16233B]">{basicSalary.toLocaleString()}</span>
              </div>

              {allowances > 0 && (
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-[#5B6B79]">Allowances</span>
                  <span className="font-semibold text-[#16233B]">{allowances.toLocaleString()}</span>
                </div>
              )}

              {overtimePay > 0 && (
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-[#5B6B79]">Overtime Pay</span>
                  <span className="font-semibold text-[#16233B]">{overtimePay.toLocaleString()}</span>
                </div>
              )}

              <div className="pt-2 border-t border-[#EFECE6] flex justify-between font-mono font-bold text-[#1E7E34]">
                <span>Gross Earnings</span>
                <span>{grossPay.toLocaleString()}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="border border-[#E3DED4] rounded-lg p-3.5 space-y-2.5">
              <div className="text-[10px] font-mono uppercase text-[#B83E28] font-bold pb-1 border-b border-[#E3DED4] flex justify-between">
                <span>DEDUCTIONS COMPONENT</span>
                <span>AMOUNT (PKR)</span>
              </div>

              <div className="flex justify-between font-mono text-xs">
                <span className="text-[#5B6B79]">Absents / Late Deductions</span>
                <span className="font-semibold text-[#B83E28]">-{attendanceDeduction.toLocaleString()}</span>
              </div>

              <div className="flex justify-between font-mono text-xs">
                <span className="text-[#5B6B79]">Unpaid Leaves</span>
                <span className="font-semibold text-[#B83E28]">-{unpaidLeaveDeduction.toLocaleString()}</span>
              </div>

              {loanEmi > 0 && (
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-[#5B6B79]">Loan EMI Auto-Recovery</span>
                  <span className="font-semibold text-[#B83E28]">-{loanEmi.toLocaleString()}</span>
                </div>
              )}

              {tax > 0 && (
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-[#5B6B79]">Tax Deductions</span>
                  <span className="font-semibold text-[#B83E28]">-{tax.toLocaleString()}</span>
                </div>
              )}

              <div className="pt-2 border-t border-[#EFECE6] flex justify-between font-mono font-bold text-[#B83E28]">
                <span>Total Deductions</span>
                <span>-{totalDeductions.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Net Payable Ribbon */}
          <div className="bg-[#FAF4E8] border border-[#E3DED4] rounded-lg p-4 flex justify-between items-center">
            <div>
              <span className="text-[10px] font-mono text-[#8C5D17] uppercase tracking-wider block font-bold">
                NET DISBURSEMENT PAYABLE
              </span>
              <span className="text-xs text-[#5B6B79]">
                Automated compensation breakdown for this payroll cycle.
              </span>
            </div>
            <div className="text-2xl font-mono font-bold text-[#1E7E34]">
              {netPay.toLocaleString()} <span className="text-xs text-[#728294]">PKR</span>
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-3.5 border-t border-[#E3DED4] bg-[#FAF8F5] flex justify-between items-center">
          <div className="flex gap-2">
            {onAdjustmentTriggered && (
              <button
                onClick={() => onAdjustmentTriggered(slip)}
                className="px-3 py-1.5 bg-[#FAF8F5] border border-[#D8D3C7] text-xs font-mono font-bold text-[#8C5D17] rounded cursor-pointer hover:bg-[#FAF4E8]"
              >
                + Post-Approval Adjustment
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 bg-white border border-[#D8D3C7] hover:bg-[#FAF8F5] text-xs font-mono font-bold rounded cursor-pointer transition-colors"
            >
              🖨️ PRINT
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="px-4 py-1.5 bg-[#8C5D17] hover:bg-[#734B12] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors disabled:opacity-50"
            >
              {downloading ? 'GENERATING...' : 'DOWNLOAD PDF ↓'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}