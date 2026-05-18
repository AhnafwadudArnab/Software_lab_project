import { useState } from 'react';
import { api } from '../api/client';

function formatDate(value) {
  if (!value) return '--';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ConfidenceBadge({ level }) {
  const styles = {
    sure: { bg: '#dcfce7', fg: '#15803d', label: 'Sure' },
    maybe: { bg: '#fef9c3', fg: '#a16207', label: 'Maybe' },
    not_sure: { bg: '#fee2e2', fg: '#b91c1c', label: 'Not sure' },
  }[level] || { bg: '#f3f4f6', fg: '#374151', label: level || 'Unknown' };

  return (
    <span style={{ background: styles.bg, color: styles.fg, borderRadius: 999, fontSize: 11, fontWeight: 800, padding: '3px 8px' }}>
      {styles.label}
    </span>
  );
}

export default function CaseSightingHistoryCard({ item }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');

  async function toggleHistory() {
    if (history !== null) {
      setOpen(prev => !prev);
      return;
    }

    setOpen(true);
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/sightings/history/${item.id}`);
      setHistory(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'History load করা যায়নি।');
      setHistory({ history: [], total: 0, case_name: item.name, case_id: item.id });
    } finally {
      setLoading(false);
    }
  }

  const rows = history?.history || [];
  const total = history?.total ?? rows.length;
  const image = item.images?.[0] || 'https://placehold.co/360x220?text=No+Photo';

  return (
    <div className="dc-case-card-wrap">
      <div className="dc-case-card">
        <div className="dc-card-photo">
          <img src={image} alt={item.name} />
        </div>

        <div className="dc-card-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span className="dc-card-name" style={{ textDecoration: 'none', cursor: 'default' }}>{item.name}</span>
            <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>{item.id}</span>
          </div>
          <div className="dc-card-meta">
            {item.age && <span>Age: <b>{item.age}</b></span>}
            {item.gender && <span>{item.gender}</span>}
            {item.height && <span>{item.height}</span>}
          </div>
          {item.description && (
            <p className="dc-card-desc">{item.description.slice(0, 90)}{item.description.length > 90 ? '...' : ''}</p>
          )}
        </div>

        <div className="dc-card-info">
          <div className="dc-card-row">
            <span className="dc-card-label">Case ID</span>
            <span className="dc-card-value">{item.id}</span>
          </div>
          <div className="dc-card-row">
            <span className="dc-card-label">Status</span>
            <span className="dc-card-value"><span className={`badge ${item.status}`}>{item.status}</span></span>
          </div>
          <div className="dc-card-row">
            <span className="dc-card-label">Last Seen</span>
            <span className="dc-card-value">{item.last_seen_location || '--'}</span>
          </div>
          {item.last_seen_time && (
            <div className="dc-card-row">
              <span className="dc-card-label">When</span>
              <span className="dc-card-value">{formatDate(item.last_seen_time)}</span>
            </div>
          )}
        </div>

        <div className="dc-card-actions">
          <div className="dc-card-actions-btns" style={{ width: '100%' }}>
            <button
              className="db-mini-btn"
              style={{ background: open ? '#e0f2fe' : '#f0f9ff', color: '#0369a1', width: '100%', justifyContent: 'space-between', display: 'inline-flex' }}
              onClick={toggleHistory}
            >
              <span>History</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{total}</span>
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="dc-history-panel">
          <div className="dc-history-title">
            Sighting History {history?.case_id ? `- ${history.case_id}` : ''}
          </div>

          {loading && (
            <p className="muted">Loading...</p>
          )}

          {error && !loading && (
            <div style={{ color: '#b91c1c', marginBottom: 10, fontSize: 13 }}>{error}</div>
          )}

          {!loading && !error && rows.length === 0 && (
            <p className="muted">No sightings reported yet.</p>
          )}

          {!loading && rows.length > 0 && (
            <div className="dc-history-list">
              {rows.map((entry, index) => (
                <div key={entry.sighting_id || entry.id || index} className="dc-history-item">
                  {entry.image_url && <img src={entry.image_url} alt="sighting" className="dc-history-img" />}
                  <div className="dc-history-body">
                    <div className="dc-history-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                      <span className={`badge ${entry.sighting_status || entry.status || 'pending'}`}>{entry.sighting_status || entry.status || 'pending'}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{formatDate(entry.sighted_at || entry.created_at)}</span>
                      <ConfidenceBadge level={entry.confidence_level} />
                    </div>
                    <div className="dc-history-location">Location: {entry.location_text || 'Not specified'}</div>
                    <div className="dc-history-desc">{entry.description}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      Reporter: {entry.reporter_name || 'Anonymous'}
                    </div>
                    {entry.face_match_score != null && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        Face match: {Number(entry.face_match_score).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}