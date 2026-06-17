import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import MapView from '../components/MapView';
import { api } from '../api/client';
import { describePhoto } from '../utils/aiDescriber';
import { useLang } from '../context/LangContext';
import { useAuth } from '../context/AuthContext';

export default function ReportCase() {
  const nav = useNavigate();
  const { t } = useLang();
  const { refreshUser } = useAuth();
  const [pos, setPos] = useState({ lat: 23.8103, lng: 90.4125 });
  const [geocoding, setGeocoding] = useState(false);
  const geocodeTimer = useRef(null);
  const isOnline = navigator.onLine;
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('error');
  const [photoError, setPhotoError] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [form, setForm] = useState({
    reporter_name: '',
    reporter_phone: '',
    reporter_relation: '',
    name: '',
    name_bn: '',
    age: '',
    gender: '',
    skin_color: '',
    height: '',
    weight: '',
    clothing: '',
    identifying_marks: '',
    medical_info: '',
    description: '',
    last_seen_location: '',
    last_seen_time: '',
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handlePhoto(e) {
    const f = e.target.files[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
    setPhotoError(false);
    setAiGenerated(false);
    setAiLoading(true);
    describePhoto(f).then(description => {
      setAiLoading(false);
      if (description) {
        set('description', description);
        setAiGenerated(true);
      }
    });
  }

  function handleVideo(e) {
    const f = e.target.files[0];
    if (f) setVideoFile(f);
  }

  async function handleMapPick(latlng) {
    setPos(latlng);
    setGeocoding(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json&accept-language=en`,
        { headers: { 'Accept-Language': 'en' }, signal: controller.signal }
      );
      const data = await res.json();
      if (data && data.display_name) {
        const a = data.address || {};
        const parts = [
          a.road || a.neighbourhood || a.suburb,
          a.city_district || a.suburb || a.town || a.village,
          a.city || a.county,
          a.state,
        ].filter(Boolean);
        const short = parts.length ? parts.join(', ') : data.display_name;
        set('last_seen_location', short);
      }
    } catch {
      // On timeout or error: leave existing value unchanged
    } finally {
      clearTimeout(timeout);
      setGeocoding(false);
    }
  }

  function handleLocationTextChange(value) {
    set('last_seen_location', value);
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    if (!value.trim() || value.trim().length < 4) return;
    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=1&accept-language=en`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        if (data && data[0]) {
          setPos({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      } catch {
        // silently ignore
      } finally {
        setGeocoding(false);
      }
    }, 800);
  }

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    setSubmitting(true);

    if (!photoFile) {
      setPhotoError(true);
      setMsgType('error');
      setMsg('A photo is required. Please upload a photo of the missing person.');
      setSubmitting(false);
      return;
    }

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    fd.append('last_seen_lat', pos.lat);
    fd.append('last_seen_lng', pos.lng);
    if (photoFile) fd.append('images', photoFile);
    if (videoFile) fd.append('video', videoFile);
    try {
      const { data } = await api.post('/cases', fd);
      await refreshUser?.();
      nav(`/cases/${data.id}`);
    } catch (err) {
      setMsgType('error');
      setMsg(err.response?.data?.message || 'Failed to submit report');
    }
    setSubmitting(false);
  }

  return (
    <>
      <Navbar />
      <div className="rc-page">
        <div className="rc-container">

          <div className="rc-header">
            <h1>{t('rc.header_title')}</h1>
            <p>{t('rc.header_sub')}</p>
          </div>

          {msg && (
            <div className={msgType === 'success' ? 'rc-success' : 'rc-error'}>
              {msgType === 'success' ? '' : <strong>Error:</strong>} {msg}
            </div>
          )}

          <form onSubmit={submit}>

            <div className="rc-card">
              <div className="rc-section-title">
                <span>{t('rc.sec1')}</span>
                <div className="rc-section-line" />
              </div>
              <p className="rc-section-sub">{t('rc.sec1_sub')}</p>
              <div className="rc-grid-2">
                <div className="rc-field">
                  <label>{t('rc.reporter_name')} <span className="req">*</span></label>
                  <input value={form.reporter_name} onChange={e => set('reporter_name', e.target.value)} placeholder={t('rc.reporter_name')} required />
                </div>
                <div className="rc-field">
                  <label>{t('rc.reporter_phone')} <span className="req">*</span></label>
                  <input value={form.reporter_phone} onChange={e => set('reporter_phone', e.target.value)} placeholder="+880 1XXX-XXXXXX" required />
                </div>
                <div className="rc-field rc-full">
                  <label>{t('rc.relation')} <span className="req">*</span></label>
                  <select value={form.reporter_relation} onChange={e => set('reporter_relation', e.target.value)} required>
                    <option value="">{t('rc.relation_placeholder')}</option>
                    <option value="parent">{t('rc.relation_parent')}</option>
                    <option value="sibling">{t('rc.relation_sibling')}</option>
                    <option value="spouse">{t('rc.relation_spouse')}</option>
                    <option value="relative">{t('rc.relation_relative')}</option>
                    <option value="friend">{t('rc.relation_friend')}</option>
                    <option value="neighbor">{t('rc.relation_neighbor')}</option>
                    <option value="other">{t('rc.relation_other')}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rc-card">
              <div className="rc-section-title">
                <span>{t('rc.sec2')}</span>
                <div className="rc-section-line" />
              </div>
              <p className="rc-section-sub">{t('rc.sec2_sub')}</p>
              <div className="rc-grid-2">
                <div className="rc-field">
                  <label>{t('rc.name_en')} <span className="req">*</span></label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name in English" required />
                </div>
                <div className="rc-field">
                  <label>{t('rc.name_bn')}</label>
                  <input value={form.name_bn} onChange={e => set('name_bn', e.target.value)} placeholder="বাংলায় নাম" />
                </div>
                <div className="rc-field">
                  <label>{t('rc.age')} <span className="req">*</span></label>
                  <input type="number" value={form.age} onChange={e => set('age', e.target.value)} placeholder="e.g. 25" min="0" max="120" required />
                </div>
                <div className="rc-field">
                  <label>{t('rc.gender')} <span className="req">*</span></label>
                  <select value={form.gender} onChange={e => set('gender', e.target.value)} required>
                    <option value="">{t('rc.gender_placeholder')}</option>
                    <option value="Male">{t('rc.gender_male')}</option>
                    <option value="Female">{t('rc.gender_female')}</option>
                    <option value="Other">{t('rc.gender_other')}</option>
                  </select>
                </div>
                <div className="rc-field">
                  <label>{t('rc.skin')}</label>
                  <select value={form.skin_color} onChange={e => set('skin_color', e.target.value)}>
                    <option value="">{t('rc.skin_placeholder')}</option>
                    <option value="Fair">{t('rc.skin_fair')}</option>
                    <option value="Wheatish">{t('rc.skin_wheatish')}</option>
                    <option value="Brown">{t('rc.skin_brown')}</option>
                    <option value="Dark">{t('rc.skin_dark')}</option>
                  </select>
                </div>
                <div className="rc-field">
                  <label>{t('rc.height')}</label>
                  <input value={form.height} onChange={e => set('height', e.target.value)} placeholder="e.g. 5.6 ft" />
                </div>
                <div className="rc-field">
                  <label>{t('rc.weight')}</label>
                  <input value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="e.g. 60 kg" />
                </div>
                <div className="rc-field">
                  <label>{t('rc.clothing')}</label>
                  <input value={form.clothing} onChange={e => set('clothing', e.target.value)} placeholder="e.g. Blue shirt, black pants" />
                </div>
                <div className="rc-field rc-full">
                  <label>{t('rc.marks')}</label>
                  <input value={form.identifying_marks} onChange={e => set('identifying_marks', e.target.value)} placeholder="Scars, tattoos, birthmarks, etc." />
                </div>
                <div className="rc-field rc-full">
                  <label>{t('rc.medical')}</label>
                  <input value={form.medical_info} onChange={e => set('medical_info', e.target.value)} placeholder="Any medical conditions, medications, etc." />
                </div>
                <div className="rc-field rc-full">
                  <label>{t('rc.desc')}</label>
                  {aiGenerated && (
                    <div style={{ fontSize: 12, color: '#7c3aed', marginBottom: 4, fontWeight: 600 }}>
                      {t('rc.ai_generated')}
                    </div>
                  )}
                  {aiLoading && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      {t('rc.ai_loading')}
                    </div>
                  )}
                  <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the person in detail..." rows={4} />
                </div>
              </div>
            </div>

            <div className="rc-card">
              <div className="rc-section-title">
                <span>{t('rc.sec3')}</span>
                <div className="rc-section-line" />
              </div>
              <p className="rc-section-sub">{t('rc.sec3_sub')}</p>
              <div className="rc-grid-2">
                <div className="rc-field">
                  <label>{t('rc.last_location')} <span className="req">*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={form.last_seen_location}
                      onChange={e => handleLocationTextChange(e.target.value)}
                      placeholder="Pin on map or type manually"
                      required
                      style={{ paddingRight: geocoding ? 36 : 12 }}
                    />
                    {geocoding && (
                      <span style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 14, color: '#27AE60'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </span>
                    )}
                  </div>
                </div>
                <div className="rc-field">
                  <label>{t('rc.last_time')}</label>
                  <input type="datetime-local" value={form.last_seen_time} onChange={e => set('last_seen_time', e.target.value)} />
                </div>
              </div>
              <div className="rc-map-label">
                {t('rc.map_label')} <span className="rc-map-hint">{t('rc.map_hint')}</span>
              </div>
              <MapView
                center={[pos.lat, pos.lng]}
                markers={[{ lat: pos.lat, lng: pos.lng, title: 'Last seen location' }]}
                onPick={handleMapPick}
                height={300}
                draggable={true}
              />
              <p className="rc-coords">{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</p>
            </div>

            <div className="rc-card">
              <div className="rc-section-title">
                <span>{t('rc.sec4')}</span>
                <div className="rc-section-line" />
              </div>
              <p className="rc-section-sub">{t('rc.sec4_sub')}</p>
              {!isOnline && (
                <p className="rc-offline-note">{t('rc.offline_note')}</p>
              )}
              <div className="rc-grid-2">
                <div className="rc-field">
                  <label>{t('rc.photo_label')} <span className="rc-file-hint">(Max 10MB)</span></label>
                  <label className={`rc-dropzone${photoError ? ' rc-dropzone-error' : ''}`} htmlFor="photo-input">
                    {photoPreview ? (
                      <div className="rc-photo-preview">
                        <img src={photoPreview} alt="preview" />
                        <div className="rc-photo-meta">
                          <span className="rc-filename">{photoFile?.name}</span>
                          <span className="rc-ready">{t('rc.ready')}</span>
                        </div>
                        <button type="button" className="rc-remove-btn" onClick={e => { e.preventDefault(); setPhotoFile(null); setPhotoPreview(null); }}>{t('rc.remove')}</button>
                      </div>
                    ) : (
                      <div className="rc-dropzone-inner">
                        <span className="rc-drop-icon">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        </span>
                        <span>{t('rc.drop_browse')}</span>
                        <span className="rc-drop-hint">{t('rc.drop_hint_img')}</span>
                        {photoError && <span className="rc-drop-required">{t('rc.photo_required')}</span>}
                      </div>
                    )}
                  </label>
                  <input id="photo-input" type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
                </div>

                <div className="rc-field">
                  <label>{t('rc.video_label')} <span className="rc-file-hint">(Max 30MB)</span></label>
                  <label className="rc-dropzone" htmlFor="video-input">
                    {videoFile ? (
                      <div className="rc-photo-preview">
                        <div className="rc-video-icon">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                        </div>
                        <div className="rc-photo-meta">
                          <span className="rc-filename">{videoFile.name}</span>
                          <span className="rc-ready">{t('rc.ready')}</span>
                        </div>
                        <button type="button" className="rc-remove-btn" onClick={e => { e.preventDefault(); setVideoFile(null); }}>{t('rc.remove')}</button>
                      </div>
                    ) : (
                      <div className="rc-dropzone-inner">
                        <span className="rc-drop-icon">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                        </span>
                        <span>{t('rc.drop_browse')}</span>
                        <span className="rc-drop-hint">{t('rc.drop_hint_vid')}</span>
                      </div>
                    )}
                  </label>
                  <input id="video-input" type="file" accept="video/*" onChange={handleVideo} style={{ display: 'none' }} />
                </div>
              </div>
            </div>

            <button type="submit" className="rc-btn-submit" disabled={submitting}>
              {submitting ? t('rc.submitting') : t('rc.submit')}
            </button>
            <p className="rc-required-note">{t('rc.required_note')}</p>

          </form>
        </div>
      </div>
    </>
  );
}
