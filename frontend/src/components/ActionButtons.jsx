import { useState } from 'react';
import { api } from '../api/client';

/**
 * ActionButtons — 4.3
 * Props:
 *   type: 'case' | 'sighting'
 *   id: string
 *   currentStatus: string
 *   onAction: (id, newStatus) => void
 */
export default function ActionButtons({ type, id, currentStatus, onAction }) {
  const [loading, setLoading] = useState(null); // which button is loading
  const [done, setDone] = useState(false);       // 4.3.4 — disable after action
  const [doneStatus, setDoneStatus] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');        // 10.1.3 — confirmation toast

  async function handleAction(action) {
    if (done) return;
    setLoading(action);
    setError('');
    // 10.1.4 — disable immediately on click
    try {
      if (type === 'case') {
        if (action === 'approve') {
          await api.patch(`/cases/${id}/status`, { status: 'verified' });
          finish('verified', 'Case approved ✅');
        } else if (action === 'reject') {
          await api.patch(`/cases/${id}/status`, { status: 'rejected' });
          finish('rejected', 'Case rejected ❌');
        } else if (action === 'request_info') {
          await api.post(`/cases/${id}/request-info`, { notes: 'Please provide additional information for your case.' });
          finish(currentStatus, 'Info requested 📩');
        }
      } else if (type === 'sighting') {
        if (action === 'verify') {
          await api.patch(`/sightings/${id}/status`, { status: 'verified' });
          finish('verified', 'Sighting verified ✅');
        } else if (action === 'reject') {
          await api.patch(`/sightings/${id}/status`, { status: 'rejected' });
          finish('rejected', 'Sighting rejected ❌');
        } else if (action === 'flag') {
          // 10.1.1 — flag action
          await api.patch(`/sightings/${id}/status`, { status: 'flagged' });
          finish('flagged', 'Sighting flagged 🚩');
        }
      }
    } catch (err) {
      // 10.1.5 — re-enable on failure
      setError(err.response?.data?.message || 'Action failed. Please try again.');
      setLoading(null);
    }
  }

  function finish(newStatus, message) {
    setDone(true);
    setDoneStatus(newStatus);
    setToast(message);
    setLoading(null);
    onAction?.(id, newStatus);
    // Clear toast after 4 seconds
    setTimeout(() => setToast(''), 4000);
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className={`badge ${doneStatus}`}>{doneStatus}</span>
        {toast && (
          <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{toast}</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {error && (
        <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 4 }}>⚠️ {error}</div>
      )}
      <div className="db-btn-group">
        {type === 'case' && (
          <>
            <button
              className="db-mini-btn verify"
              onClick={() => handleAction('approve')}
              disabled={loading !== null}
            >
              {loading === 'approve' ? <span className="btn-spinner" /> : null}
              Approve
            </button>
            <button
              className="db-mini-btn reject"
              onClick={() => handleAction('reject')}
              disabled={loading !== null}
            >
              {loading === 'reject' ? <span className="btn-spinner" /> : null}
              Reject
            </button>
            <button
              className="db-mini-btn pending"
              onClick={() => handleAction('request_info')}
              disabled={loading !== null}
            >
              {loading === 'request_info' ? <span className="btn-spinner" /> : null}
              Request Info
            </button>
          </>
        )}
        {type === 'sighting' && (
          <>
            <button
              className="db-mini-btn verify"
              onClick={() => handleAction('verify')}
              disabled={loading !== null}
            >
              {loading === 'verify' ? <span className="btn-spinner" /> : null}
              Verify
            </button>
            <button
              className="db-mini-btn reject"
              onClick={() => handleAction('reject')}
              disabled={loading !== null}
            >
              {loading === 'reject' ? <span className="btn-spinner" /> : null}
              Reject
            </button>
            <button
              className="db-mini-btn flag"
              onClick={() => handleAction('flag')}
              disabled={loading !== null}
            >
              {loading === 'flag' ? <span className="btn-spinner" /> : null}
              Flag
            </button>
          </>
        )}
      </div>
    </div>
  );
}
