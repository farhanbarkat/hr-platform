import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient.js';

export default function CalendarDashboard() {
  const [events, setEvents] = useState([]);
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  // Event Creation Form State
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    type: 'HOLIDAY',
    startDate: '',
    endDate: '',
    isAllDay: true,
  });

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/calendar');
      setEvents(res.data?.data?.events || []);
      setTimezone(res.data?.data?.timezone || 'UTC');
    } catch (err) {
      setFeedback({ type: 'error', text: 'Failed to load calendar events.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post('/calendar', eventForm);
      setFeedback({ type: 'success', text: 'Calendar event created successfully!' });
      setIsModalOpen(false);
      setEventForm({ title: '', description: '', type: 'HOLIDAY', startDate: '', endDate: '', isAllDay: true });
      fetchEvents();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to create event.' });
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await apiClient.delete(`/calendar/${id}`);
      setFeedback({ type: 'success', text: 'Event deleted successfully.' });
      fetchEvents();
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to delete event.' });
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-24">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-[#E3DED4]">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#728294] uppercase font-semibold">
            WORKSPACE // COMPANY CALENDAR & HOLIDAYS
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#16233B] mt-0.5">
            Schedules & Events
          </h1>
          <p className="text-xs text-[#5B6B79] mt-0.5">
            Timezone: <span className="font-mono font-bold text-[#8C5D17]">{timezone}</span>
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-2xs"
        >
          + Add Event / Holiday
        </button>
      </div>

      {feedback.text && (
        <div className={`p-3 rounded text-xs font-mono border ${
          feedback.type === 'success' ? 'bg-[#EBF7F0] border-[#C6EAD3] text-[#1E7E34]' : 'bg-[#FDEEEB] border-[#F5C2BA] text-[#B83E28]'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Events List Grid */}
      <div className="bg-white border border-[#E3DED4] rounded-lg p-5 shadow-2xs space-y-4">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#728294]">
          UPCOMING EVENTS & HOLIDAYS ({events.length})
        </h3>

        {loading ? (
          <div className="py-12 text-center text-xs font-mono text-[#728294]">
            Loading calendar events...
          </div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-[#728294]">
            No calendar events scheduled.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => (
              <div key={ev._id} className="p-4 rounded-lg border border-[#E3DED4] bg-[#FAF8F5] space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-[#16233B]">{ev.title}</span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#FAF4E8] text-[#8C5D17] border border-[#E3DED4] font-bold">
                      {ev.type}
                    </span>
                  </div>
                  {ev.description && (
                    <p className="text-xs text-[#5B6B79] mt-1">{ev.description}</p>
                  )}
                  <div className="text-[10px] font-mono text-[#728294] mt-3 space-y-0.5">
                    <div><b>From:</b> {new Date(ev.startDate).toLocaleString()}</div>
                    <div><b>To:</b> {new Date(ev.endDate).toLocaleString()}</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E3DED4]/60 flex justify-end">
                  <button
                    onClick={() => handleDeleteEvent(ev._id)}
                    className="text-xs font-mono text-[#B83E28] hover:underline cursor-pointer"
                  >
                    Delete Event
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: CREATE EVENT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 font-sans">
          <div className="bg-white border border-[#E3DED4] rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start pb-3 border-b border-[#E3DED4]">
              <h3 className="text-base font-bold text-[#16233B]">Create Calendar Event</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-lg font-bold text-[#728294] cursor-pointer">&times;</button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eid Holidays / Townhall Meeting"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">Type</label>
                <select
                  value={eventForm.type}
                  onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] bg-white font-sans"
                >
                  <option value="HOLIDAY">Holiday</option>
                  <option value="MEETING">Meeting</option>
                  <option value="TRAINING">Training</option>
                  <option value="DEADLINE">Deadline</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">Start Date *</label>
                  <input
                    type="datetime-local"
                    required
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                    className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">End Date *</label>
                  <input
                    type="datetime-local"
                    required
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                    className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17] font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">Description</label>
                <textarea
                  rows="2"
                  placeholder="Optional details..."
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full p-2 border border-[#D8D3C7] rounded outline-none focus:border-[#8C5D17]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-[#D8D3C7] rounded text-[#728294]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#8C5D17] text-white font-mono font-bold rounded cursor-pointer"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}