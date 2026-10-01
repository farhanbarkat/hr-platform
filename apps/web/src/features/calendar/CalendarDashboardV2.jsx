import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../lib/apiClient.js';

const EVENT_STYLES = {
  HOLIDAY: 'border-l-4 border-emerald-600 bg-emerald-50 text-emerald-900',
  MEETING: 'border-l-4 border-[#8C5D17] bg-[#FAF4E8] text-[#8C5D17]',
  TRAINING: 'border-l-4 border-sky-600 bg-sky-50 text-sky-900',
  DEADLINE: 'border-l-4 border-rose-600 bg-rose-50 text-rose-900',
  OTHER: 'border-l-4 border-slate-500 bg-slate-50 text-slate-800',
};

const pad = (value) => String(value).padStart(2, '0');
const timezoneDateKey = (date, timezone) => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
};

const startOfWeek = (date) => {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  result.setHours(0, 0, 0, 0);
  return result;
};

export default function CalendarDashboard() {
  const [events, setEvents] = useState([]);
  const [timezone, setTimezone] = useState('UTC');
  const [view, setView] = useState('month');
  const [period, setPeriod] = useState(() => new Date());
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

  const range = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeek(period);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    const start = new Date(period.getFullYear(), period.getMonth(), 1);
    const end = new Date(period.getFullYear(), period.getMonth() + 1, 1);
    return { start, end };
  }, [period, view]);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/calendar', {
        params: { start: range.start.toISOString(), end: range.end.toISOString() },
      });
      const payload = response.data?.data || response.data || {};
      setEvents(Array.isArray(payload.events) ? payload.events : (Array.isArray(payload) ? payload : []));
      setTimezone(payload.timezone || 'UTC');
      setFeedback({ type: '', text: '' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to load calendar events.' });
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const visibleDays = useMemo(() => {
    const days = [];
    const first = view === 'week' ? range.start : new Date(period.getFullYear(), period.getMonth(), 1);
    const count = view === 'week' ? 7 : 42;
    const gridStart = view === 'week' ? first : startOfWeek(first);

    for (let index = 0; index < count; index += 1) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      days.push(day);
    }
    return days;
  }, [period, range.start, view]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map();
    visibleDays.forEach((day) => grouped.set(timezoneDateKey(day, timezone), []));
    events.forEach((event) => {
      if (!event.startDate || !event.endDate) return;
      const eventStartKey = timezoneDateKey(new Date(event.startDate), timezone);
      const eventEndKey = timezoneDateKey(new Date(event.endDate), timezone);
      visibleDays.forEach((day) => {
        const dayKey = timezoneDateKey(day, timezone);
        if (eventStartKey <= dayKey && eventEndKey >= dayKey) {
          grouped.get(dayKey)?.push(event);
        }
      });
    });
    return grouped;
  }, [events, timezone, visibleDays]);

  const movePeriod = (amount) => {
    setPeriod((current) => {
      const next = new Date(current);
      if (view === 'week') next.setDate(next.getDate() + amount * 7);
      else next.setMonth(next.getMonth() + amount);
      return next;
    });
  };

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

  const formatEventTime = (event) => {
    if (event.isAllDay) return 'All day';
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(event.startDate));
    } catch {
      return '';
    }
  };

  const periodLabel = view === 'week'
    ? `${range.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${range.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : period.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none font-sans text-[#16233B] pb-24">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#E3DED4]">
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

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#FAF8F5] p-1 rounded border border-[#E3DED4]">
            <button
              type="button"
              onClick={() => setView('month')}
              className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                view === 'month' ? 'bg-[#8C5D17] text-white shadow-xs' : 'text-[#728294] hover:text-[#16233B]'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setView('week')}
              className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                view === 'week' ? 'bg-[#8C5D17] text-white shadow-xs' : 'text-[#728294] hover:text-[#16233B]'
              }`}
            >
              Week
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white text-xs font-mono font-bold rounded cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
          >
            <span>+ Add Event</span>
          </button>
        </div>
      </div>

      {feedback.text && (
        <div className={`p-3 rounded-md text-xs font-mono border flex items-center justify-between ${
          feedback.type === 'success' ? 'bg-[#EBF7F0] border-[#C6EAD3] text-[#1E7E34]' : 'bg-[#FDEEEB] border-[#F5C2BA] text-[#B83E28]'
        }`}>
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback({ type: '', text: '' })} className="font-bold cursor-pointer px-1">&times;</button>
        </div>
      )}

      {/* Calendar Navigation & Grid Container */}
      <div className="bg-white border border-[#E3DED4] rounded-xl overflow-hidden shadow-xs">
        {/* Sub-header Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3DED4] bg-[#FAF8F5]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => movePeriod(-1)}
              className="p-1.5 rounded border border-[#D8D3C7] bg-white text-xs font-mono hover:bg-[#F0ECE5] transition-colors cursor-pointer"
              title="Previous"
            >
              &larr;
            </button>
            <button
              type="button"
              onClick={() => setPeriod(new Date())}
              className="px-3 py-1.5 rounded border border-[#D8D3C7] bg-white text-xs font-mono font-bold hover:bg-[#F0ECE5] transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => movePeriod(1)}
              className="p-1.5 rounded border border-[#D8D3C7] bg-white text-xs font-mono hover:bg-[#F0ECE5] transition-colors cursor-pointer"
              title="Next"
            >
              &rarr;
            </button>
            <h2 className="ml-3 text-sm font-serif font-bold text-[#16233B]">{periodLabel}</h2>
          </div>
          <span className="text-[11px] font-mono text-[#728294] font-semibold bg-white px-2.5 py-1 rounded border border-[#E3DED4]">
            {events.length} active events
          </span>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-[#E3DED4] bg-[#FAF4E8]/40">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-2.5 text-center text-[10px] font-mono font-bold uppercase tracking-wider text-[#728294]">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid Body */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-[#728294] animate-pulse">
            Loading calendar events...
          </div>
        ) : (
          <div className="grid grid-cols-7 bg-[#E3DED4] gap-[1px]">
            {visibleDays.map((day) => {
              const outsideMonth = view === 'month' && day.getMonth() !== period.getMonth();
              const dayKey = timezoneDateKey(day, timezone);
              const dayNumber = new Intl.DateTimeFormat(undefined, { timeZone: timezone, day: 'numeric' }).format(day);
              const dayEvents = eventsByDay.get(dayKey) || [];
              const isToday = timezoneDateKey(new Date(), timezone) === dayKey;

              return (
                <div
                  key={dayKey}
                  className={`min-h-[135px] p-2 flex flex-col transition-colors ${
                    outsideMonth ? 'bg-[#FAF9F6]/60 text-[#A6A39D]' : 'bg-white text-[#16233B]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isToday ? 'bg-[#8C5D17] text-white' : 'text-[#728294]'
                    }`}>
                      {dayNumber}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[9px] font-mono text-[#728294] bg-[#FAF8F5] px-1 rounded">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-[105px] pr-0.5 custom-scrollbar">
                    {dayEvents.map((event) => (
                      <div
                        key={`${event._id}-${dayKey}`}
                        className={`group relative rounded p-1.5 text-[10px] transition-shadow shadow-3xs ${EVENT_STYLES[event.type] || EVENT_STYLES.OTHER}`}
                        title={`${event.title}${event.description ? ` - ${event.description}` : ''}`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-bold truncate leading-tight">{event.title}</span>
                          <button
                            onClick={() => handleDeleteEvent(event._id)}
                            className="opacity-0 group-hover:opacity-100 text-rose-600 hover:text-rose-800 font-bold transition-opacity cursor-pointer text-xs leading-none"
                            title="Delete event"
                          >
                            &times;
                          </button>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-[9px] font-mono opacity-80">
                          <span className="truncate">{formatEventTime(event)}</span>
                          <span className="uppercase text-[8px] font-bold">{event.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: CREATE EVENT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 font-sans animate-fade-in">
          <div className="bg-white border border-[#E3DED4] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#E3DED4] bg-[#FAF8F5]">
              <div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-[#728294] font-semibold">SCHEDULE MANAGEMENT</span>
                <h3 className="text-base font-serif font-bold text-[#16233B]">Create Calendar Event / Holiday</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white border border-[#D8D3C7] flex items-center justify-center text-sm font-bold text-[#728294] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Company Retreat / Eid Holiday"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  className="w-full p-2.5 border border-[#D8D3C7] rounded-md outline-none focus:border-[#8C5D17] transition-colors text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">Event Category</label>
                <select
                  value={eventForm.type}
                  onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}
                  className="w-full p-2.5 border border-[#D8D3C7] rounded-md outline-none focus:border-[#8C5D17] bg-white font-sans text-xs"
                >
                  <option value="HOLIDAY">Holiday</option>
                  <option value="MEETING">Meeting</option>
                  <option value="TRAINING">Training</option>
                  <option value="DEADLINE">Deadline</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                    className="w-full p-2 border border-[#D8D3C7] rounded-md outline-none focus:border-[#8C5D17] font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">End Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                    className="w-full p-2 border border-[#D8D3C7] rounded-md outline-none focus:border-[#8C5D17] font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-[#728294] block mb-1 font-bold">Description / Notes</label>
                <textarea
                  rows="3"
                  placeholder="Optional details, agenda, or location information..."
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full p-2.5 border border-[#D8D3C7] rounded-md outline-none focus:border-[#8C5D17] text-xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#E3DED4]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#D8D3C7] rounded-md text-[#728294] font-medium hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8C5D17] hover:bg-[#784F14] text-white font-mono font-bold rounded-md shadow-xs transition-colors cursor-pointer"
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