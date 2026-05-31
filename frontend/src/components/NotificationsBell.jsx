import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function NotificationsBell() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function fetchNotes() {
      if (!user) return setNotes([]);
      setLoading(true);
      try {
        // Admins and police should be able to see broader notifications
        const scope = (user.role === 'admin' || user.role === 'police') ? '?all=true' : '';
        const { data } = await api.get(`/notifications${scope}`);
        if (!mounted) return;
        setNotes(data);
      } catch {
        // ignore — user may be unauthenticated or network error
      } finally {
        setLoading(false);
      }
    }
    fetchNotes();
    const id = setInterval(fetchNotes, 10000);
    return () => { mounted = false; clearInterval(id); };
  }, [user]);

  const unreadCount = notes.filter(n => !n.read).length;

  async function handleClickNote(n) {
    try {
      await api.patch(`/notifications/${n.id}/read`);
    } catch {
      // ignore
    }
    setNotes(s => s.map(x => (x.id === n.id ? { ...x, read: true } : x)));
    // Navigate to case if present, otherwise fall back to general cases list
    if (n.case_id) nav(`/cases/${n.case_id}`);
    else nav('/cases');
    setOpen(false);
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotes(s => s.map(x => ({ ...x, read: true })));
    } catch {
      // ignore
    }
  }

  return (
    <div className="nav-notifications" ref={ref} style={{ position: 'relative', marginRight: 8 }}>
      <button className="btn small outline" onClick={() => setOpen(o => !o)} aria-label="Notifications" style={{ position: 'relative' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', borderRadius: 999, padding: '2px 6px', fontSize: 11, fontWeight: 700 }}>
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="nav-notifications-dropdown" style={{ position: 'absolute', right: 0, top: 40, zIndex: 60 }}>
          <div className="header">
            <strong>Notifications</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn tiny" onClick={markAllRead} disabled={notes.length === 0}>Mark all read</button>
              <button className="btn tiny outline" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
          {!loading && notes.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>No notifications</div>
          )}
          <div className="list">
            <ul>
              {notes.map(n => (
                <li key={n.id} className={n.read ? '' : 'unread'} onClick={() => handleClickNote(n)}>
                  <div className="avatar">
                    {/* Use case initials if available */}
                    {n.case_name ? n.case_name.split(' ').map(s => s[0]).slice(0,2).join('') : '🔔'}
                  </div>
                  <div className="meta">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div className="title">{n.case_name || (n.type || 'Notification')}</div>
                      <div className="time">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                    <div className="msg">{n.message}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
