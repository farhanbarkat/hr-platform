import { useState } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function PayslipDownloadButton({ payslip, className = '' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const downloadPayslip = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.get(`/payslips/${payslip._id}/download`);
      const url = response.data?.data?.downloadUrl || response.data?.data?.url || response.data?.data;
      if (!url || typeof url !== 'string') throw new Error('A fresh download link was not returned.');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Download link expired or is unavailable. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={downloadPayslip}
        disabled={loading}
        className={`rounded border border-[#D8D3C7] bg-white px-2 py-1 text-[10px] font-mono font-bold text-[#8C5D17] hover:bg-[#FAF4E8] disabled:opacity-50 ${className}`}
      >
        {loading ? 'LOADING...' : 'DOWNLOAD PDF'}
      </button>
      {error && <span className="max-w-[150px] text-right text-[9px] text-[#B83E28]">{error}</span>}
    </span>
  );
}
