import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/apiClient.js';

const getArtifactUrl = (artifactUrl) => {
  if (!artifactUrl) return '';
  if (/^https?:\/\//i.test(artifactUrl)) return artifactUrl;
  const apiOrigin = (apiClient.defaults.baseURL || '').replace(/\/api\/v1\/?$/, '');
  return `${apiOrigin}${artifactUrl.startsWith('/') ? artifactUrl : `/${artifactUrl}`}`;
};

export default function PromotionOffersPanel() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const loadPromotions = async () => {
    try {
      const profileResponse = await apiClient.get('/employees/me/profile');
      const employeeId = profileResponse.data?.data?._id;
      if (!employeeId) return;
      const response = await apiClient.get(`/promotions/employee/${employeeId}`);
      const payload = response.data?.data || response.data || [];
      setPromotions(Array.isArray(payload) ? payload : []);
    } catch (error) {
      setFeedback({ ok: false, text: error.response?.data?.message || 'Unable to load promotion offers.' });
    } finally { setLoading(false); }
  };

  useEffect(() => { const timeout = setTimeout(loadPromotions, 0); return () => clearTimeout(timeout); }, []);

  const respond = async (promotionId, response) => {
    try {
      setWorkingId(promotionId);
      await apiClient.patch(`/promotions/${promotionId}/respond`, { response });
      setFeedback({ ok: true, text: response === 'accept' ? 'Promotion accepted. Your profile and salary revision were updated.' : 'Promotion offer declined.' });
      await loadPromotions();
    } catch (error) {
      setFeedback({ ok: false, text: error.response?.data?.message || 'Unable to respond to promotion offer.' });
    } finally { setWorkingId(null); }
  };

  if (loading || promotions.filter((promotion) => promotion.status === 'offerSent').length === 0) return null;
  const offers = promotions.filter((promotion) => promotion.status === 'offerSent');

  return <section className="rounded-lg border border-[#E8D4B5] bg-[#FAF4E8] p-5 shadow-2xs"><div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8C5D17]">CAREER UPDATE // OFFER</span><h2 className="mt-1 text-lg font-serif font-bold text-[#16233B]">Promotion offer awaiting your response</h2></div><span className="rounded border border-[#E8D4B5] px-2 py-1 text-[10px] font-mono text-[#8C5D17]">{offers.length} OFFER{offers.length === 1 ? '' : 'S'}</span></div>{feedback && <div className={`mt-3 rounded border p-2 text-xs ${feedback.ok ? 'border-[#C6EAD3] bg-[#EBF7F0] text-[#1E7E34]' : 'border-[#F5C2BA] bg-[#FDEEEB] text-[#B83E28]'}`}>{feedback.text}</div>}{offers.map((promotion) => <div key={promotion._id} className="mt-4 rounded border border-[#E3DED4] bg-white p-4"><p className="text-xs text-[#5B6B79]">Your role changes from <b>{promotion.previousDesignation}</b> to <b className="text-[#16233B]">{promotion.newDesignation}</b>.</p><p className="mt-1 text-xs text-[#5B6B79]">Effective: <b>{new Date(promotion.effectiveDate).toLocaleDateString()}</b> · Revised gross: <b className="font-mono">{promotion.proposedSalary?.currency || 'PKR'} {promotion.proposedSalary?.grossSalary}</b></p>{promotion.letterArtifactUrl && <a href={getArtifactUrl(promotion.letterArtifactUrl)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-mono font-bold text-[#8C5D17] underline">VIEW PROMOTION LETTER</a>}<div className="mt-4 flex gap-2"><button type="button" disabled={workingId === promotion._id} onClick={() => respond(promotion._id, 'decline')} className="rounded border border-[#B83E28] px-3 py-2 text-xs font-mono font-bold text-[#B83E28] disabled:opacity-50">DECLINE</button><button type="button" disabled={workingId === promotion._id} onClick={() => respond(promotion._id, 'accept')} className="rounded bg-[#1E7E34] px-3 py-2 text-xs font-mono font-bold text-white disabled:opacity-50">{workingId === promotion._id ? 'PROCESSING...' : 'ACCEPT PROMOTION'}</button></div></div>)}</section>;
}
