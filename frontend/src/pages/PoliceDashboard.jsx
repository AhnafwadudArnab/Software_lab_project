import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PoliceCaseCard from '../components/PoliceCaseCard';
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

export default function PoliceDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('cases');
  const [cases, setCases] = useState([]);
  const [actionError, setActionError] = useState('');

  // Face scan state
  const [scanImage, setScanImage] = useState(null);
  const [scanPreview, setScanPreview] = useState(null);
  const [scanResults, setScanResults] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    api.get('/cases')
      .then(r => setCases(r.data))
      .catch(err => console.error('Failed to load cases:', err));
  }, []);

  async function handleStatusUpdate(id, status) {
    setActionError('');
    try {
      await api.patch(`/cases/${id}/status`, { status });
      setCases(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update status');
    }
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

  return (
    <>
      <Navbar />
      <div className="db-wrapper">
        {/* Sidebar */}
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
            <button className={`db-nav-item ${activeTab === 'scan' ? 'active' : ''}`} onClick={() => setActiveTab('scan')}>
              Face Scan
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
          </div>
        </aside>

        {/* Main content */}
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
                  <h1 className="db-title">Active Cases</h1>
                  <p className="db-subtitle">Missing persons under active investigation</p>
                </div>
              </div>
              {cases.length === 0 ? (
                <div className="db-empty">
                  <p>No active cases assigned</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                  {cases.map(item => (
                    <PoliceCaseCard key={item.id} item={item} onStatusUpdate={handleStatusUpdate} />
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
