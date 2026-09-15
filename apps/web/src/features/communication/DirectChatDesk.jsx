import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../../lib/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../hooks/useSocket.js';

export default function DirectChatDesk() {
  const { user } = useAuth();
  const socketRef = useSocket();

  const [conversations, setConversations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch Conversations from backend
  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiClient.get('/chat/conversations');
      const list = res.data?.data || res.data || [];
      setConversations(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Failed to load conversations:', err);
    }
  }, []);

  // 2. Fetch Directory for new conversations
  const fetchEmployees = async () => {
    try {
      const res = await apiClient.get('/employees?limit=200');
      const list = res.data?.data?.employees || res.data?.data || [];
      const safeList = Array.isArray(list) ? list : [];
      // Self employee ko list se exclude karein
      setEmployees(safeList.filter((e) => (e.userId?._id || e.userId) !== user?._id));
    } catch (err) {
      console.warn('Directory fetch failed:', err);
    }
  };

  // 3. Select Conversation & Mark as Read
  const selectConversation = async (peer) => {
    setSelectedPeer(peer);
    setIsNewChatOpen(false);
    try {
      setLoading(true);
      const res = await apiClient.get(`/chat/${peer._id}/messages?limit=100`);
      const thread = res.data?.data?.messages || [];
      setMessages(thread);
      scrollToBottom();

      // Read status trigger
      await apiClient.patch(`/chat/${peer._id}/read`);
      fetchConversations();
    } catch (err) {
      console.warn('Failed to load chat thread:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchEmployees();
  }, [fetchConversations]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 4. Listen to Backend Socket Events
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Incoming Message Listener
    const onMessageReceived = (newMsg) => {
      const peerId = selectedPeer?._id;
      const senderId = newMsg.senderId?._id || newMsg.senderId;
      const recipientId = newMsg.recipientId?._id || newMsg.recipientId;

      if (peerId && (senderId === peerId || recipientId === peerId)) {
        setMessages((prev) => [...prev, newMsg]);
        // Agar active chat hai toh foran mark read karein
        if (senderId === peerId) {
          apiClient.patch(`/chat/${peerId}/read`).catch(() => {});
        }
      }
      fetchConversations();
    };

    // Seen Status Listener
    const onMessagesRead = ({ readBy, readAt }) => {
      if (selectedPeer && selectedPeer._id === readBy) {
        setMessages((prev) =>
          prev.map((m) => (m.readAt ? m : { ...m, readAt: readAt || new Date().toISOString() }))
        );
      }
      fetchConversations();
    };

    socket.on('chat:message_received', onMessageReceived);
    socket.on('chat:messages_read', onMessagesRead);

    return () => {
      socket.off('chat:message_received', onMessageReceived);
      socket.off('chat:messages_read', onMessagesRead);
    };
  }, [socketRef, selectedPeer, fetchConversations]);

  // 5. Send Message Dispatcher
  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !selectedPeer) return;

    const messageBody = text.trim();
    setText('');

    try {
      const res = await apiClient.post('/chat/messages', {
        recipientId: selectedPeer._id,
        body: messageBody,
      });
      const created = res.data?.data;
      if (created) {
        setMessages((prev) => [...prev, created]);
      }
      fetchConversations();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send message.');
    }
  };

  const filteredConversations = conversations.filter((c) =>
    (c.peerUser?.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-125px)] flex bg-white border border-[#E3DED4] rounded-lg shadow-xs overflow-hidden select-none font-sans text-[#16233B]">
      
      {/* LEFT PANE: Active Threads */}
      <div className="w-[340px] shrink-0 border-r border-[#E3DED4] flex flex-col bg-[#FAF8F5]/40">
        
        {/* Header */}
        <div className="p-3.5 border-b border-[#E3DED4] flex items-center justify-between bg-white">
          <div>
            <span className="text-[9.5px] font-mono uppercase tracking-widest text-[#728294] font-bold">
              PHASE 4 // TICKET-034
            </span>
            <h2 className="text-sm font-bold text-[#16233B]">Direct Communications</h2>
          </div>
          <button
            onClick={() => setIsNewChatOpen(!isNewChatOpen)}
            className="px-2.5 py-1 bg-[#8C5D17] hover:bg-[#784F14] text-white text-[11px] font-mono font-bold rounded cursor-pointer transition-all shadow-2xs"
          >
            {isNewChatOpen ? '✕ Close' : '+ New Chat'}
          </button>
        </div>

        {/* Search */}
        <div className="p-2.5 border-b border-[#E3DED4] bg-white">
          <input
            type="text"
            placeholder="Search peer conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 border border-[#D8D3C7] rounded text-xs bg-[#FAF8F5] outline-none focus:border-[#8C5D17] font-mono"
          />
        </div>

        {/* Thread Roster */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F4F1EA]">
          {isNewChatOpen ? (
            <div className="p-3 space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase text-[#728294] block">
                Start Chat with Colleague
              </span>
              <div className="space-y-1">
                {employees.map((emp) => {
                  const peerUserId = emp.userId?._id || emp.userId;
                  return (
                    <button
                      key={emp._id}
                      onClick={() =>
                        selectConversation({
                          _id: peerUserId,
                          email: emp.email,
                          firstName: emp.firstName,
                          lastName: emp.lastName,
                          role: emp.role || 'STAFF',
                        })
                      }
                      className="w-full p-2 rounded text-left hover:bg-white border border-transparent hover:border-[#E3DED4] transition-all flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-bold text-[#16233B]">
                          {emp.firstName} {emp.lastName}
                        </div>
                        <div className="text-[10px] font-mono text-[#728294]">{emp.email}</div>
                      </div>
                      <span className="text-[9px] font-mono text-[#8C5D17] uppercase">
                        {emp.role || 'STAFF'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-[#728294]">
              No active conversations yet. Click "+ New Chat" above.
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isSelected = selectedPeer?._id === c.peerUser._id;
              return (
                <div
                  key={c._id}
                  onClick={() => selectConversation(c.peerUser)}
                  className={`p-3 cursor-pointer transition-all flex items-center justify-between ${
                    isSelected ? 'bg-[#FAF4E8] border-l-3 border-l-[#8C5D17]' : 'hover:bg-white'
                  }`}
                >
                  <div className="overflow-hidden pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#16233B] truncate">
                        {c.peerUser.email.split('@')[0]}
                      </span>
                      <span className="text-[9px] font-mono text-[#8C5D17] border border-[#E3DED4] px-1 rounded">
                        {c.peerUser.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5B6B79] truncate mt-0.5 font-sans">
                      {c.lastMessage?.body}
                    </p>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-[#8C5D17] text-white rounded-full text-[9px] font-mono font-bold shrink-0">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANE: Chat Stream */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedPeer ? (
          <>
            {/* Peer Header */}
            <div className="p-3.5 border-b border-[#E3DED4] bg-[#FAF8F5] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#16233B] text-[#E5B56A] flex items-center justify-center font-bold text-xs font-serif">
                  {selectedPeer.email?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#16233B]">
                    {selectedPeer.firstName
                      ? `${selectedPeer.firstName} ${selectedPeer.lastName || ''}`
                      : selectedPeer.email}
                  </h3>
                  <span className="text-[10px] font-mono text-[#728294]">
                    Tenant Room Enclave // {selectedPeer.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAF8F5]/30">
              {loading ? (
                <div className="text-center py-10 font-mono text-xs text-[#728294]">
                  Decrypting thread messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-10 font-mono text-xs text-[#728294]">
                  No messages exchanged yet. Send a greetings dispatch below.
                </div>
              ) : (
                messages.map((m) => {
                  const isMine = (m.senderId?._id || m.senderId) === user?._id;
                  return (
                    <div
                      key={m._id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-2.5 px-3.5 rounded-lg text-xs font-sans leading-relaxed select-text shadow-2xs ${
                          isMine
                            ? 'bg-[#16233B] text-white rounded-tr-none'
                            : 'bg-white border border-[#D8D3C7] text-[#16233B] rounded-tl-none'
                        }`}
                      >
                        {m.body}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[9px] font-mono text-[#728294] px-1">
                        <span>
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isMine && (
                          <span className={m.readAt ? 'text-[#8C5D17] font-bold' : ''}>
                            {m.readAt ? '✓✓ Seen' : '✓ Sent'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} className="p-3 border-t border-[#E3DED4] bg-white flex gap-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="flex-1 px-3.5 py-2 border border-[#D8D3C7] rounded text-xs outline-none focus:border-[#8C5D17] font-sans"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="px-5 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded cursor-pointer transition-all disabled:opacity-50"
              >
                SEND
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2">
            <span className="text-3xl">💬</span>
            <h3 className="text-sm font-bold text-[#16233B]">Direct Communication Desk</h3>
            <p className="text-xs text-[#5B6B79] max-w-sm">
              Select an active conversation on the left or initiate a new direct thread with any workforce colleague.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}