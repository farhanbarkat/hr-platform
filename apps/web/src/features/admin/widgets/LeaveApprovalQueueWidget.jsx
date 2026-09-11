import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/apiClient.js';

export default function LeaveApprovalQueueWidget({ count }) {
  const [pendingCount, setPendingCount] = useState(count || 0);
  const navigate = useNavigate();

  useEffect(() => {
    // Agar parent component ne count pass kiya hai toh direct use karein
    if (typeof count === 'number') {
      setPendingCount(count);
      return;
    }

    // Plural route: /leaves/pending-approvals
    apiClient.get('/leaves/pending-approvals')
      .then((res) => {
        const list = res.data?.data || res.data || [];
        setPendingCount(Array.isArray(list) ? list.length : 0);
      })
      .catch((err) => {
        // Agar 403 (unauthorized) ya 404 aaye toh silently 0 set karein
        setPendingCount(0);
      });
  }, [count]);

  return (
    <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start">
          <span className="text-[9.5px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            WORKFLOW APPROVALS
          </span>
          {pendingCount > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[#FDEEEB] text-[#B83E28] border border-[#F5C2BA] rounded">
              Action Required
            </span>
          )}
        </div>
        <h3 className="text-sm font-bold text-[#16233B] mt-1">Pending Leave Requests</h3>
        <div className="mt-2 text-2xl font-bold font-mono text-[#16233B]">{pendingCount}</div>
        <p className="text-[11px] text-[#728294]">Requests waiting for line or managerial review.</p>
      </div>

      <button
        onClick={() => navigate('/company-admin/leaves')}
        className="mt-4 w-full py-2 bg-[#8C5D17] hover:bg-[#734B12] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors"
      >
        REVIEW LEAVE QUEUE &rarr;
      </button>
    </div>
  );
}