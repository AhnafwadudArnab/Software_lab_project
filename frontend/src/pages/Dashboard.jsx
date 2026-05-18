import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MapView from '../components/MapView';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { api } from '../api/client';

function ScoreBar({ score }) {
  const color = score >= 90 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626';
  const label = score >= 90 ? 'High Match' : score >= 40 ? 'Possible Match' : 'Low Match';
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color }}>{label}</span>
        <span style={{ fontWeight: 800, color }}>{score}%</span>
      </div>
      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 999, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLang();
  const [cases, setCases] = useState([]);
  const [sightings, setSightings] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('cases');
  const [actionError, setActionError] = useState('');
  const [auditHistory, setAuditHistory] = useState({});
  const [expandedAudit, setExpandedAudit] = useState({});
  const [sightingScan, setSightingScan] = useState({}); // { [sightingId]: { loading, results, error } }
  const [scanImage, setScanImage] = useState(null);
  const [scanPreview, setScanPreview] = useState(null);
  const [scanResults, setScanResults] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const scanFileRef = useRef(null);
  const [pendingEdits, setPendingEdits] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [editingIds, setEditingIds] = useState({});
  // Req 4: found-photo upload state — keyed by case id
  const [foundUploadOpen, setFoundUploadOpen] = useState({});
  const [foundUploadFile, setFoundUploadFile] = useState({});
  const [foundUploadError, setFoundUploadError] = useState({});
  const [foundUploading, setFoundUploading] = useState({});
  // Req 2.3: notification banner
  const [notifications, setNotifications] = useState([]);

  if (!user) return null;

  useEffect(() => {
    const endpoint = ['admin', 'police'].includes(user.role) ? '/cases' : '/cases?mine=true';
    api.get(endpoint)
      .then(r => setCases(r.data))
      .catch(err => console.error('Failed to load cases:', err));
    if (['admin', 'police'].includes(user.role)) {
      api.get('/sightings')
        .then(r => setSightings(r.data))
        .catch(err => console.error('Failed to load sightings:', err));
    }
    if (user.role === 'admin') {
      api.get('/admin/stats')
        .then(r => setStats(r.data))
        .catch(err => console.error('Failed to load stats:', err));
    }
    // Req 2.2: fetch notifications for the current user
    api.get('/notifications')
      .then(r => setNotifications(r.data || []))
      .catch(() => {});
  }, [user.role]);

  async function updateCase(id, status) {
    setActionError('');
    try {
      await api.patch(`/cases/${id}/status`, { status });
      setCases(cases.map(c => c.id === id ? { ...c, status } : c));
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update case status.');
    }
  }

  async function deleteCase(id) {
    if (!window.confirm('Delete this case? This cannot be undone.')) return;
    setActionError('');
    try {
      await api.delete(`/cases/${id}`);
      setCases(cases.filter(c => c.id !== id));
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to delete case.');
    }
  }

  async function approveCase(id) {
    setActionError('');
    try {
      await api.post(`/cases/${id}/approve`);
      setCases(cases.map(c => c.id === id ? { ...c, status: 'active' } : c));
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to approve case.');
    }
  }

  async function rejectCase(id) {
    setActionError('');
    try {
      await api.post(`/cases/${id}/reject`);
      setCases(cases.map(c => c.id === id ? { ...c, status: 'rejected' } : c));
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to reject case.');
    }
  }

  async function approveSighting(id) {
    setActionError('');
    try {
      await api.post(`/sightings/${id}/approve`);
      setSightings(sightings.map(s => s.id === id ? { ...s, status: 'verified' } : s));
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to approve sighting.');
    }
  }

  async function rejectSighting(id) {
    setActionError('');
    try {
      await api.post(`/sightings/${id}/reject`);
      setSightings(sightings.map(s => s.id === id ? { ...s, status: 'rejected' } : s));
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to reject sighting.');
    }
  }

  async function updateSighting(id, status) {
    setActionError('');
    try {
      await api.patch(`/sightings/${id}/status`, { status });
      setSightings(sightings.map(s => s.id === id ? { ...s, status } : s));
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update sighting status.');
    }
  }

  async function toggleHistory(caseId) {
    const isExpanding = !expandedAudit[caseId];
    setExpandedAudit(prev => ({ ...prev, [caseId]: isExpanding }));
    if (isExpanding && !auditHistory[caseId]) {
      try {
        const r = await api.get(`/cases/${caseId}`);
        setAuditHistory(prev => ({ ...prev, [caseId]: r.data.sightings || [] }));
      } catch {
        setAuditHistory(prev => ({ ...prev, [caseId]: [] }));
      }
    }
  }

  async function toggleSightingAudit(id) {
    const isExpanding = !expandedAudit[id];
    setExpandedAudit(prev => ({ ...prev, [id]: isExpanding }));
    if (isExpanding && !auditHistory[id]) {
      try {
        const r = await api.get(`/sightings/${id}/audit`);
        setAuditHistory(prev => ({ ...prev, [id]: r.data }));
      } catch {
        setAuditHistory(prev => ({ ...prev, [id]: [] }));
      }
    }
  }

  async function scanSighting(sightingId, imageUrl) {
    if (!imageUrl) return;
    setSightingScan(prev => ({ ...prev, [sightingId]: { loading: true, results: null, error: '' } }));
    try {
      // Fetch the sighting image and convert to a File for the scan API
      const imgRes = await fetch(imageUrl);
      const blob = await imgRes.blob();
      const file = new File([blob], 'sighting.jpg', { type: blob.type || 'image/jpeg' });
      const fd = new FormData();
      fd.append('image', file);
      const r = await api.post('/admin/scan-face', fd);
      setSightingScan(prev => ({ ...prev, [sightingId]: { loading: false, results: r.data?.matches || [], error: '' } }));
    } catch (err) {
      setSightingScan(prev => ({ ...prev, [sightingId]: { loading: false, results: [], error: err.response?.data?.message || 'Scan failed' } }));
    }
  }

  function getEdit(c) {
    return pendingEdits[c.id] ?? {
      review: '',
      found: c.status === 'found' ? 'found' : c.status === 'closed' ? 'closed' : 'not_found',
      closeReason: '',
    };
  }

  function setEdit(id, patch) {
    const current = cases.find(c => c.id === id);
    setPendingEdits(prev => ({
      ...prev,
      [id]: {
        review: '',
        found: current?.status === 'found' ? 'found' : 'not_found',
        closeReason: '',
        ...(prev[id] ?? {}),
        ...patch,
      },
    }));
  }

  async function saveCard(c) {
    setActionError('');

    const edit = getEdit(c);

    // Enforce close reason
    if (edit.found === 'closed' && !edit.closeReason?.trim()) {
      setActionError('Please provide a reason for closing this case.');
      return;
    }

    setSavingId(c.id);
    try {
      let newStatus = c.status;

      if (edit.review === 'approve') {
        await api.post(`/cases/${c.id}/approve`);
        newStatus = 'active';
        // Admin cannot set found — only close
        if (edit.found === 'closed') {
          await api.patch(`/cases/${c.id}/status`, { status: 'closed', notes: edit.closeReason });
          newStatus = 'closed';
        }
      } else if (edit.review === 'reject') {
        await api.post(`/cases/${c.id}/reject`);
        newStatus = 'rejected';
      } else {
        // Admin can only close, not mark as found
        const targetStatus = edit.found === 'closed' ? 'closed' : c.status;
        if (targetStatus !== c.status) {
          await api.patch(`/cases/${c.id}/status`, {
            status: targetStatus,
            ...(targetStatus === 'closed' ? { notes: edit.closeReason } : {}),
          });
          newStatus = targetStatus;
        }
      }

      setCases(prev => prev.map(x => x.id === c.id ? { ...x, status: newStatus } : x));
      setPendingEdits(prev => { const n = { ...prev }; delete n[c.id]; return n; });
      setEditingIds(prev => { const n = { ...prev }; delete n[c.id]; return n; });
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to save changes.');
    }
    setSavingId(null);
  }

  async function handleFaceScan(e) {
    e.preventDefault();
    if (!scanImage) { setScanError('Please upload a photo to scan.'); return; }
    setScanError(''); setScanLoading(true); setScanResults(null);
    try {
      const fd = new FormData();
      fd.append('image', scanImage);
      const r = await api.post('/admin/scan-face', fd);
      setScanResults(r.data?.matches || []);
    } catch (err) {
      setScanError(err.response?.data?.message || 'Failed to scan photo.');
      setScanResults([]);
    }
    setScanLoading(false);
  }

  // Req 4.3 / 4.4 / 4.5: submit found-person photo for a case
  async function submitFoundPhoto(caseId) {
    const file = foundUploadFile[caseId];
    if (!file) {
      setFoundUploadError(prev => ({ ...prev, [caseId]: 'Please select a photo before submitting' }));
      return;
    }
    setFoundUploadError(prev => ({ ...prev, [caseId]: '' }));
    setFoundUploading(prev => ({ ...prev, [caseId]: true }));
    try {
      const fd = new FormData();
      fd.append('image', file);
      await api.post(`/cases/${caseId}/found-photo`, fd);
      // Update local state: mark case as found, close upload form
      setCases(prev => prev.map(c => c.id === caseId ? { ...c, status: 'found' } : c));
      setFoundUploadOpen(prev => ({ ...prev, [caseId]: false }));
      setFoundUploadFile(prev => { const n = { ...prev }; delete n[caseId]; return n; });
    } catch (err) {
      setFoundUploadError(prev => ({
        ...prev,
        [caseId]: err.response?.data?.message || 'Failed to upload photo.',
      }));
    }
    setFoundUploading(prev => ({ ...prev, [caseId]: false }));
  }

  // Req 2.3: dismiss a notification banner
  async function dismissNotification(notifId) {
    try {
      await api.patch(`/notifications/${notifId}/read`);
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    } catch {
      // silently ignore
    }
  }

  function formatDate(ts) {
    if (!ts) return '--';
    return new Date(ts).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  const markers = cases.map(c => ({ lat: c.last_seen_lat, lng: c.last_seen_lng, title: c.name, description: c.status }));
  const totalCases = cases.length;
  const activeCases = cases.filter(c => ['active', 'verified'].includes(c.status)).length;
  const pendingCount = cases.filter(c => c.status === 'pending').length;
  const foundCases = cases.filter(c => c.status === 'found').length;
  const isAdminOrPolice = ['admin', 'police'].includes(user.role);

  // Admin: separate active/pending cases from found cases (found goes to history)
  const activeCasesList = user.role === 'admin'
    ? cases.filter(c => c.status !== 'found')
    : cases;
  const foundCasesList = user.role === 'admin'
    ? cases.filter(c => c.status === 'found')
    : [];

  return (
    <>
      <Navbar />
      <div className="db-wrapper">
        <aside className="db-sidebar">
          <div className="db-sidebar-header">
            <div className="db-avatar">{user.name?.[0]?.toUpperCase()}</div>
            <div>
              <div className="db-username">{user.name}</div>
              <div className="db-role">{user.role}</div>
            </div>
          </div>
          <nav className="db-nav">
            <button className={`db-nav-item ${activeTab === 'cases' ? 'active' : ''}`} onClick={() => setActiveTab('cases')}>
              {t('dash.cases')}
            </button>
            {user.role === 'admin' && (
              <button className={`db-nav-item ${activeTab === 'scan' ? 'active' : ''}`} onClick={() => setActiveTab('scan')}>
                {t('dash.scan')}
              </button>
            )}
            {isAdminOrPolice && (
              <button className={`db-nav-item ${activeTab === 'sightings' ? 'active' : ''}`} onClick={() => setActiveTab('sightings')}>
                {t('dash.sightings')}
              </button>
            )}
            <button className={`db-nav-item ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
              {t('dash.map')}
            </button>
          </nav>
          <div className="db-sidebar-stats">
            <div className="db-stat-row"><span>Total</span><b>{totalCases}</b></div>
            <div className="db-stat-row"><span>Active</span><b className="green">{activeCases}</b></div>
            <div className="db-stat-row"><span>Pending</span><b className="yellow">{pendingCount}</b></div>
            <div className="db-stat-row"><span>Found</span><b className="green">{foundCases}</b></div>
          </div>
          {stats && (
            <div className="db-admin-stats">
              <div className="db-stat-row"><span>Total Users</span><b>{stats.totalUsers}</b></div>
            </div>
          )}
          <Link className="btn full" to="/report" style={{ marginTop: 'auto' }}>+ {t('dash.report_btn')}</Link>
        </aside>

        <main className="db-main">
          {actionError && (
            <div className="rc-error" style={{ marginBottom: 16 }}>{actionError}</div>
          )}

          {/* Req 2.3: notification banner for unread found_person_photo notifications */}
          {notifications.filter(n => !n.read && n.type === 'found_person_photo').map(n => (
            <div
              key={n.id}
              className="panel"
              style={{
                marginBottom: 12,
                padding: '14px 18px',
                background: '#fef9c3',
                border: '1.5px solid #fbbf24',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: '#92400e' }}>
                📷 {n.message}
                {n.case_id && (
                  <Link
                    to={`/cases/${n.case_id}`}
                    style={{ marginLeft: 10, color: '#b45309', textDecoration: 'underline' }}
                  >
                    View Case →
                  </Link>
                )}
              </span>
              <button
                className="db-mini-btn"
                style={{ flexShrink: 0, background: '#fde68a', color: '#78350f', border: 'none' }}
                onClick={() => dismissNotification(n.id)}
              >
                Dismiss
              </button>
            </div>
          ))}

          {activeTab === 'cases' && (
            <>
              <h2>{t('dash.cases')}</h2>
              {activeCasesList.length === 0 && foundCasesList.length === 0 ? (
                <div className="db-empty">
                  <p>{t('dash.no_cases')}</p>
                  <Link className="btn" to="/report">{t('dash.report_btn')}</Link>
                </div>
              ) : (
                <>
                  {/* Active / Pending / Other cases */}
                  {activeCasesList.length > 0 && (
                    <div className="dc-card-grid">
                      {activeCasesList.map(c => (
                        <div key={c.id} className="dc-case-card-wrap">
                          <div className="dc-case-card">
                            <div className="dc-card-photo">
                              <img src={c.images?.[0] || 'https://placehold.co/80x80?text=?'} alt={c.name} />
                            </div>
                            <div className="dc-card-header">
                              <Link to={`/cases/${c.id}`} className="dc-card-name">{c.name}</Link>
                              <span className={`badge ${c.status}`}>{c.status}</span>
                              <div className="dc-card-meta">
                                {c.age && <span>Age: <b>{c.age}</b></span>}
                                {c.gender && <span>{c.gender}</span>}
                                {c.height && <span>{c.height}</span>}
                              </div>
                              {c.description && (
                                <p className="dc-card-desc">{c.description.slice(0, 80)}{c.description.length > 80 ? '...' : ''}</p>
                              )}
                            </div>
                            <div className="dc-card-info">
                              <div className="dc-card-row">
                                <span className="dc-card-label">Last Seen</span>
                                <span className="dc-card-value">{c.last_seen_location || '--'}</span>
                              </div>
                              {c.last_seen_time && (
                                <div className="dc-card-row">
                                  <span className="dc-card-label">When</span>
                                  <span className="dc-card-value">{formatDate(c.last_seen_time)}</span>
                                </div>
                              )}
                              <div className="dc-card-row">
                                <span className="dc-card-label">Reporter</span>
                                <span className="dc-card-value">
                                  {c.reporter_name || '--'}
                                  {c.reporter_phone && <span className="muted"> · {c.reporter_phone}</span>}
                                </span>
                              </div>
                              {c.ai_verification_score != null && (
                                <div className="dc-card-row">
                                  <span className="dc-card-label">AI Score</span>
                                  <span className="dc-card-value">
                                    <span className={`ai-score-badge ${c.ai_verification_score >= 80 ? 'ai-score-high' : c.ai_verification_score >= 50 ? 'ai-score-mid' : 'ai-score-low'}`}>
                                      {c.ai_verification_score}/100
                                    </span>
                                  </span>
                                </div>
                              )}
                            </div>
                            {isAdminOrPolice && (
                              <div className="dc-card-actions">
                                {editingIds[c.id] ? (
                                  <>
                                    {/* Approve / Reject — admin only */}
                                    {user.role === 'admin' && (
                                      <select
                                        value={getEdit(c).review}
                                        onChange={e => setEdit(c.id, { review: e.target.value })}
                                        className="db-status-select"
                                        aria-label="Approve or reject"
                                      >
                                        <option value="">Approve / Reject</option>
                                        <option value="approve">✓ Approve</option>
                                        <option value="reject">✗ Reject</option>
                                      </select>
                                    )}

                                    {/* Close option — admin can close but NOT mark as found */}
                                    {user.role === 'admin' && (
                                      <>
                                        <select
                                          value={getEdit(c).found}
                                          onChange={e => setEdit(c.id, { found: e.target.value })}
                                          className="db-status-select"
                                          aria-label="Close status"
                                        >
                                          <option value="not_found">Keep Active</option>
                                          <option value="closed">Close Case</option>
                                        </select>
                                        {getEdit(c).found === 'closed' && (
                                          <textarea
                                            value={getEdit(c).closeReason || ''}
                                            onChange={e => setEdit(c.id, { closeReason: e.target.value })}
                                            className="db-status-select"
                                            placeholder="Reason for closing (required)..."
                                            rows={3}
                                            style={{ resize: 'vertical', fontSize: 13 }}
                                            required
                                          />
                                        )}
                                      </>
                                    )}

                                    <div className="dc-card-actions-btns">
                                      <button
                                        className="btn small"
                                        style={{ background: '#16a34a', color: '#fff', borderRadius: 999, padding: '8px 18px' }}
                                        onClick={() => saveCard(c)}
                                        disabled={savingId === c.id}
                                      >
                                        {savingId === c.id ? '...' : 'Save'}
                                      </button>
                                      <button
                                        className="db-mini-btn"
                                        style={{ background: '#f3f4f6', color: '#374151' }}
                                        onClick={() => {
                                          setEditingIds(prev => { const n = { ...prev }; delete n[c.id]; return n; });
                                          setPendingEdits(prev => { const n = { ...prev }; delete n[c.id]; return n; });
                                        }}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        className="db-mini-btn"
                                        style={{ background: expandedAudit[c.id] ? '#e0f2fe' : '#f0f9ff', color: '#0369a1' }}
                                        onClick={() => toggleHistory(c.id)}
                                      >
                                        History
                                      </button>
                                      {user.role === 'admin' && (
                                        <button className="btn small danger" style={{ borderRadius: 999, padding: '8px 18px' }} onClick={() => deleteCase(c.id)}>Delete</button>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <div className="dc-card-actions-btns">
                                    <button
                                      className="db-mini-btn"
                                      style={{ background: '#eff6ff', color: '#1d4ed8' }}
                                      onClick={() => setEditingIds(prev => ({ ...prev, [c.id]: true }))}
                                    >
                                      ✎ Edit
                                    </button>
                                    <button
                                      className="db-mini-btn"
                                      style={{ background: expandedAudit[c.id] ? '#e0f2fe' : '#f0f9ff', color: '#0369a1' }}
                                      onClick={() => toggleHistory(c.id)}
                                    >
                                      History
                                    </button>
                                    {/* Admin: NO Mark as Found button — police only */}
                                    {user.role === 'admin' && (
                                      <button className="btn small danger" style={{ borderRadius: 999, padding: '8px 18px' }} onClick={() => deleteCase(c.id)}>Delete</button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {expandedAudit[c.id] && (
                            <div className="dc-history-panel">
                              <div className="dc-history-title">Sighting History</div>
                              {!auditHistory[c.id] ? (
                                <p className="muted">Loading...</p>
                              ) : auditHistory[c.id].length === 0 ? (
                                <p className="muted">No sightings reported yet.</p>
                              ) : (
                                <div className="dc-history-list">
                                  {auditHistory[c.id].map((s, i) => (
                                    <div key={s.id || i} className="dc-history-item">
                                      {s.image_url && <img src={s.image_url} alt="sighting" className="dc-history-img" />}
                                      <div className="dc-history-body">
                                        <div className="dc-history-row">
                                          <span className={`badge ${s.status}`}>{s.status}</span>
                                          <span className="muted" style={{ fontSize: 12 }}>{formatDate(s.created_at)}</span>
                                        </div>
                                        <div className="dc-history-location">Location: {s.location_text || 'Not specified'}</div>
                                        <div className="dc-history-desc">{s.description}</div>
                                        {s.status === 'pending' && (
                                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                            <button className="db-mini-btn verify" onClick={() => approveSighting(s.id)}>Approve</button>
                                            <button className="db-mini-btn reject" onClick={() => rejectSighting(s.id)}>Reject</button>
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
                      ))}
                    </div>
                  )}

                  {/* Found Cases History — admin only, shown below active cases */}
                  {user.role === 'admin' && foundCasesList.length > 0 && (
                    <div style={{ marginTop: 36 }}>
                      <h3 style={{ marginBottom: 16, color: '#15803d', display: 'flex', alignItems: 'center', gap: 8 }}>
                        ✅ Found Cases History
                        <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280', background: '#dcfce7', borderRadius: 999, padding: '2px 10px' }}>
                          {foundCasesList.length} case{foundCasesList.length !== 1 ? 's' : ''}
                        </span>
                      </h3>
                      <div className="dc-card-grid">
                        {foundCasesList.map(c => (
                          <div key={c.id} className="dc-case-card-wrap">
                            <div className="dc-case-card" style={{ borderLeft: '4px solid #16a34a', opacity: 0.92 }}>
                              <div className="dc-card-photo">
                                <img src={c.images?.[0] || 'https://placehold.co/80x80?text=?'} alt={c.name} />
                              </div>
                              <div className="dc-card-header">
                                <Link to={`/cases/${c.id}`} className="dc-card-name">{c.name}</Link>
                                <span className="badge found">found</span>
                                <div className="dc-card-meta">
                                  {c.age && <span>Age: <b>{c.age}</b></span>}
                                  {c.gender && <span>{c.gender}</span>}
                                  {c.height && <span>{c.height}</span>}
                                </div>
                                {c.description && (
                                  <p className="dc-card-desc">{c.description.slice(0, 80)}{c.description.length > 80 ? '...' : ''}</p>
                                )}
                              </div>
                              <div className="dc-card-info">
                                <div className="dc-card-row">
                                  <span className="dc-card-label">Last Seen</span>
                                  <span className="dc-card-value">{c.last_seen_location || '--'}</span>
                                </div>
                                {c.last_seen_time && (
                                  <div className="dc-card-row">
                                    <span className="dc-card-label">Last Seen Time</span>
                                    <span className="dc-card-value">{formatDate(c.last_seen_time)}</span>
                                  </div>
                                )}
                                <div className="dc-card-row">
                                  <span className="dc-card-label">Reporter</span>
                                  <span className="dc-card-value">
                                    {c.reporter_name || '--'}
                                    {c.reporter_phone && <span className="muted"> · {c.reporter_phone}</span>}
                                  </span>
                                </div>
                                {c.reporter_relation && (
                                  <div className="dc-card-row">
                                    <span className="dc-card-label">Relation</span>
                                    <span className="dc-card-value">{c.reporter_relation}</span>
                                  </div>
                                )}
                                <div className="dc-card-row">
                                  <span className="dc-card-label">Case Closed</span>
                                  <span className="dc-card-value">{formatDate(c.updated_at)}</span>
                                </div>
                              </div>
                              <div className="dc-card-actions">
                                <div className="dc-card-actions-btns">
                                  <button
                                    className="db-mini-btn"
                                    style={{ background: expandedAudit[c.id] ? '#e0f2fe' : '#f0f9ff', color: '#0369a1' }}
                                    onClick={() => toggleHistory(c.id)}
                                  >
                                    History
                                  </button>
                                  <Link
                                    to={`/cases/${c.id}`}
                                    className="db-mini-btn"
                                    style={{ background: '#f0fdf4', color: '#16a34a', textDecoration: 'none', display: 'inline-block' }}
                                  >
                                    🔍 View Details
                                  </Link>
                                  <button className="btn small danger" style={{ borderRadius: 999, padding: '8px 18px' }} onClick={() => deleteCase(c.id)}>Delete</button>
                                </div>
                              </div>
                            </div>
                            {expandedAudit[c.id] && (
                              <div className="dc-history-panel">
                                <div className="dc-history-title">Sighting History</div>
                                {!auditHistory[c.id] ? (
                                  <p className="muted">Loading...</p>
                                ) : auditHistory[c.id].length === 0 ? (
                                  <p className="muted">No sightings reported yet.</p>
                                ) : (
                                  <div className="dc-history-list">
                                    {auditHistory[c.id].map((s, i) => (
                                      <div key={s.id || i} className="dc-history-item">
                                        {s.image_url && <img src={s.image_url} alt="sighting" className="dc-history-img" />}
                                        <div className="dc-history-body">
                                          <div className="dc-history-row">
                                            <span className={`badge ${s.status}`}>{s.status}</span>
                                            <span className="muted" style={{ fontSize: 12 }}>{formatDate(s.created_at)}</span>
                                          </div>
                                          <div className="dc-history-location">Location: {s.location_text || 'Not specified'}</div>
                                          <div className="dc-history-desc">{s.description}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'sightings' && isAdminOrPolice && (
            <>
              <h2>{t('dash.sightings')}</h2>
              {sightings.length === 0 ? (
                <div className="db-empty">
                  <p>{t('dash.no_sightings')}</p>
                </div>
              ) : (
                <div className="dc-card-grid">
                  {sightings.map(s => (
                    <div key={s.id} className="dc-case-card-wrap">
                      <div className="dc-case-card">
                        {s.image_url && (
                          <div className="dc-card-photo">
                            <img src={s.image_url} alt="sighting" />
                          </div>
                        )}
                        <div className="dc-card-header">
                          <span className="dc-card-name" style={{ cursor: 'default' }}>{s.person_name || '--'}</span>
                          <span className={`badge ${s.status}`}>{s.status}</span>
                          <p className="dc-card-desc">{s.description?.slice(0, 100)}{s.description?.length > 100 ? '...' : ''}</p>
                        </div>
                        <div className="dc-card-info">
                          <div className="dc-card-row">
                            <span className="dc-card-label">Location</span>
                            <span className="dc-card-value">{s.location_text || '--'}</span>
                          </div>
                          <div className="dc-card-row">
                            <span className="dc-card-label">Witness</span>
                            <span className="dc-card-value">
                              {s.reporter_name || 'Anonymous'}
                              {s.reporter_phone && <span className="muted"> · {s.reporter_phone}</span>}
                            </span>
                          </div>
                          <div className="dc-card-row">
                            <span className="dc-card-label">Submitted</span>
                            <span className="dc-card-value">{formatDate(s.created_at)}</span>
                          </div>
                        </div>
                        <div className="dc-card-actions">
                          {s.status === 'pending' ? (
                            <>
                              <button className="db-mini-btn verify" onClick={() => approveSighting(s.id)}>Approve</button>
                              <button className="db-mini-btn reject" onClick={() => rejectSighting(s.id)}>Reject</button>
                            </>
                          ) : (
                            <select value={s.status} onChange={e => updateSighting(s.id, e.target.value)} className="db-status-select">
                              {['pending', 'verified', 'rejected'].map(st => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>
                          )}
                          <button
                            className="db-mini-btn"
                            style={{ background: '#f0f4ff', color: '#3b5bdb' }}
                            onClick={() => toggleSightingAudit(s.id)}
                          >
                            Audit
                          </button>
                          {/* Scan button — runs face detection on sighting photo */}
                          {s.image_url && (
                            <button
                              className="db-mini-btn"
                              style={{ background: '#f0fdf4', color: '#15803d' }}
                              disabled={sightingScan[s.id]?.loading}
                              onClick={() => scanSighting(s.id, s.image_url)}
                            >
                              {sightingScan[s.id]?.loading ? 'Scanning...' : 'Scan'}
                            </button>
                          )}
                        </div>
                      </div>
                      {expandedAudit[s.id] && (
                        <div className="dc-history-panel">
                          <div className="dc-history-title">Audit History</div>
                          {!auditHistory[s.id] ? (
                            <p className="muted">Loading...</p>
                          ) : auditHistory[s.id].length === 0 ? (
                            <p className="muted">No audit records yet.</p>
                          ) : (
                            <ul className="db-audit-list">
                              {auditHistory[s.id].map((entry, i) => (
                                <li key={i} className="db-audit-entry">
                                  <div className="db-audit-meta">
                                    <span className="db-audit-actor">{entry.actor_name}</span>
                                    <span className="db-audit-action">{entry.action}</span>
                                    <span className="db-audit-time muted">{formatDate(entry.created_at)}</span>
                                  </div>
                                  {entry.notes && <div className="db-audit-notes muted">{entry.notes}</div>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* ── Inline face scan results ── */}
                      {sightingScan[s.id] && !sightingScan[s.id].loading && (
                        <div className="sighting-scan-panel">
                          <div className="sighting-scan-header">
                            <span>AI Face Match Results</span>
                            <button
                              onClick={() => setSightingScan(prev => { const n = {...prev}; delete n[s.id]; return n; })}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, padding: '0 4px' }}
                            >×</button>
                          </div>

                          {sightingScan[s.id].error && (
                            <p style={{ color: 'var(--red)', fontSize: 13, margin: '8px 0 0' }}>{sightingScan[s.id].error}</p>
                          )}

                          {sightingScan[s.id].results?.length === 0 && !sightingScan[s.id].error && (
                            <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>No matching faces found in the database.</p>
                          )}

                          {sightingScan[s.id].results?.length > 0 && (
                            <div className="sighting-scan-results">
                              {sightingScan[s.id].results.map((r, i) => {
                                const color = r.score >= 90 ? '#15803d' : r.score >= 40 ? '#d97706' : '#dc2626';
                                const label = r.score >= 90 ? 'High Match' : r.score >= 40 ? 'Possible' : 'Low';
                                return (
                                  <div key={r.case_id} className="sighting-scan-match">
                                    <img src={r.image_url} alt={r.name} className="sighting-scan-img" />
                                    <div className="sighting-scan-info">
                                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>{r.name}</div>
                                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                        {r.age && `Age ${r.age}`}{r.gender && ` · ${r.gender}`}
                                      </div>
                                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{r.last_seen_location}</div>
                                      {/* Score bar */}
                                      <div style={{ marginTop: 6 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                                          <span style={{ fontWeight: 700, color }}>{label}</span>
                                          <span style={{ fontWeight: 800, color }}>{r.score}%</span>
                                        </div>
                                        <div style={{ height: 5, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
                                          <div style={{ height: '100%', width: `${r.score}%`, background: color, borderRadius: 999 }} />
                                        </div>
                                      </div>
                                      <Link
                                        to={`/cases/${r.case_id}`}
                                        style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 700, color: 'var(--green)', textDecoration: 'none' }}
                                      >
                                        View Case →
                                      </Link>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'scan' && user.role === 'admin' && (
            <>
              <div className="db-header">
                <div>
                  <h1 className="db-title">{t('dash.scan')}</h1>
                  <p className="db-subtitle">{t('dash.scan_sub')}</p>
                </div>
              </div>

              <div className="scan-layout">
                {/* Upload panel */}
                <div className="scan-upload-panel">
                  <form onSubmit={handleFaceScan}>
                    <div className="scan-dropzone" onClick={() => scanFileRef.current?.click()}>
                      {scanPreview ? (
                        <div className="scan-preview-wrap">
                          <img src={scanPreview} alt="Scan preview" className="scan-preview-img" />
                          <div className="scan-preview-name">{scanImage?.name}</div>
                        </div>
                      ) : (
                        <div className="scan-drop-inner">
                          <div className="scan-drop-icon">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 9V5a2 2 0 012-2h4"/><path d="M15 3h4a2 2 0 012 2v4"/>
                              <path d="M21 15v4a2 2 0 01-2 2h-4"/><path d="M9 21H5a2 2 0 01-2-2v-4"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          </div>
                          <p className="scan-drop-text">Click to upload a face photo</p>
                          <p className="scan-drop-hint">JPG, PNG, WEBP — clear frontal face works best</p>
                        </div>
                      )}
                    </div>
                    <input ref={scanFileRef} type="file" accept="image/*"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setScanImage(f);
                        setScanPreview(URL.createObjectURL(f));
                        setScanResults(null); setScanError('');
                      }}
                      style={{ display: 'none' }}
                    />
                    {scanError && <div className="rc-error" style={{ marginTop: 12 }}>{scanError}</div>}
                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                      <button type="submit" className="rc-btn-submit" disabled={scanLoading || !scanImage} style={{ flex: 1 }}>
                        {scanLoading ? <><span className="auth-spinner" /> Scanning database...</> : 'Scan & Match'}
                      </button>
                      {(scanImage || scanResults) && (
                        <button type="button" onClick={() => { setScanImage(null); setScanPreview(null); setScanResults(null); setScanError(''); if (scanFileRef.current) scanFileRef.current.value = ''; }}
                          style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 12, padding: '0 18px', fontWeight: 600, cursor: 'pointer' }}>
                          Clear
                        </button>
                      )}
                    </div>
                  </form>
                  <div className="scan-info-box">
                    <p><strong>How it works:</strong></p>
                    <ul>
                      <li>Upload a clear photo of a person's face</li>
                      <li>AI compares it against all missing persons in the database</li>
                      <li>Results are ranked by similarity score</li>
                      <li>90%+ score = high confidence match</li>
                    </ul>
                  </div>
                </div>

                {/* Results panel */}
                <div className="scan-results-panel">
                  {scanResults === null && !scanLoading && (
                    <div className="scan-results-empty">
                      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9V5a2 2 0 012-2h4"/><path d="M15 3h4a2 2 0 012 2v4"/>
                        <path d="M21 15v4a2 2 0 01-2 2h-4"/><path d="M9 21H5a2 2 0 01-2-2v-4"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                      <p>Upload a photo and click Scan to find matches</p>
                    </div>
                  )}
                  {scanLoading && (
                    <div className="scan-results-empty">
                      <div className="scan-loading-ring" />
                      <p>Analyzing face and searching database...</p>
                    </div>
                  )}
                  {scanResults !== null && !scanLoading && (
                    <>
                      <div className="scan-results-header">
                        <h3>{scanResults.length === 0 ? 'No matches found' : `${scanResults.length} match${scanResults.length !== 1 ? 'es' : ''} found`}</h3>
                        <span className="muted" style={{ fontSize: 13 }}>Sorted by confidence</span>
                      </div>
                      {scanResults.length === 0 ? (
                        <div className="scan-results-empty" style={{ marginTop: 24 }}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                          <p>No matching faces found.<br /><span className="muted" style={{ fontSize: 13 }}>Try a clearer, frontal face photo.</span></p>
                        </div>
                      ) : (
                        <div className="scan-results-grid">
                          {scanResults.map((r, i) => (
                            <div key={r.case_id} className={`scan-result-card ${r.score >= 90 ? 'scan-result-high' : r.score >= 40 ? 'scan-result-mid' : 'scan-result-low'}`}>
                              <div className="scan-result-rank">#{i + 1}</div>
                              <img src={r.image_url} alt={r.name} className="scan-result-img" />
                              <div className="scan-result-body">
                                <div className="scan-result-name">{r.name}</div>
                                <div className="scan-result-meta">
                                  {r.age && <span>Age {r.age}</span>}
                                  {r.gender && <span>{r.gender}</span>}
                                  <span className={`badge ${r.status}`}>{r.status}</span>
                                </div>
                                <div className="scan-result-location">
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                  {r.last_seen_location}
                                </div>
                                <ScoreBar score={r.score} />
                                <Link to={`/cases/${r.case_id}`} className="scan-result-btn">View Case →</Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'map' && (
            <>
              <h2>{t('dash.cases_map')}</h2>
              <MapView markers={markers} height={520} />
            </>
          )}
        </main>
      </div>
    </>
  );
}
