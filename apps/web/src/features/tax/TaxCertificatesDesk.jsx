import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function TaxCertificatesDesk() {
  const { user } = useAuth();

  const [certificates, setCertificates] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedTaxYear, setSelectedTaxYear] = useState('2026-2027');
  const [feedback, setFeedback] = useState(null);

  // 1. Fetch Existing Certificates
  const fetchCertificates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/tax-certificates');
      setCertificates(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to fetch certificates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Employees for Generation Modal
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await apiClient.get('/employees').catch(() => ({ data: { data: [] } }));
      const list = res.data?.data?.employees || res.data?.data || [];
      setEmployees(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Employees fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
    fetchEmployees();
  }, [fetchCertificates, fetchEmployees]);

  // 3. Request Certificate Generation (BullMQ Queue)
  const handleRequestCertificate = async (e) => {
    e.preventDefault();
    try {
      setGenerating(true);
      setFeedback(null);

      await apiClient.post('/tax-certificates/generate', {
        employeeId: selectedEmployee || undefined,
        taxYear: selectedTaxYear,
      });

      setFeedback({
        text: 'Tax certificate generation queued in background. It will be ready shortly.',
        ok: true,
      });

      fetchCertificates();
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || 'Failed to dispatch generation job.',
        ok: false,
      });
    } finally {
      setGenerating(false);
    }
  };

  // 4. Download Certificate
  const handleDownload = async (certId) => {
    try {
      const res = await apiClient.get(`/tax-certificates/${certId}/download`);
      const url = res.data?.data?.url || res.data?.data;
      if (url && typeof url === 'string') {
        window.open(url, '_blank');
      } else {
        window.open(`${apiClient.defaults.baseURL}/tax-certificates/${certId}/download`, '_blank');
      }
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || 'Certificate file is still processing.',
        ok: false,
      });
    }
  };

  return (
    <div className="space-y-6 font-sans text-[#16233B] select-none">
      
      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-3 rounded text-xs font-mono border ${
          feedback.ok ? 'bg-[#EBF7F0] border-[#C6EAD3] text-[#1E7E34]' : 'bg-[#FDEEEB] border-[#F5C2BA] text-[#B83E28]'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Generation Bar */}
      <div className="bg-white p-4 rounded-lg border border-[#E3DED4] shadow-2xs">
        <h3 className="text-sm font-bold text-[#16233B]">Generate Statutory Annual Tax Certificate</h3>
        <p className="text-xs text-[#5B6B79] mt-0.5">
          Dispatches asynchronous PDF compiler aggregating monthly payslips, taxable income, and withholdings.
        </p>

        <form onSubmit={handleRequestCertificate} className="flex flex-wrap items-center gap-3 mt-4 text-xs font-mono">
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="p-2 border border-[#D8D3C7] rounded outline-none bg-white text-[#16233B] min-w-[200px]"
          >
            <option value="">Current User / Self</option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp.firstName} {emp.lastName || ''} ({emp.employeeCode || 'EMP'})
              </option>
            ))}
          </select>

          <select
            value={selectedTaxYear}
            onChange={(e) => setSelectedTaxYear(e.target.value)}
            className="p-2 border border-[#D8D3C7] rounded outline-none bg-white text-[#16233B]"
          >
            <option value="2025-2026">Tax Year 2025-2026</option>
            <option value="2026-2027">Tax Year 2026-2027</option>
            <option value="2027-2028">Tax Year 2027-2028</option>
          </select>

          <button
            type="submit"
            disabled={generating}
            className="px-4 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white font-bold rounded cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
          >
            {generating ? 'Queueing Worker...' : '⚡ Generate Certificate'}
          </button>
        </form>
      </div>

      {/* Certificates Archive Table */}
      <div className="bg-white rounded-lg border border-[#E3DED4] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#E3DED4] bg-[#FAF8F5]">
          <span className="text-[9.5px] font-mono uppercase text-[#728294] font-bold">
            CERTIFICATE REGISTRY & ATTESTATIONS
          </span>
          <h3 className="text-sm font-bold text-[#16233B] mt-0.5">Compiled Annual Certificates</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#FAF8F5] border-b border-[#E3DED4] text-[10px] text-[#728294] uppercase">
              <tr>
                <th className="py-2.5 px-4">Employee</th>
                <th className="py-2.5 px-3">Tax Year</th>
                <th className="py-2.5 px-3">Certificate Number</th>
                <th className="py-2.5 px-3">Tax Deducted</th>
                <th className="py-2.5 px-3">Job Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F1EA]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#728294]">
                    Loading certificate queue...
                  </td>
                </tr>
              ) : certificates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#728294]">
                    No tax certificates compiled yet.
                  </td>
                </tr>
              ) : (
                certificates.map((cert) => {
                  const emp = cert.employeeId || {};
                  const taxPaid = parseFloat(cert.totalTaxPaid?.toString() || 0);

                  return (
                    <tr key={cert._id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                      <td className="py-3 px-4 font-sans font-bold text-[#16233B]">
                        {emp.firstName ? `${emp.firstName} ${emp.lastName || ''}` : 'Employee'}
                      </td>
                      <td className="py-3 px-3 text-[#5B6B79]">{cert.taxYear}</td>
                      <td className="py-3 px-3 font-semibold text-[#8C5D17]">
                        {cert.certificateNumber || 'Processing...'}
                      </td>
                      <td className="py-3 px-3 font-bold text-[#16233B]">
                        {taxPaid.toLocaleString()} PKR
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          cert.status === 'COMPLETED'
                            ? 'bg-[#EBF7F0] text-[#1E7E34] border-[#C6EAD3]'
                            : cert.status === 'FAILED'
                            ? 'bg-[#FDEEEB] text-[#B83E28] border-[#F5C2BA]'
                            : 'bg-[#FAF4E8] text-[#8C5D17] border-[#E8D4B5]'
                        }`}>
                          {cert.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {cert.status === 'COMPLETED' ? (
                          <button
                            onClick={() => handleDownload(cert._id)}
                            className="px-2.5 py-1 bg-white hover:bg-[#FAF8F5] border border-[#D8D3C7] text-[#16233B] rounded text-[10px] font-bold cursor-pointer"
                          >
                            PDF ↓
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#728294]">Queued</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}