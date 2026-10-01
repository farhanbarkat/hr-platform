import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient.js';

const priorityStyles = {
  normal: 'border-[#D8D3C7] bg-white',
  urgent: 'border-[#E8D4B5] bg-[#FAF4E8]',
  critical: 'border-[#F5C2BA] bg-[#FDEEEB]',
};

export default function AnnouncementFeed() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnnouncements = useCallback(async () => {
    try {
      const response = await apiClient.get('/announcements/feed');
      const payload = response.data?.data || response.data || [];
      setAnnouncements(Array.isArray(payload) ? payload : []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load announcements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(loadAnnouncements, 0);
    return () => window.clearTimeout(timeout);
  }, [loadAnnouncements]);

  return (
    <section className="space-y-3" aria-labelledby="announcements-heading">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">
            COMPANY COMMS
          </span>
          <h2 id="announcements-heading" className="mt-0.5 text-base font-bold text-[#16233B]">
            Announcements
          </h2>
        </div>
        {!loading && <span className="text-[10px] font-mono text-[#728294]">{announcements.length} active</span>}
      </div>

      {loading && <div className="rounded-lg border border-[#E3DED4] bg-white p-5 text-xs font-mono text-[#728294]">Loading announcements...</div>}
      {error && <div className="rounded-lg border border-[#F5C2BA] bg-[#FDEEEB] p-4 text-xs font-mono text-[#B83E28]">{error}</div>}
      {!loading && !error && announcements.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#D8D3C7] bg-white p-5 text-xs font-mono text-[#728294]">
          No announcements for your audience scope.
        </div>
      )}

      <div className="space-y-3">
        {announcements.map((announcement) => {
          const priority = announcement.priority || 'normal';
          const author = announcement.publishedBy?.firstName
            ? `${announcement.publishedBy.firstName} ${announcement.publishedBy.lastName || ''}`.trim()
            : announcement.publishedBy?.email || 'Company Admin';

          return (
            <article
              key={announcement._id}
              className={`rounded-lg border p-4 shadow-2xs ${priorityStyles[priority] || priorityStyles.normal}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-[#16233B]">{announcement.title}</h3>
                <span className="rounded border border-[#E3DED4] bg-white/70 px-2 py-0.5 text-[9px] font-mono font-bold uppercase text-[#8C5D17]">
                  {announcement.targetAudience || 'all'}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[#546274]">{announcement.body}</p>
              <div className="mt-3 flex flex-wrap gap-x-3 text-[10px] font-mono text-[#728294]">
                <span>By {author}</span>
                {announcement.createdAt && <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
