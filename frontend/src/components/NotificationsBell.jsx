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
        const { data } = await api.get('/notifications');
        if (!mounted) return;
        setNotes(data);
      } catch {
        // ignore — user may be unauthenticated
      } finally {
        setLoading(false);
      }
    }
    fetchNotes();
    const id = setInterval(fetchNotes, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, [user]);

  const unreadCount = notes.filter(n => !n.read).length;
  const typeLabel = {
    found_person_photo: 'Found confirmed',
    new_sighting: 'New sighting',
    face_match: 'Face match',
    request_info: 'Info request',
  };

  async function handleClickNote(n) {
    try {
      await api.patch(`/notifications/${n.id}/read`);
    } catch {
      // ignore
    }
    setNotes(s => s.map(x => (x.id === n.id ? { ...x, read: true } : x)));
    if (n.case_id) nav(`/cases/${n.case_id}`);
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
        <div className="nav-notifications-dropdown" style={{ position: 'absolute', right: 0, top: 40, width: 320, maxHeight: 360, overflow: 'auto', background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', borderRadius: 8, zIndex: 60 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #eee' }}>
            <strong>Notifications</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn tiny" onClick={markAllRead} disabled={notes.length === 0}>Mark all read</button>
              <button className="btn tiny outline" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
          {!loading && notes.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>No notifications</div>
          )}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {notes.map(n => (
              <li key={n.id} style={{ display: 'flex', gap: 8, padding: '10px 12px', borderBottom: '1px solid #f4f4f6', background: n.read ? '#fff' : '#f8fafc', cursor: 'pointer' }} onClick={() => handleClickNote(n)}>
                <div style={{ flex: '0 0 44px' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v1a3 3 0 01-3 3H6a3 3 0 01-3-3v-1"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 700 }}>{n.case_name || typeLabel[n.type] || 'Notification'}</div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{ color: '#374151', marginTop: 6 }}>{n.message}</div>
                  <div style={{ color: '#6b7280', marginTop: 4, fontSize: 12 }}>{typeLabel[n.type] || n.type}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
