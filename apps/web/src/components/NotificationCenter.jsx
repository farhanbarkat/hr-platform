import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/apiClient.js';

const getNotificationRoute = (notification) => {
  const data = notification.data || {};
  if (typeof data.route === 'string' && data.route.startsWith('/')) return data.route;
  if (data.announcementId) return '/employee/dashboard';
  if (notification.category === 'LEAVE') return '/employee/dashboard';
  if (notification.category === 'TASK') return '/company-admin/tasks';
  if (notification.category === 'PAYROLL') return '/employee/dashboard';
  return null;
};

export default function NotificationCenter() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/notifications', { params: { page: 1, limit: 20 } });
      const payload = response.data?.data || response.data || {};
      setNotifications(Array.isArray(payload.notifications) ? payload.notifications : []);
      setUnreadCount(Number(payload.totalUnread) || 0);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(loadNotifications, 0);
    const interval = window.setInterval(loadNotifications, 30000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [loadNotifications]);

  const markRead = async (notification) => {
    if (!notification.isRead) {
      try {
        await apiClient.patch(`/notifications/${notification._id}/read`);
        setNotifications((current) => current.map((item) => (
          item._id === notification._id ? { ...item, isRead: true } : item
        )));
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch {
        // Keep the notification visible if the read update fails.
      }
    }

    const route = getNotificationRoute(notification);
    if (route) {
      setOpen(false);
      navigate(route);
    }
  };

  const markAllRead = async () => {
    try {
      await apiClient.patch('/notifications/read-all');
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Leave the current unread state intact when the server rejects the update.
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative rounded-[6px] p-2 text-[#5B6B79] transition-colors hover:bg-[#E4E0D5]/60 hover:text-[#16233B]"
      >
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex min-h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#B3432E] px-0.5 text-[9px] font-mono font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[#D8D3C7] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#E3DED4] bg-[#FAF8F5] px-4 py-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#16233B]">Notifications</h2>
              <p className="mt-0.5 text-[10px] font-mono text-[#728294]">{unreadCount} unread</p>
            </div>
            <button type="button" onClick={markAllRead} disabled={!unreadCount} className="text-[10px] font-mono font-bold text-[#8C5D17] disabled:opacity-40">
              Mark all read
            </button>
          </div>
          <div className="max-h-[min(420px,70vh)] overflow-y-auto divide-y divide-[#F4F1EA]">
            {loading && <p className="p-5 text-center text-xs font-mono text-[#728294]">Loading notifications...</p>}
            {!loading && notifications.length === 0 && <p className="p-5 text-center text-xs font-mono text-[#728294]">No notifications yet.</p>}
            {!loading && notifications.map((notification) => (
              <button
                key={notification._id}
                type="button"
                onClick={() => markRead(notification)}
                className={`w-full px-4 py-3 text-left transition-colors hover:bg-[#FAF8F5] ${notification.isRead ? 'bg-white' : 'bg-[#FFFDF5]'}`}
              >
                <div className="flex items-start gap-2">
                  {!notification.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#B9812E]" />}
                  <span className={notification.isRead ? 'ml-4' : ''}>
                    <span className="block text-xs font-bold text-[#16233B]">{notification.title}</span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-[#5B6B79]">{notification.message}</span>
                    {notification.createdAt && <span className="mt-1 block text-[9px] font-mono text-[#728294]">{new Date(notification.createdAt).toLocaleString()}</span>}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
