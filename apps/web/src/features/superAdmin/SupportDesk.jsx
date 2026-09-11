import React, { useState, useEffect } from 'react';
import { Card, Button } from '@repo/ui';
import { apiClient } from '../../lib/apiClient.js';

export default function SupportDesk() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live Backend Tickets Fetch
  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/super-admin/advanced/support-tickets');
      console.log('✅ Live Backend Support Tickets Response:', response.data);

      const raw = response.data?.data ?? response.data;
      let list = [];

      if (Array.isArray(raw)) {
        list = raw;
      } else if (Array.isArray(raw?.tickets)) {
        list = raw.tickets;
      } else if (Array.isArray(raw?.supportTickets)) {
        list = raw.supportTickets;
      } else if (Array.isArray(raw?.docs)) {
        list = raw.docs;
      }

      if (list.length > 0) {
        const formatted = list.map((t, idx) => {
          // Extract populated company name
          const compName =
            t.companyId?.name ||
            t.companyName ||
            (t.companyId ? `Tenant (${String(t.companyId).slice(-4)})` : 'Tenant Organization');

          // Extract requester from populated createdBy
          const requesterName =
            t.createdBy?.name ||
            t.createdBy?.email ||
            t.requesterName ||
            'Tenant Admin';

          // Build message conversation thread: User Description + Super Admin Notes
          const threadMessages = [];

          // 1. Initial User Message
          threadMessages.push({
            id: `msg_init_${t._id || idx}`,
            sender: `${requesterName} (Company Admin)`,
            role: 'user',
            time: t.createdAt
              ? new Date(t.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'Initial Inquiry',
            text: t.description || t.subject || 'Support issue logged.',
          });

          // 2. Super Admin Resolution/Notes if already present in DB
          if (t.adminNotes) {
            threadMessages.push({
              id: `msg_admin_${t._id || idx}`,
              sender: 'System Root (Super Admin)',
              role: 'admin',
              time: t.resolvedAt || t.updatedAt
                ? new Date(t.resolvedAt || t.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Recorded Note',
              text: t.adminNotes,
            });
          }

          return {
            id: t.ticketNumber || t.ticketRef || t._id || `TCK-${8900 + idx}`,
            rawId: t._id || t.id,
            subject: t.subject || t.title || 'Support Escalation',
            company: compName,
            requester: requesterName,
            status: String(t.status || 'OPEN').toUpperCase(),
            priority: t.priority || 'MEDIUM',
            adminNotes: t.adminNotes || '',
            updatedAt: t.updatedAt
              ? new Date(t.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Just now',
            messages: threadMessages,
          };
        });

        setTickets(formatted);
        setSelectedTicketId((prev) => prev || formatted[0]?.id);
      } else {
        setTickets([]);
      }
    } catch (err) {
      console.error('Failed to load support tickets from backend:', err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const activeTicket = tickets.find((t) => t.id === selectedTicketId) || tickets[0];

  const badgeStyles = {
    OPEN: 'bg-[#B3432E]/15 text-[#B3432E] border-[#B3432E]/30',
    IN_PROGRESS: 'bg-[#C68A2E]/15 text-[#C68A2E] border-[#C68A2E]/30',
    RESOLVED: 'bg-[#2E7D5B]/15 text-[#2E7D5B] border-[#2E7D5B]/30',
    CLOSED: 'bg-[#5B6B79]/15 text-[#5B6B79] border-[#5B6B79]/30',
  };

  // Helper to hit updateSupportTicket backend controller
  const patchTicketBackend = async (ticketId, payload) => {
    // Try primary route then fallback to route without /status
    try {
      return await apiClient.patch(`/super-admin/advanced/support-tickets/${ticketId}`, payload);
    } catch (err) {
      if (err.response?.status === 404) {
        return await apiClient.patch(`/super-admin/advanced/support-tickets/${ticketId}/status`, payload);
      }
      throw err;
    }
  };

  // Quick Status Setter
  const handleStatusChange = async (newStatus) => {
    if (!activeTicket?.rawId) return;

    // Optimistic UI update
    setTickets((prev) =>
      prev.map((t) => (t.id === activeTicket.id ? { ...t, status: newStatus } : t))
    );

    try {
      await patchTicketBackend(activeTicket.rawId, { status: newStatus });
    } catch (err) {
      console.error('Failed to update ticket status on server:', err);
      alert(err.response?.data?.message || 'Failed to update ticket status.');
    }
  };

  // Send Response (Saves to backend as adminNotes & updates status to IN_PROGRESS)
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicket?.rawId || submitting) return;

    const messageContent = replyText.trim();
    const newAdminMessage = {
      id: `m_${Date.now()}`,
      sender: 'System Root (Super Admin)',
      role: 'admin',
      time: 'Just now',
      text: messageContent,
    };

    const nextStatus = activeTicket.status === 'OPEN' ? 'IN_PROGRESS' : activeTicket.status;

    // Optimistic UI update
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id === activeTicket.id) {
          return {
            ...t,
            status: nextStatus,
            adminNotes: messageContent,
            messages: [...t.messages, newAdminMessage],
            updatedAt: 'Just now',
          };
        }
        return t;
      })
    );

    setReplyText('');
    setSubmitting(true);

    try {
      // Hits updateSupportTicket controller with { adminNotes, status }
      await patchTicketBackend(activeTicket.rawId, {
        adminNotes: messageContent,
        status: nextStatus,
      });
      console.log('✅ Admin response successfully persisted to backend database.');
    } catch (err) {
      console.error('Failed to dispatch response to backend:', err);
      alert(err.response?.data?.message || 'Server failed to save admin response.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1380px] mx-auto select-none font-sans">
      {/* Page Header */}
      <div className="border-b border-[#D8D3C7] pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-xl font-bold font-mono text-[#16233B]">Support Desk</h1>
          <p className="text-xs font-mono text-[#5B6B79] mt-0.5">
            Tenant issue escalation triage, audit correspondence & support SLAs
          </p>
        </div>
        {loading && (
          <span className="text-xs font-mono text-[#B9812E] animate-pulse">
            Syncing live tickets...
          </span>
        )}
      </div>

      {/* Two-Pane Container */}
      <div className="flex flex-col lg:flex-row h-[680px] border border-[#D8D3C7] rounded-[8px] bg-white overflow-hidden shadow-2xs">
        {/* Left Pane: Ticket Feed */}
        <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-[#D8D3C7] flex flex-col bg-[#F6F5F1]/40">
          <div className="p-3.5 border-b border-[#D8D3C7] bg-[#F6F5F1] flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#16233B]">
              Active Escalations ({tickets.length})
            </span>
            <span className="text-[10px] font-mono text-[#5B6B79]">Live Sync</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E4E0D5]">
            {tickets.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-[#5B6B79]">
                {loading ? 'Fetching escalations...' : 'No support tickets recorded in database.'}
              </div>
            ) : (
              tickets.map((t) => {
                const isSelected = t.id === activeTicket?.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`w-full p-4 text-left transition-colors cursor-pointer flex flex-col gap-2 ${
                      isSelected ? 'bg-white border-l-4 border-l-[#B9812E]' : 'hover:bg-[#F6F5F1]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-[#5B6B79]">[{String(t.id).slice(-8)}]</span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[9px] font-mono font-bold uppercase border ${
                          badgeStyles[t.status] || badgeStyles.OPEN
                        }`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-[#16233B] line-clamp-2 leading-snug">
                      {t.subject}
                    </p>

                    <div className="flex items-center justify-between text-[11px] font-mono text-[#5B6B79] pt-1">
                      <span className="truncate max-w-[160px] font-medium text-[#16233B]">
                        {t.company}
                      </span>
                      <span className="text-[10px]">{t.updatedAt}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Conversation & Action Console */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {activeTicket ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-[#D8D3C7] bg-[#F6F5F1]/60 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#B9812E]">[{String(activeTicket.id).slice(-8)}]</span>
                    <span
                      className={`px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-bold border ${
                        badgeStyles[activeTicket.status] || badgeStyles.OPEN
                      }`}
                    >
                      {activeTicket.status}
                    </span>
                    <span className="text-[10px] font-mono text-[#5B6B79] px-2 py-0.5 bg-[#FAF9F5] rounded border border-[#E4E0D5]">
                      Priority: {activeTicket.priority}
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-[#16233B] mt-1">{activeTicket.subject}</h2>
                  <p className="text-xs font-mono text-[#5B6B79] mt-0.5">
                    Requester: {activeTicket.requester} • Tenant: {activeTicket.company}
                  </p>
                </div>

                {/* Quick Status Setter */}
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-[#5B6B79] text-[11px]">Set Status:</span>
                  <button
                    type="button"
                    onClick={() => handleStatusChange('IN_PROGRESS')}
                    className="px-2 py-1 bg-[#C68A2E]/10 hover:bg-[#C68A2E]/20 text-[#C68A2E] border border-[#C68A2E]/30 rounded text-[11px] font-semibold cursor-pointer"
                  >
                    In Progress
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange('RESOLVED')}
                    className="px-2 py-1 bg-[#2E7D5B]/10 hover:bg-[#2E7D5B]/20 text-[#2E7D5B] border border-[#2E7D5B]/30 rounded text-[11px] font-semibold cursor-pointer"
                  >
                    Resolve
                  </button>
                </div>
              </div>

              {/* Conversation Stream */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#F6F5F1]/20">
                {activeTicket.messages.map((m) => {
                  const isAdmin = m.role === 'admin';

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col max-w-[85%] ${
                        isAdmin ? 'ml-auto items-end' : 'mr-auto items-start'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-mono font-semibold text-[#16233B]">
                          {m.sender}
                        </span>
                        <span className="text-[10px] font-mono text-[#5B6B79]">{m.time}</span>
                      </div>
                      <div
                        className={`p-3.5 rounded-[8px] text-xs leading-relaxed border ${
                          isAdmin
                            ? 'bg-[#16233B] text-[#F6F5F1] border-[#0E1826]'
                            : 'bg-white text-[#16233B] border-[#D8D3C7]'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <form onSubmit={handleSendReply} className="p-4 border-t border-[#D8D3C7] bg-white space-y-3">
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type response notes to update ticket on server..."
                  className="w-full p-3 text-xs bg-[#F6F5F1]/50 border border-[#D8D3C7] rounded-[6px] text-[#16233B] placeholder-[#8796A5] font-sans focus:outline-none focus:border-[#B9812E] focus:ring-1 focus:ring-[#B9812E] resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#5B6B79]">
                    Saving updates `adminNotes` and marks status as IN_PROGRESS in MongoDB.
                  </span>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={submitting || !replyText.trim()}
                    className="text-xs font-mono py-1.5 px-4 cursor-pointer"
                  >
                    {submitting ? 'Updating...' : 'Send Response'}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-[#5B6B79] font-mono text-xs">
              Select an escalation to inspect correspondence
            </div>
          )}
        </div>
      </div>
    </div>
  );
}