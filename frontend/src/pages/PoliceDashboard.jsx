import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PoliceCaseCard from '../components/PoliceCaseCard';
import CaseSightingHistoryCard from '../components/CaseSightingHistoryCard';
import MovementMapDropdown from '../components/MovementMapDropdown';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const IconClipboard = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);

const IconAlert = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

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

// ── Icon helpers ──────────────────────────────────────────────
const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconBell = ({ unread }) => (
  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
    {unread > 0 && (
      <span style={{ position: 'absolute', top: -5, right: -7, background: '#dc2626', color: '#fff', borderRadius: 999, fontSize: 9, fontWeight: 800, padding: '1px 4px', lineHeight: 1.4 }}>{unread}</span>
    )}
  </span>
);
const IconSighting = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconScan = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9V5a2 2 0 012-2h4"/><path d="M15 3h4a2 2 0 012 2v4"/>
    <path d="M21 15v4a2 2 0 01-2 2h-4"/><path d="M9 21H5a2 2 0 01-2-2v-4"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

export default function PoliceDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('cases');
  const [cases, setCases] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionError, setActionError] = useState('');

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // Police update notes state
  const [updatesCaseId, setUpdatesCaseId] = useState('');
  const [updates, setUpdates] = useState([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updatesError, setUpdatesError] = useState('');
  const [newUpdateText, setNewUpdateText] = useState('');
  const [submittingUpdate, setSubmittingUpdate] = useState(false);

  // Face scan state
  const [scanImage, setScanImage] = useState(null);
  const [scanPreview, setScanPreview] = useState(null);
  const [scanResults, setScanResults] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const fileRef = useRef(null);

  // Load cases
  useEffect(() => {
    const params = statusFilter ? `?status=${statusFilter}` : '';
    api.get(`/cases${params}`)
      .then(r => setCases(r.data))
      .catch(err => console.error('Failed to load cases:', err));
  }, [statusFilter]);

  // Load notifications when tab opens
  const loadNotifications = useCallback(() => {
    setNotifLoading(true);
    api.get('/notifications')
      .then(r => setNotifications(r.data))
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'notifications') loadNotifications();
  }, [activeTab, loadNotifications]);

  useEffect(() => {
    loadNotifications();
    const id = setInterval(loadNotifications, 5000);
    return () => clearInterval(id);
  }, [loadNotifications]);

  async function handleStatusUpdate(id, status) {
    setActionError('');
    try {
      await api.patch(`/cases/${id}/status`, { status });
      setCases(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update status');
    }
  }

  async function markNotifRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  }

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  }

  async function loadUpdates(caseId) {
    if (!caseId) return;
    setUpdatesLoading(true);
    setUpdatesError('');
    try {
      const r = await api.get(`/admin/cases/${caseId}/updates`);
      setUpdates(r.data || []);
    } catch {
      setUpdatesError('Updates load করা যায়নি।');
    }
    setUpdatesLoading(false);
  }

  async function submitUpdate(e) {
    e.preventDefault();
    if (!newUpdateText.trim() || !updatesCaseId) return;
    setSubmittingUpdate(true);
    setUpdatesError('');
    try {
      const r = await api.post(`/admin/cases/${updatesCaseId}/updates`, { update_text: newUpdateText });
      setUpdates(prev => [r.data, ...prev]);
      setNewUpdateText('');
    } catch (err) {
      setUpdatesError(err.response?.data?.message || 'Update submit করা যায়নি।');
    }
    setSubmittingUpdate(false);
  }

  function handlePhotoSelect(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setScanImage(f);
    setScanPreview(URL.createObjectURL(f));
    setScanResults(null);
    setScanError('');
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
      setScanError(err.response?.data?.message || 'Face scan failed. Make sure InsightFace server is running.');
      setScanResults([]);
    }
    setScanLoading(false);
  }

  function clearScan() {
    setScanImage(null);
    setScanPreview(null);
    setScanResults(null);
    setScanError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const activeCases = cases.filter(c => ['active', 'verified'].includes(c.status)).length;
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      <Navbar />
      <div className="db-wrapper">
        {/* ── Sidebar ── */}
        <aside className="db-sidebar">
          <div className="db-sidebar-header">
            <div className="db-avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <div>
              <div className="db-username">{user?.name}</div>
              <div className="db-role-badge">{user?.role}</div>
            </div>
          </div>
          <nav className="db-nav">
            <button className={`db-nav-item ${activeTab === 'cases' ? 'active' : ''}`} onClick={() => setActiveTab('cases')}>
              <IconClipboard /> Cases
            </button>
            <button className={`db-nav-item ${activeTab === 'sightings' ? 'active' : ''}`} onClick={() => setActiveTab('sightings')}>
              <IconSighting /> Sightings
            </button>
            <button className={`db-nav-item ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
              <IconSearch /> Movement Map
            </button>
            <button className={`db-nav-item ${activeTab === 'updates' ? 'active' : ''}`} onClick={() => setActiveTab('updates')}>
              <IconClipboard /> Case Updates
            </button>
            <button className={`db-nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
              <IconBell unread={unreadCount} /> Notifications
            </button>
            <button className={`db-nav-item ${activeTab === 'scan' ? 'active' : ''}`} onClick={() => setActiveTab('scan')}>
              <IconScan /> Face Scan
            </button>
          </nav>
          <div className="db-sidebar-stats">
            <div className="db-stat-row">
              <span>Active Cases</span>
              <b className="green">{activeCases}</b>
            </div>
            <div className="db-stat-row">
              <span>Total</span>
              <b>{cases.length}</b>
            </div>
            {unreadCount > 0 && (
              <div className="db-stat-row">
                <span>Unread Alerts</span>
                <b style={{ color: '#fcd34d' }}>{unreadCount}</b>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="db-main">
          {actionError && (
            <div role="alert" style={{ background: 'var(--red-light)', border: '1px solid var(--red)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: 'var(--red-dark)', fontWeight: 600, fontSize: 14 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconAlert /> {actionError}</span>
              <button onClick={() => setActionError('')} style={{ background: 'transparent', border: 'none', color: 'var(--red-dark)', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}>&times;</button>
            </div>
          )}

          {/* ── CASES TAB ── */}
          {activeTab === 'cases' && (
            <>
              <div className="db-header">
                <div>
                  <h1 className="db-title">Cases</h1>
                  <p className="db-subtitle">Missing persons under investigation</p>
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ padding: '9px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, fontWeight: 600, background: 'white', cursor: 'pointer', minWidth: 150 }}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                  <option value="found">Found</option>
                  <option value="closed">Closed</option>
                  <option value="rejected">Rejected</option>
                </select>              </div>
              {cases.length === 0 ? (
                <div className="db-empty"><p>No cases found</p></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                  {cases.map(item => (
                    <PoliceCaseCard key={item.id} item={item} onStatusUpdate={handleStatusUpdate} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── SIGHTINGS TAB ── */}
          {activeTab === 'sightings' && (
            <>
              <div className="db-header">
                <div>
                  <h1 className="db-title">Sightings</h1>
                  <p className="db-subtitle">Each case keeps its own sighting history by case ID</p>
                </div>
              </div>

              <div className="dc-card-grid">
                {cases.map(c => (
                  <CaseSightingHistoryCard key={c.id} item={c} />
                ))}
              </div>
            </>
          )}

          {/* ── MOVEMENT MAP TAB ── */}
          {activeTab === 'map' && (
            <>
              <div className="db-header">
                <div>
                  <h1 className="db-title">Movement Map</h1>
                  <p className="db-subtitle">Select a missing person and review their verified sighting trail</p>
                </div>
              </div>
              <MovementMapDropdown cases={cases} />
            </>
          )}

          {/* ── UPDATES TAB ── */}
          {activeTab === 'updates' && (
            <>
              <div className="db-header">
                <div>
                  <h1 className="db-title">Case Updates</h1>
                  <p className="db-subtitle">Add and view investigation notes for a case</p>
                </div>
              </div>

              {/* Case selector */}
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14 }}>Select a case:</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={updatesCaseId}
                    onChange={e => { setUpdatesCaseId(e.target.value); setUpdates([]); }}
                    style={{ flex: 1, minWidth: 220, padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, background: 'white' }}
                  >
                    <option value="">-- Choose a case --</option>
                    {cases.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.status}) — {c.id}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => loadUpdates(updatesCaseId)}
                    disabled={!updatesCaseId || updatesLoading}
                    style={{ padding: '10px 22px', borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: updatesCaseId ? 'pointer' : 'not-allowed', opacity: updatesCaseId ? 1 : 0.5 }}
                  >
                    {updatesLoading ? 'Loading...' : 'Load Updates'}
                  </button>
                </div>
              </div>

              {updatesError && (
                <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 14 }}>{updatesError}</div>
              )}

              {/* Add new update form */}
              {updatesCaseId && (
                <form onSubmit={submitUpdate} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
                  <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14 }}>Add Investigation Note:</p>
                  <textarea
                    value={newUpdateText}
                    onChange={e => setNewUpdateText(e.target.value)}
                    placeholder="Write your investigation update here..."
                    required
                    rows={3}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }}
                  />
                  <button
                    type="submit"
                    disabled={submittingUpdate || !newUpdateText.trim()}
                    style={{ padding: '9px 22px', borderRadius: 10, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: submittingUpdate ? 0.6 : 1 }}
                  >
                    {submittingUpdate ? 'Submitting...' : '+ Add Note'}
                  </button>
                </form>
              )}

              {/* Updates list */}
              {updates.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {updates.map(u => (
                    <div key={u.id} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                          {u.officer_name || 'Unknown Officer'}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {new Date(u.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{u.update_text}</p>
                    </div>
                  ))}
                </div>
              )}

              {updatesCaseId && !updatesLoading && updates.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
                  No updates yet for this case.
                </div>
              )}
            </>
          )}

          {/* ── NOTIFICATIONS TAB ── */}
          {activeTab === 'notifications' && (
            <>
              <div className="db-header">
                <div>
                  <h1 className="db-title">Notifications</h1>
                  <p className="db-subtitle">Alerts and updates for your cases</p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{ padding: '9px 18px', borderRadius: 10, background: 'white', color: 'var(--green)', border: '1.5px solid var(--green)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {notifLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>Loading notifications...</div>
              ) : notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
                  <p style={{ marginTop: 12 }}>No notifications yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => !n.read && markNotifRead(n.id)}
                      style={{
                        background: n.read ? 'white' : '#f0fdf4',
                        border: `1px solid ${n.read ? 'var(--border)' : '#86efac'}`,
                        borderRadius: 12,
                        padding: '14px 18px',
                        cursor: n.read ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 14,
                        transition: 'background .15s',
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? 'transparent' : '#16a34a', marginTop: 6, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: n.read ? 400 : 700 }}>{n.message}</p>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(n.created_at).toLocaleString()}</span>
                          {n.case_id && (
                            <Link to={`/cases/${n.case_id}`} style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              View Case
                            </Link>
                          )}
                          <span style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>{n.type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── FACE SCAN TAB ── */}
          {activeTab === 'scan' && (
            <>
              <div className="db-header">
                <div>
                  <h1 className="db-title">Face Scan</h1>
                  <p className="db-subtitle">Upload a photo to match against missing persons database using AI face recognition</p>
                </div>
              </div>

              <div className="scan-layout">
                {/* Upload panel */}
                <div className="scan-upload-panel">
                  <form onSubmit={handleFaceScan}>
                    <div className="scan-dropzone" onClick={() => fileRef.current?.click()}>
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
                    <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />

                    {scanError && <div className="rc-error" style={{ marginTop: 12 }}>{scanError}</div>}

                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                      <button type="submit" className="rc-btn-submit" disabled={scanLoading || !scanImage} style={{ flex: 1 }}>
                        {scanLoading ? (
                          <><span className="auth-spinner" /> Scanning database...</>
                        ) : (
                          'Scan & Match'
                        )}
                      </button>
                      {(scanImage || scanResults) && (
                        <button type="button" onClick={clearScan} style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 12, padding: '0 18px', fontWeight: 600, cursor: 'pointer' }}>
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
                        <h3>
                          {scanResults.length === 0 ? 'No matches found' : `${scanResults.length} match${scanResults.length !== 1 ? 'es' : ''} found`}
                        </h3>
                        <span className="muted" style={{ fontSize: 13 }}>Sorted by confidence</span>
                      </div>

                      {scanResults.length === 0 ? (
                        <div className="scan-results-empty" style={{ marginTop: 24 }}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                          <p>No matching faces found in the database.<br /><span className="muted" style={{ fontSize: 13 }}>Try a clearer, frontal face photo.</span></p>
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
                                <Link to={`/cases/${r.case_id}`} className="scan-result-btn">
                                  View Case →
                                </Link>
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
        </main>
      </div>
    </>
  );
}
