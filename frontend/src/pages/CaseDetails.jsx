import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Navbar from '../components/Navbar';
import MapView from '../components/MapView';
import { api } from '../api/client';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';

const TIMELINE_ENTRY_FORM_INITIAL = { entry_time: '', location_text: '', lat: '', lng: '', notes: '' };

export default function CaseDetails() {
  const { id } = useParams();
  const { t } = useLang();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [matches, setMatches] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [locationTrail, setLocationTrail] = useState([]);
  const [movementAnalysis, setMovementAnalysis] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  // Task 18.1: timeline entries state
  const [timelineEntries, setTimelineEntries] = useState([]);
  // Task 18.2: add timeline entry form state
  const [timelineForm, setTimelineForm] = useState(TIMELINE_ENTRY_FORM_INITIAL);
  const [timelineFormError, setTimelineFormError] = useState('');
  const [timelineFormSubmitting, setTimelineFormSubmitting] = useState(false);
  // Found-person photos (Req 3)
  const [foundPhotos, setFoundPhotos] = useState([]);

  // Fix #10: handle load errors instead of staying on "Loading..." forever
  useEffect(() => {
    api.get(`/cases/${id}`)
      .then(r => setItem(r.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load case. You may not have permission to view it.'));
  }, [id]);

  // Auto-locate user's device position on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { /* permission denied or unavailable — silently ignore */ },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Task 18.1: Fetch case timeline entries on mount
  useEffect(() => {
    api.get(`/cases/${id}/timeline`)
      .then(r => setTimelineEntries(r.data || []))
      .catch(() => {
        // Silently ignore errors (e.g. unauthenticated)
      });
  }, [id]);

  // Movement pattern from last-seen point + verified/face-matched sightings
  useEffect(() => {
    api.get(`/sightings/movement/${id}`)
      .then(r => setMovementAnalysis(r.data))
      .catch(() => setMovementAnalysis(null));
  }, [id]);

  // Req 3.4: Fetch found-person photos when case is loaded and status is "found"
  useEffect(() => {
    if (!item || item.status !== 'found') return;
    api.get(`/cases/${id}/found-photos`)
      .then(r => setFoundPhotos(r.data || []))
      .catch(() => setFoundPhotos([]));
  }, [id, item]);

  // Task 17.1 + 17.2: Fetch 24-hour location trail for admin/police users and poll every 30s
  useEffect(() => {
    if (user?.role !== 'admin' && user?.role !== 'police') return;

    async function fetchTrail() {
      try {
        const r = await api.get(`/cases/${id}/trail`);
        const trail = (r.data || []).map(point => [Number(point.lat), Number(point.lng)]);
        setLocationTrail(trail);
      } catch {
        // Silently ignore trail fetch errors
      }
    }

    fetchTrail();
    const intervalId = setInterval(fetchTrail, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [id, user]);

  async function runAIMatch() {
    setLoadingMatch(true);
    try {
      const r = await api.get(`/sightings/match/${id}`);
      setMatches(r.data.matches);
    } catch {
      setMatches([]);
    }
    setLoadingMatch(false);
  }

  // (live tracking removed — device auto-locates on mount)

  // Task 18.2: Submit a new timeline entry
  async function handleTimelineSubmit(e) {
    e.preventDefault();
    setTimelineFormError('');
    setTimelineFormSubmitting(true);
    try {
      const payload = {
        entry_time: timelineForm.entry_time,
        location_text: timelineForm.location_text,
        notes: timelineForm.notes || undefined,
        lat: timelineForm.lat !== '' ? Number(timelineForm.lat) : undefined,
        lng: timelineForm.lng !== '' ? Number(timelineForm.lng) : undefined,
      };
      const r = await api.post(`/cases/${id}/timeline`, payload);
      setTimelineEntries(prev => [...prev, r.data]);
      setTimelineForm(TIMELINE_ENTRY_FORM_INITIAL);
    } catch (err) {
      setTimelineFormError(err.response?.data?.message || 'Failed to add timeline entry.');
    }
    setTimelineFormSubmitting(false);
  }

  if (error) return (
    <>
      <Navbar />
      <main className="container">
        <div className="db-empty" style={{ paddingTop: 60 }}>
          <div className="db-empty-icon"></div>
          <p>{error}</p>
          <Link className="btn" to="/cases">{t('case.back')}</Link>
        </div>
      </main>
    </>
  );

  if (!item) return <><Navbar /><main className="container">{t('case.loading')}</main></>;

  const image = item.images?.[0] || 'https://placehold.co/600x420?text=Missing+Person';
  const caseUrl = window.location.href;

  // Tracking toggle is visible to admin/police only
  const isOwnerOrGuardian = user && (user.role === 'admin' || user.role === 'police');

  const movementTrail = movementAnalysis?.trail || [];
  const movementMarkers = movementTrail.length > 0
    ? movementTrail.map((point, index) => ({
      lat: point.lat,
      lng: point.lng,
      title: point.source === 'last_seen' ? 'Last seen' : `Seen ${index}`,
      description: point.location_text || point.description || '',
    }))
    : [
      { lat: item.last_seen_lat, lng: item.last_seen_lng, title: 'Last seen', description: item.last_seen_location },
      // Verified sighting markers only visible to guardian/admin/police (sightings array is empty for others)
      ...(item.sightings || []).filter(s => s.status === 'verified').map(s => ({
        lat: s.lat, lng: s.lng, title: 'Verified sighting', description: s.description
      })),
    ];
  const predictionMarker = movementAnalysis?.prediction
    ? [{
      lat: movementAnalysis.prediction.lat,
      lng: movementAnalysis.prediction.lng,
      title: movementAnalysis.prediction.mode === 'radius' ? 'Probability radius center' : 'Next probable area',
      description: `${movementAnalysis.prediction.area} (${movementAnalysis.prediction.confidence}% confidence)`,
    }]
    : [];
  const movementPolyline = movementTrail.map(point => [Number(point.lat), Number(point.lng)]);
  const movementCircles = movementAnalysis?.prediction?.mode === 'radius'
    ? [{
      lat: movementAnalysis.prediction.lat,
      lng: movementAnalysis.prediction.lng,
      radius: movementAnalysis.prediction.radius_meters,
      title: 'Probable search radius',
      description: `${movementAnalysis.prediction.area} (${movementAnalysis.prediction.confidence}% confidence)`,
    }]
    : [];

  const markers = [
    ...movementMarkers,
    ...predictionMarker,
    // Task 18.1: add timeline entry markers for entries that have coordinates
    ...timelineEntries.filter(e => e.lat != null && e.lng != null).map(e => ({
      lat: e.lat, lng: e.lng,
      title: `Timeline: ${e.location_text}`,
      description: e.notes || e.location_text
    })),
    // Auto-located user position
    ...(userLocation ? [{ lat: userLocation.lat, lng: userLocation.lng, title: 'Your location', description: 'Your current device location' }] : [])
  ];

  const mapCenter = userLocation
    ? [userLocation.lat, userLocation.lng]
    : [item.last_seen_lat, item.last_seen_lng];

  return (
    <>
      <Navbar />
      <main className="container" style={{ paddingBottom: 60 }}>

        {/* Breadcrumb */}
        <div style={{ margin: '20px 0 24px', fontSize: 13, color: 'var(--muted)' }}>
          <Link to="/cases" style={{ color: 'var(--primary)', fontWeight: 600 }}>← Back to Cases</Link>
        </div>

        <div className="details-grid">
          {/* Left — Photo & QR */}
          <section>
            <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
              <img className="big-photo" src={image} alt={item.name} style={{ borderRadius: 0 }} />
            </div>
            {item.images?.length > 1 && (
              <div className="thumbs">
                {item.images.map((src, i) => <img key={i} src={src} alt={`Photo ${i + 1}`} />)}
              </div>
            )}

            {/* QR Code */}
            <div className="qr-box">
              <div className="qr-header">
                <div>
                  <div className="qr-title">{t('case.qr_title')}</div>
                  <div className="qr-id">ID: {item.id.slice(0, 8).toUpperCase()}</div>
                </div>
                <button className="btn outline small" onClick={() => setShowQR(!showQR)}>
                  {showQR ? t('case.hide_qr') : t('case.show_qr')}
                </button>
              </div>
              {showQR && (
                <div className="qr-code-wrap">
                  <QRCodeSVG value={caseUrl} size={160} level="H" includeMargin />
                  <p className="qr-hint">Scan to open this case on any device</p>
                  <button className="btn small" onClick={() => {
                    const svg = document.querySelector('.qr-code-wrap svg');
                    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `case-${item.id.slice(0, 8)}.svg`;
                    a.click();
                  }}>{t('case.download_qr')}</button>
                </div>
              )}
            </div>
          </section>

          {/* Right — Details */}
          <section className="panel" style={{ padding: 28 }}>
            <div className="row between" style={{ marginBottom: 16 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: 'var(--text)' }}>{item.name}</h1>
              <span className={`badge ${item.status}`}>{item.status}</span>
            </div>

            {/* Detail grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 20 }}>
              {[
                [<svg key="age" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0112 0v2"/></svg>, 'Age', item.age],
                [<svg key="gen" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="2" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="22" y2="12"/></svg>, 'Gender', item.gender],
                [<svg key="ht" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><polyline points="17 7 12 2 7 7"/><polyline points="7 17 12 22 17 17"/></svg>, 'Height', item.height],
                [<svg key="wt" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 013 3c0 1.5-1 2.5-1 4H10c0-1.5-1-2.5-1-4a3 3 0 013-3z"/><path d="M5 9h14l1 12H4L5 9z"/></svg>, 'Weight', item.weight],
                [<svg key="sk" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>, 'Skin Color', item.skin_color],
              ].filter(([, , v]) => v).map(([icon, label, value]) => (
                <div key={label} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>{icon} {label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Last Seen
              </div>
              <p style={{ margin: 0, fontSize: 15, color: 'var(--text)', fontWeight: 600 }}>{item.last_seen_location}</p>
            </div>

            {item.clothing && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/></svg>
                  Clothing
                </div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>{item.clothing}</p>
              </div>
            )}

            {item.identifying_marks && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  Identifying Marks
                </div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>{item.identifying_marks}</p>
              </div>
            )}

            {item.medical_info && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                  Medical Info
                </div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>{item.medical_info}</p>
              </div>
            )}

            {item.description && (
              <div style={{ marginBottom: 20, background: 'var(--bg)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  Description
                </div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{item.description}</p>
              </div>
            )}

            <div className="row gap" style={{ flexWrap: 'wrap' }}>
              <Link className="btn danger" to={`/sighting/${item.id}`}>{t('case.saw_person')}</Link>
              <button className="btn outline" onClick={() => navigator.share?.({ title: item.name, url: caseUrl })}>{t('case.share')}</button>
              {/* AI match only for admin/police */}
              {user && (user.role === 'admin' || user.role === 'police') && (
                <button className="btn outline" onClick={runAIMatch} disabled={loadingMatch}>
                  {loadingMatch ? t('case.ai_matching') : t('case.ai_match')}
                </button>
              )}
            </div>
          </section>
        </div>

        {/* AI Match Results — only visible to admin/police */}
        {matches !== null && user && (user.role === 'admin' || user.role === 'police') && (
          <div className="ai-match-box">
            <h2>AI Matching Results</h2>
            <p className="muted">Sightings ranked by keyword similarity with case details.</p>
            {matches.length === 0 ? (
              <p className="muted">No sightings found for this case yet.</p>
            ) : (
              <div className="ai-match-list">
                {matches.map(m => (
                  <div key={m.id} className="ai-match-item">
                    <div className="ai-match-header">
                      <div className="ai-score-bar">
                        <div className="ai-score-fill" style={{
                          width: `${m.ai_match_score}%`,
                          background: m.ai_match_score > 50 ? 'var(--success)' : m.ai_match_score > 20 ? 'var(--warning)' : 'var(--danger)'
                        }} />
                      </div>
                      <span className="ai-score-num">{m.ai_match_score}% match</span>
                      <span className={`badge ${m.status}`}>{m.status}</span>
                    </div>
                    <p className="ai-match-desc">{m.description}</p>
                    <div className="ai-match-meta">
                      <span>{m.location_text || 'Unknown location'}</span>
                      <span>{new Date(m.created_at).toLocaleString()}</span>
                      {m.ai_matched_keywords.length > 0 && (
                        <span>Keywords: <b>{m.ai_matched_keywords.join(', ')}</b></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Req 3: Found Person Photo section — only shown when status is "found" */}
        {item.status === 'found' && (
          <section className="panel found-photo-section" style={{ marginBottom: 32, padding: 24 }}>
            <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 20, fontWeight: 800 }}>
              Found Person Photo
            </h2>
            {foundPhotos.length === 0 ? (
              <p className="muted">No found-person photo has been uploaded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                {foundPhotos.map(photo => (
                  <div key={photo.id} style={{ maxWidth: 320 }}>
                    <img
                      src={photo.image_url}
                      alt="Found person"
                      style={{ width: '100%', borderRadius: 12, boxShadow: 'var(--shadow-md)', display: 'block' }}
                    />
                    <p className="muted" style={{ fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                      Uploaded: {new Date(photo.created_at).toLocaleString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <h2>Movement Pattern & Probable Area</h2>
        {movementAnalysis && (
          <section className="panel" style={{ padding: 18, marginBottom: 16 }}>
            <div className="row between" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 280px' }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 6 }}>
                  Last seen route
                </div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)', lineHeight: 1.5 }}>
                  {movementAnalysis.movement_pattern || 'Not enough verified sightings yet'}
                </p>
              </div>
              {movementAnalysis.prediction && (
                <div style={{ flex: '0 1 300px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>
                    AI/ML probable next area
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>
                    {movementAnalysis.prediction.area}
                  </div>
                  <div style={{ fontSize: 13, color: '#0369a1', marginTop: 4 }}>
                    Confidence {movementAnalysis.prediction.confidence}%
                    {movementAnalysis.prediction.mode === 'radius' && movementAnalysis.prediction.radius_km ? ` • Radius ${movementAnalysis.prediction.radius_km} km` : ''}
                    {movementAnalysis.prediction.mode === 'route' && movementAnalysis.prediction.distance_km ? ` • Route ${movementAnalysis.prediction.distance_km} km` : ''}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
        <MapView
          center={mapCenter}
          markers={markers}
          polyline={movementAnalysis?.prediction?.mode === 'radius' ? null : movementPolyline.length > 1 ? movementPolyline : locationTrail}
          circles={movementCircles}
        />

        <h2>{t('case.timeline_title')}</h2>
        {/* Task 18.1: Display case timeline entries from the API */}
        <div className="timeline">
          {timelineEntries.length === 0 && (
            <p className="muted">No timeline entries yet.</p>
          )}
          {timelineEntries.map(entry => (
            <div className="timeline-item" key={entry.id}>
              <div className="row between" style={{ flexWrap: 'wrap', gap: 6 }}>
                <b>{new Date(entry.entry_time).toLocaleString()}</b>
                <span className="muted" style={{ fontSize: 13 }}>{entry.location_text}</span>
              </div>
              {entry.notes && <p style={{ margin: '6px 0 0', fontSize: 14 }}>{entry.notes}</p>}
            </div>
          ))}
        </div>

        {/* Task 18.2: Add Timeline Entry form — visible to admin/police only */}
        {user && (user.role === 'admin' || user.role === 'police') && (
          <section className="timeline-entry-form" style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 14 }}>Add Timeline Entry</h3>
            <form className="form-grid" onSubmit={handleTimelineSubmit}>
              <div className="form-row-2">
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                    Date &amp; Time <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={timelineForm.entry_time}
                    onChange={e => setTimelineForm(f => ({ ...f, entry_time: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                    Location <span style={{ color: 'var(--red)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dhaka, Mirpur-10"
                    value={timelineForm.location_text}
                    onChange={e => setTimelineForm(f => ({ ...f, location_text: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                  Pin Location on Map (optional)
                </label>
                <p className="muted" style={{ fontSize: 12, marginBottom: 8, marginTop: 0 }}>
                  Click on the map to set the location for this timeline entry.
                </p>
                <MapView
                  center={
                    timelineForm.lat && timelineForm.lng
                      ? [Number(timelineForm.lat), Number(timelineForm.lng)]
                      : [item.last_seen_lat, item.last_seen_lng]
                  }
                  markers={
                    timelineForm.lat && timelineForm.lng
                      ? [{ lat: Number(timelineForm.lat), lng: Number(timelineForm.lng), title: 'Selected location', description: timelineForm.location_text || '' }]
                      : []
                  }
                  onPick={async latlng => {
                    const lat = latlng.lat.toFixed(6);
                    const lng = latlng.lng.toFixed(6);
                    setTimelineForm(f => ({ ...f, lat, lng }));
                    try {
                      const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
                        { headers: { 'Accept-Language': 'en' } }
                      );
                      const data = await res.json();
                      const addr = data.address || {};
                      const locationText =
                        [addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.village, addr.country]
                          .filter(Boolean)
                          .join(', ');
                      if (locationText) {
                        setTimelineForm(f => ({ ...f, lat, lng, location_text: locationText }));
                      }
                    } catch {
                      // reverse geocode failed silently, user can type manually
                    }
                  }}
                  height={220}
                />
                {timelineForm.lat && timelineForm.lng && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {Number(timelineForm.lat).toFixed(5)}, {Number(timelineForm.lng).toFixed(5)}
                    </span>
                    <button
                      type="button"
                      className="db-mini-btn"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => setTimelineForm(f => ({ ...f, lat: '', lng: '' }))}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  Notes (optional)
                </label>
                <textarea
                  placeholder="Additional details about this timeline entry..."
                  value={timelineForm.notes}
                  onChange={e => setTimelineForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              {timelineFormError && (
                <p className="error" style={{ margin: 0 }}>{timelineFormError}</p>
              )}
              <div>
                <button type="submit" className="btn" disabled={timelineFormSubmitting}>
                  {timelineFormSubmitting ? 'Adding...' : '+ Add Entry'}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </>
  );
}

