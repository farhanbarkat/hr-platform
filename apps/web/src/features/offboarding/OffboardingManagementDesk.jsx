import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function OffboardingManagementDesk() {
  const [offboardings, setOffboardings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [selectedItem, setSelectedItem] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchOffboardings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/offboarding');
      setOffboardings(res.data?.data?.offboardings || []);
    } catch {
      setFeedback({ type: 'error', text: 'Failed to load offboarding records.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => fetchOffboardings(), 0);
    return () => clearTimeout(timeout);
  }, []);

  const openDetails = async (offboarding) => {
    try {
      setDetailLoading(true);
      setSelectedItem(offboarding);
      const response = await apiClient.get(`/offboarding/${offboarding._id}/checklist`);
      setChecklist(response.data?.data?.checklist || []);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to load clearance checklist.' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      setActionLoading(id);
      await apiClient.patch(`/offboarding/${id}/acknowledge`, {
        confirmedLastWorkingDate: selectedItem?.lastWorkingDate,
      });
      setFeedback({ type: 'success', text: 'Resignation acknowledged & clearance initiated.' });
      fetchOffboardings();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Action failed.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSettle = async (id) => {
    if (checklist.some((item) => item.status === 'pending')) {
      setFeedback({ type: 'error', text: 'Complete every clearance checklist item before calculating final settlement.' });
      return;
    }
    try {
      setActionLoading(id);
      await apiClient.post(`/offboarding/${id}/settle`, { encashLeaves: true });
      setFeedback({ type: 'success', text: 'Final settlement computed successfully.' });
      fetchOffboardings();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Settlement failed.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteExit = async (id) => {
    try {
      setActionLoading(id);
      await apiClient.post(`/offboarding/${id}/complete-exit`, {});
      setFeedback({ type: 'success', text: 'Employee exit completed and letters published!' });
      fetchOffboardings();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Exit completion failed.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleChecklistUpdate = async (item, status) => {
    try {
      setActionLoading(item._id);
      const response = await apiClient.patch(`/offboarding/checklist/${item._id}`, { status });
      setChecklist((current) => current.map((entry) => entry._id === item._id ? { ...entry, ...(response.data?.data || {}), status } : entry));
      setFeedback({ type: 'success', text: 'Clearance checklist updated.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Checklist update failed.' });
    } finally {
      setActionLoading(null);
    }
  };

  const getArtifactUrl = (url) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    const origin = (apiClient.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '');
    return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
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
                  <tr key={o._id} onClick={() => openDetails(o)} className="cursor-pointer hover:bg-[#FAF8F5]">
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
                          onClick={(event) => { event.stopPropagation(); handleAcknowledge(o._id); }}
                          disabled={actionLoading === o._id}
                          className="px-2.5 py-1 bg-[#16233B] text-white font-mono rounded text-[10px] cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      )}
                      {(o.status === 'clearanceInProgress' || o.status === 'cleared') && (
                        <button
                          onClick={(event) => { event.stopPropagation(); handleSettle(o._id); }}
                          disabled={actionLoading === o._id || checklist.some((item) => item.status === 'pending')}
                          className="px-2.5 py-1 bg-[#8C5D17] text-white font-mono rounded text-[10px] cursor-pointer"
                        >
                          Run Settlement
                        </button>
                      )}
                      {o.status === 'settled' && (
                        <button
                          onClick={(event) => { event.stopPropagation(); handleCompleteExit(o._id); }}
                          disabled={actionLoading === o._id}
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

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-[#E3DED4] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E3DED4] bg-[#FAF8F5] px-5 py-4"><div><span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">EXIT GOVERNANCE // OFFBOARDING DETAIL</span><h2 className="mt-1 text-lg font-serif font-bold">{selectedItem.employeeId?.firstName} {selectedItem.employeeId?.lastName}</h2></div><button type="button" onClick={() => setSelectedItem(null)} className="p-1 text-xl text-[#728294]">&times;</button></div>
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4"><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Resignation date<input disabled value={selectedItem.resignationDate ? new Date(selectedItem.resignationDate).toISOString().slice(0, 10) : ''} className="mt-1 w-full rounded border border-[#D8D3C7] bg-[#F3F1ED] px-2 py-2 text-xs" /></label><label className="text-[10px] font-mono font-bold uppercase text-[#728294]">Last working date<input type="date" disabled={selectedItem.status !== 'submitted'} value={selectedItem.lastWorkingDate ? new Date(selectedItem.lastWorkingDate).toISOString().slice(0, 10) : ''} onChange={(event) => setSelectedItem((current) => ({ ...current, lastWorkingDate: event.target.value }))} className="mt-1 w-full rounded border border-[#D8D3C7] px-2 py-2 text-xs" /></label><div><span className="text-[10px] font-mono font-bold uppercase text-[#728294]">Status</span><p className="mt-1 rounded bg-[#FAF4E8] px-2 py-2 text-xs font-mono font-bold text-[#8C5D17]">{selectedItem.status}</p></div><div><span className="text-[10px] font-mono font-bold uppercase text-[#728294]">Reason</span><p className="mt-1 px-1 py-2 text-xs text-[#5B6B79]">{selectedItem.reason}</p></div></div>
              <section className="rounded border border-[#E3DED4] p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">Clearance checklist</h3><span className="text-xs font-mono text-[#8C5D17]">{checklist.filter((item) => item.status !== 'pending').length}/{checklist.length} complete</span></div>{detailLoading ? <p className="text-xs text-[#728294]">Loading checklist...</p> : checklist.length === 0 ? <p className="text-xs text-[#728294]">No checklist items found.</p> : <div className="space-y-2">{checklist.map((item) => <div key={item._id} className="flex flex-col gap-2 rounded border border-[#EFECE6] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold">{item.title || item.itemType}</p><p className="text-[11px] text-[#728294]">{item.description}</p></div><button type="button" disabled={actionLoading === item._id || item.status === 'completed'} onClick={() => handleChecklistUpdate(item, item.status === 'pending' ? 'completed' : 'pending')} className={`rounded px-3 py-1.5 text-[10px] font-mono font-bold ${item.status === 'completed' ? 'bg-[#EBF7F0] text-[#1E7E34]' : 'bg-[#8C5D17] text-white'}`}>{item.status === 'completed' ? 'COMPLETED' : 'MARK COMPLETE'}</button></div>)}</div>}</section>
              {selectedItem.settlementDetails && <section className={`rounded border p-4 ${selectedItem.settlementDetails.isNegativeBalance ? 'border-[#F5C2BA] bg-[#FDEEEB]' : 'border-[#C6EAD3] bg-[#EBF7F0]'}`}><h3 className={`text-[10px] font-mono font-bold uppercase tracking-wider ${selectedItem.settlementDetails.isNegativeBalance ? 'text-[#B83E28]' : 'text-[#1E7E34]'}`}>Final settlement breakdown</h3><div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><p>Prorated pay <b className="block font-mono">{selectedItem.settlementDetails.proratedGrossSalary}</b></p><p>Leave encashment <b className="block font-mono">{selectedItem.settlementDetails.leaveEncashmentAmount}</b></p><p>Loan deduction <b className="block font-mono">{selectedItem.settlementDetails.outstandingLoanDeduction}</b></p><p>Net settlement <b className="block font-mono">{selectedItem.settlementDetails.netSettlementAmount}</b></p></div>{selectedItem.settlementDetails.isNegativeBalance && <p className="mt-3 font-bold text-[#B83E28]">Negative settlement: this employee owes the company. Manual recovery is required before closure.</p>}</section>}
              <div className="flex flex-wrap justify-end gap-2 border-t border-[#E3DED4] pt-4"><div className="mr-auto flex gap-2">{selectedItem.resignationAcceptanceUrl && <a href={getArtifactUrl(selectedItem.resignationAcceptanceUrl)} target="_blank" rel="noreferrer" className="rounded border border-[#D8D3C7] px-3 py-2 text-[10px] font-mono font-bold text-[#8C5D17]">RESIGNATION LETTER</a>}{selectedItem.relievingLetterUrl && <a href={getArtifactUrl(selectedItem.relievingLetterUrl)} target="_blank" rel="noreferrer" className="rounded border border-[#D8D3C7] px-3 py-2 text-[10px] font-mono font-bold text-[#8C5D17]">RELIEVING LETTER</a>}{selectedItem.experienceLetterUrl && <a href={getArtifactUrl(selectedItem.experienceLetterUrl)} target="_blank" rel="noreferrer" className="rounded border border-[#D8D3C7] px-3 py-2 text-[10px] font-mono font-bold text-[#8C5D17]">EXPERIENCE LETTER</a>}</div>{selectedItem.status === 'submitted' && <button type="button" onClick={() => handleAcknowledge(selectedItem._id)} disabled={actionLoading === selectedItem._id} className="rounded bg-[#16233B] px-3 py-2 text-[10px] font-mono font-bold text-white">ACKNOWLEDGE</button>}{['clearanceInProgress', 'cleared'].includes(selectedItem.status) && <button type="button" onClick={() => handleSettle(selectedItem._id)} disabled={actionLoading === selectedItem._id || checklist.some((item) => item.status === 'pending')} className="rounded bg-[#8C5D17] px-3 py-2 text-[10px] font-mono font-bold text-white disabled:opacity-50">{checklist.some((item) => item.status === 'pending') ? 'COMPLETE CHECKLIST FIRST' : 'CALCULATE SETTLEMENT'}</button>}{selectedItem.status === 'settled' && <button type="button" onClick={() => handleCompleteExit(selectedItem._id)} disabled={actionLoading === selectedItem._id} className="rounded bg-[#1E7E34] px-3 py-2 text-[10px] font-mono font-bold text-white">COMPLETE EXIT</button>}<button type="button" onClick={() => setSelectedItem(null)} className="rounded border border-[#D8D3C7] px-3 py-2 text-[10px] font-mono font-bold">CLOSE</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}