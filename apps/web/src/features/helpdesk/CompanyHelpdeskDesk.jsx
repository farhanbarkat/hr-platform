import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function CompanyHelpdeskDesk() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  
  // Action states
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [updating, setUpdating] = useState(false);

  // 1. Fetch Triage Queue (HR / Admin view)
  const fetchTriageQueue = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const res = await apiClient.get('/helpdesk/queue/triage', { params });
      const payload = res.data?.data || res.data;
      const list = Array.isArray(payload) ? payload : payload.tickets || [];
      
      setTickets(list);
      if (list.length > 0 && !selectedTicketId) {
        setSelectedTicketId(list[0]._id);
      }
    } catch (err) {
      console.error('Failed to fetch triage queue:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, selectedTicketId]);

  useEffect(() => {
    fetchTriageQueue();
  }, [fetchTriageQueue]);

  // 2. Fetch Ticket Details & Thread Comments
  const fetchTicketDetails = useCallback(async (id) => {
    if (!id) return;
    try {
      setLoadingDetail(true);
      const res = await apiClient.get(`/helpdesk/${id}`);
      const data = res.data?.data || res.data;
      setTicketDetail(data.ticket);
      setComments(data.comments || []);
    } catch (err) {
      console.error('Failed to load ticket details:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTicketId) {
      fetchTicketDetails(selectedTicketId);
    }
  }, [selectedTicketId, fetchTicketDetails]);

  // 3. Update Ticket Triage (Status, Priority)
  const handleUpdateStatus = async (newStatus) => {
    if (!selectedTicketId) return;
    try {
      setUpdating(true);
      await apiClient.patch(`/helpdesk/${selectedTicketId}/triage`, { status: newStatus });
      fetchTicketDetails(selectedTicketId);
      fetchTriageQueue();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update ticket status.');
    } finally {
      setUpdating(false);
    }
  };

  // 4. Add Comment / Internal Note
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedTicketId) return;

    try {
      setUpdating(true);
      await apiClient.post(`/helpdesk/${selectedTicketId}/comments`, {
        body: commentText.trim(),
        isInternalNote: isInternal,
      });
      setCommentText('');
      setIsInternal(false);
      fetchTicketDetails(selectedTicketId);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to post comment.');
    } finally {
      setUpdating(false);
    }
  };

  const badgeStyles = {
    OPEN: 'bg-[#B3432E]/15 text-[#B3432E] border-[#B3432E]/30',
    IN_PROGRESS: 'bg-[#C68A2E]/15 text-[#C68A2E] border-[#C68A2E]/30',
    RESOLVED: 'bg-[#2E7D5B]/15 text-[#2E7D5B] border-[#2E7D5B]/30',
    CLOSED: 'bg-[#5B6B79]/15 text-[#5B6B79] border-[#5B6B79]/30',
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-12">
      {/* Header Bar */}
      <div className="flex justify-between items-center pb-4 border-b border-[#E3DED4]">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            HR GOVERNANCE // HELPDESK & TRIAGE
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#16233B] mt-0.5">
            Helpdesk & Escalation Triage
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Manage employee queries, resolve grievances, assign priorities, and maintain internal audit notes.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 bg-white p-3.5 rounded border border-[#D8D3C7]">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[#5B6B79]">STATUS:</span>
          {['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded cursor-pointer ${
                statusFilter === st ? 'bg-[#16233B] text-white font-bold' : 'bg-[#FAF9F6] text-[#5B6B79]'
              }`}
            >
              {st || 'ALL'}
            </button>
          ))}
        </div>
      </div>

      {/* Two-Pane Triage Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tickets Queue */}
        <div className="lg:col-span-5 bg-white rounded-lg border border-[#D8D3C7] overflow-hidden shadow-2xs">
          <div className="p-3 bg-[#FAF9F6] border-b border-[#D8D3C7] font-mono text-xs font-bold text-[#5B6B79]">
            TRIAGE QUEUE ({tickets.length})
          </div>
          <div className="divide-y divide-[#EAE7DF] max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center font-mono text-xs text-[#5B6B79]">Loading triage queue...</div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center font-mono text-xs text-[#5B6B79]">No tickets found in queue.</div>
            ) : (
              tickets.map((t) => (
                <div
                  key={t._id}
                  onClick={() => setSelectedTicketId(t._id)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedTicketId === t._id ? 'bg-[#FAF4E8] border-l-4 border-[#B9812E]' : 'hover:bg-[#FAF9F6]'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px] font-mono text-[#5B6B79] mb-1">
                    <span>{t.ticketNumber}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${badgeStyles[t.status] || badgeStyles.OPEN}`}>
                      {t.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-[#16233B]">{t.title}</h4>
                  <div className="flex justify-between items-center text-[10px] font-mono text-[#728294] mt-2">
                    <span>Category: {t.category}</span>
                    <span className="font-bold text-[#16233B]">{t.priority}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Ticket Inspector & Thread */}
        <div className="lg:col-span-7 bg-white rounded-lg border border-[#D8D3C7] overflow-hidden shadow-2xs flex flex-col h-[650px]">
          {loadingDetail ? (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-[#5B6B79]">
              Loading ticket details...
            </div>
          ) : ticketDetail ? (
            <>
              {/* Ticket Meta Header */}
              <div className="p-4 bg-[#FAF9F6] border-b border-[#D8D3C7]">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#B9812E]">{ticketDetail.ticketNumber}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${badgeStyles[ticketDetail.status]}`}>
                      {ticketDetail.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="text-[#5B6B79]">Action:</span>
                    <button
                      disabled={updating}
                      onClick={() => handleUpdateStatus('IN_PROGRESS')}
                      className="px-2 py-1 bg-[#C68A2E]/10 text-[#C68A2E] border border-[#C68A2E]/30 rounded text-[10px] font-bold cursor-pointer"
                    >
                      In Progress
                    </button>
                    <button
                      disabled={updating}
                      onClick={() => handleUpdateStatus('RESOLVED')}
                      className="px-2 py-1 bg-[#2E7D5B]/10 text-[#2E7D5B] border border-[#2E7D5B]/30 rounded text-[10px] font-bold cursor-pointer"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-sm text-[#16233B] mt-2">{ticketDetail.title}</h3>
                <p className="text-xs text-[#5B6B79] mt-1">{ticketDetail.description}</p>
              </div>

              {/* Comments Thread */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF8F5]/30">
                <div className="text-center font-mono text-[10px] text-[#728294] my-2">--- Discussion & Audit Trail ---</div>
                {comments.length === 0 ? (
                  <div className="text-center font-mono text-xs text-[#728294] py-6">No comments or notes yet.</div>
                ) : (
                  comments.map((c) => (
                    <div
                      key={c._id}
                      className={`p-3 rounded text-xs border ${
                        c.isInternalNote ? 'bg-[#FAF4E8] border-[#E8D4B5]' : 'bg-white border-[#E3DED4]'
                      }`}
                    >
                      <div className="flex justify-between items-center text-[10px] font-mono text-[#728294] mb-1">
                        <span className="font-bold text-[#16233B]">{c.authorId?.email || 'Staff'}</span>
                        {c.isInternalNote && (
                          <span className="px-1 bg-[#8C5D17] text-white rounded text-[9px]">Internal Note</span>
                        )}
                      </div>
                      <p className="text-[#16233B]">{c.body}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Comment Box */}
              <form onSubmit={handleAddComment} className="p-3 border-t border-[#D8D3C7] bg-white space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#5B6B79]">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="accent-[#8C5D17]"
                    />
                    <span>Mark as Internal Note (Hidden from employee)</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type a response or resolution note..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-[#FAF9F6] border border-[#D8D3C7] rounded outline-none focus:border-[#B9812E]"
                  />
                  <button
                    type="submit"
                    disabled={updating || !commentText.trim()}
                    className="px-4 py-2 bg-[#16233B] hover:bg-[#0E1826] text-white text-xs font-mono rounded cursor-pointer disabled:opacity-50"
                  >
                    Reply
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-[#728294]">
              Select a ticket from the queue to triage.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}