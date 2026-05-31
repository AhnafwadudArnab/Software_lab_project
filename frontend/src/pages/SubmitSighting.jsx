import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MapView from '../components/MapView';
import { useLang } from '../context/LangContext';
import { api } from '../api/client';

function currentLocalDateTimeInput() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function SubmitSighting() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t } = useLang();
  const [cases, setCases] = useState([]);
  const [casesError, setCasesError] = useState('');
  const [image, setImage] = useState(null);
  const [pos, setPos] = useState({ lat: 23.8103, lng: 90.4125 });
  const [geocoding, setGeocoding] = useState(false);
  const [form, setForm] = useState({
    missing_person_id: id || '',
    location_text: '',
    sighted_at: currentLocalDateTimeInput(),
    description: '',
    confidence_level: 'maybe',
    reporter_name: '',
    reporter_phone: '',
  });
  const [anonymous, setAnonymous] = useState(true);
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedMatch, setSubmittedMatch] = useState(null);

  useEffect(() => {
    api.get('/cases')
      .then(r => setCases(r.data))
      .catch(() => setCasesError('Could not load cases list. Please refresh and try again.'));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      position => {
        handleMapPick({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  async function handleMapPick(latlng) {
    setPos(latlng);
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json&accept-language=en`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data?.display_name) {
        const a = data.address || {};
        const parts = [
          a.road || a.neighbourhood || a.suburb,
          a.city_district || a.suburb || a.town || a.village,
          a.city || a.county,
          a.state,
        ].filter(Boolean);
        setForm(f => ({ ...f, location_text: parts.length ? parts.join(', ') : data.display_name }));
      }
    } catch { /* silently fail */ } finally { setGeocoding(false); }
  }

  async function handleLocationText(e) {
    const val = e.target.value;
    setForm(f => ({ ...f, location_text: val }));
    // Try to geocode typed location
    if (val.length > 4) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=1&accept-language=en`
        );
        const data = await res.json();
        if (data?.[0]) {
          setPos({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      } catch { /* silently fail */ }
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.missing_person_id && !image) {
      setMsg('Please select a missing person or upload a clear photo so the system can match the sighting.');
      return;
    }
    setSubmitting(true);
    setMsg('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    fd.append('lat', pos.lat);
    fd.append('lng', pos.lng);
    if (image) fd.append('image', image);
    try {
      const r = await api.post('/sightings', fd);
      setSubmittedMatch(r.data?.auto_match || null);
      setSubmitted(true);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to submit sighting. Please try again.');
    }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <>
        <Navbar />
        <main className="container narrow" style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#eafaf1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800 }}>{t('ss.success_title')}</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 28 }}>
            {submittedMatch
              ? `Photo matched with ${submittedMatch.name}. This sighting was added to that case history.`
              : t('ss.success_sub')}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn" to="/cases">{t('ss.view_cases')}</Link>
            <button className="btn outline" onClick={() => { setSubmitted(false); setSubmittedMatch(null); setForm({ missing_person_id: '', location_text: '', sighted_at: currentLocalDateTimeInput(), description: '', confidence_level: 'maybe', reporter_name: '', reporter_phone: '' }); setImage(null); setAnonymous(true); }}>
              {t('ss.submit_another')}
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="container narrow">

        {/* Header */}
        <div style={{ margin: '28px 0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#eafaf1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{t('ss.header_title')}</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>{t('ss.header_sub')}</p>
        </div>

        {/* Identity toggle */}
        <div className="anon-toggle" style={{ marginBottom: 20 }}>
          <div className={`anon-option ${anonymous ? 'active' : ''}`} onClick={() => setAnonymous(true)}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </span>
            <div>
              <b>{t('ss.anon')}</b>
              <p>{t('ss.anon_sub')}</p>
            </div>
          </div>
          <div className={`anon-option ${!anonymous ? 'active' : ''}`} onClick={() => setAnonymous(false)}>
            <span style={{ display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
            <div>
              <b>{t('ss.contact')}</b>
              <p>{t('ss.contact_sub')}</p>
            </div>
          </div>
        </div>

        {casesError && <p className="error">{casesError}</p>}
        {msg && <p className="error" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px' }}>{msg}</p>}

        <form onSubmit={submit} className="form-grid">

          {/* Select person */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
              Who did you see?
              <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>Optional if you upload a photo</span>
            </label>
            <select
              value={form.missing_person_id}
              onChange={e => setForm({ ...form, missing_person_id: e.target.value })}
            >
              <option value="">I am not sure - scan my photo automatically</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.last_seen_location}</option>
              ))}
            </select>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 0' }}>
              If you do not know the person, upload a clear face photo. The system will scan active cases and attach this sighting to the matched case history.
            </p>
          </div>

          {/* Contact info (optional) */}
          {!anonymous && (
            <div className="form-row-2">
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13 }}>{t('ss.your_name')}</label>
                <input
                  value={form.reporter_name}
                  onChange={e => setForm({ ...form, reporter_name: e.target.value })}
                  placeholder="e.g. Rahim Uddin"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 13 }}>{t('ss.your_phone')}</label>
                <input
                  value={form.reporter_phone}
                  onChange={e => setForm({ ...form, reporter_phone: e.target.value })}
                  placeholder="+880 1XXX-XXXXXX"
                />
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
              দেখা যাওয়ার তারিখ ও সময় <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="datetime-local"
              value={form.sighted_at}
              onChange={e => setForm({ ...form, sighted_at: e.target.value })}
              required
            />
          </div>

          {/* Location */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
              {t('ss.where')} <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                value={form.location_text}
                onChange={handleLocationText}
                placeholder={t('ss.where_placeholder')}
                style={{ paddingRight: geocoding ? 36 : undefined }}
                required
              />
              {geocoding && (
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 8px' }}>{t('ss.map_hint')}</p>
            <MapView
              center={[pos.lat, pos.lng]}
              markers={[{ lat: pos.lat, lng: pos.lng, title: 'Sighting location' }]}
              onPick={handleMapPick}
            />
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
            </p>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
              {t('ss.what')} <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder={t('ss.what_placeholder')}
              required
            />
          </div>

          {/* Confidence */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{t('ss.confidence')}</label>
            <select
              value={form.confidence_level}
              onChange={e => setForm({ ...form, confidence_level: e.target.value })}
            >
              <option value="sure">{t('ss.conf_sure')}</option>
              <option value="maybe">{t('ss.conf_maybe')}</option>
              <option value="not_sure">{t('ss.conf_not_sure')}</option>
            </select>
          </div>

          {/* Photo */}
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
              {t('ss.photo')}
              <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>Required when the person is unknown</span>
            </label>
            <div style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '16px 20px', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <div style={{ flex: 1 }}>
                <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} style={{ width: '100%' }} />
                {image && <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>{image.name}</p>}
              </div>
            </div>
          </div>

          {anonymous && (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {t('ss.anon_note')}
            </div>
          )}

          <button className="btn full" style={{ background: 'var(--green)', fontSize: 15, padding: '13px' }} disabled={submitting}>
            {submitting ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                {t('ss.submitting')}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                {t('ss.submit')}
              </span>
            )}
          </button>
        </form>
      </main>
    </>
  );
}
