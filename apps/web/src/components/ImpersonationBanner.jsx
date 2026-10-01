import { useState } from 'react';
import { tokenStorage } from '../lib/tokenStorage.js';

export default function ImpersonationBanner() {
  const [reason, setReason] = useState(() => sessionStorage.getItem('impersonation_active'));
  const companyName = sessionStorage.getItem('impersonated_company_name') || 'tenant';

  if (!reason) return null;

  const exitImpersonation = () => {
    const previousToken = sessionStorage.getItem('impersonation_previous_token');
    if (previousToken) tokenStorage.setAccessToken(previousToken);
    sessionStorage.removeItem('impersonation_previous_token');
    sessionStorage.removeItem('impersonation_active');
    sessionStorage.removeItem('impersonated_company_name');
    setReason(null);
    window.location.reload();
  };

  return (
    <div className="bg-[#B9812E] text-[#0E1826] px-4 py-2 flex items-center justify-between gap-3 text-xs font-mono font-semibold">
      <span className="truncate">
        ACTIVE READ-ONLY IMPERSONATION: {companyName} | Reason: {reason}
      </span>
      <button
        type="button"
        onClick={exitImpersonation}
        className="shrink-0 bg-[#0E1826] text-white px-2 py-0.5 rounded text-[11px] hover:bg-[#16233B]"
      >
        Exit Impersonation
      </button>
    </div>
  );
}
