import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import MapView from './MapView';

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

export default function MovementMapDropdown({ cases = [], initialCaseId = '' }) {
  const [caseId, setCaseId] = useState(initialCaseId || cases[0]?.id || '');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!caseId && cases[0]?.id) setCaseId(cases[0].id);
  }, [caseId, cases]);

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    setError('');
    api.get(`/sightings/movement/${caseId}`)
      .then(r => setAnalysis(r.data))
      .catch(err => {
        setAnalysis(null);
        setError(err.response?.data?.message || 'Movement history load failed.');
      })
      .finally(() => setLoading(false));
  }, [caseId]);

  const selectedCase = cases.find(c => c.id === caseId);
  const trail = analysis?.trail || [];
  const prediction = analysis?.prediction || null;

  const markers = useMemo(() => {
    const trailMarkers = trail.map((point, index) => ({
      lat: point.lat,
      lng: point.lng,
      title: point.source === 'last_seen' ? selectedCase?.name || 'Last seen' : `${selectedCase?.name || 'Person'} seen`,
      description: `${point.location_text || point.description || ''} • ${formatDate(point.observed_at)}`,
    }));
    const predictionMarker = prediction && prediction.mode !== 'radius' ? [{
      lat: prediction.lat,
      lng: prediction.lng,
      title: 'Next probable area',
      description: `${prediction.area} • Confidence ${prediction.confidence}%`,
    }] : [];
    return [...trailMarkers, ...predictionMarker];
  }, [prediction, selectedCase, trail]);

  const polyline = trail.map(point => [Number(point.lat), Number(point.lng)]);
  const circles = prediction?.mode === 'radius' ? [{
    lat: prediction.lat,
    lng: prediction.lng,
    radius: prediction.radius_meters,
    title: 'Probable search radius',
    description: `${prediction.area} • ${prediction.confidence}% confidence`,
  }] : [];
  const center = prediction?.mode === 'radius'
    ? [Number(prediction.lat), Number(prediction.lng)]
    : trail[trail.length - 1]
    ? [Number(trail[trail.length - 1].lat), Number(trail[trail.length - 1].lng)]
    : selectedCase
      ? [Number(selectedCase.last_seen_lat), Number(selectedCase.last_seen_lng)]
      : [23.8103, 90.4125];

  return (
    <section className="panel" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>Movement Map</h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Select a missing person to see last seen locations, witness GPS reports, and prediction.</p>
        </div>
        <select
          value={caseId}
          onChange={e => setCaseId(e.target.value)}
          style={{ minWidth: 260, padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'white', fontWeight: 700 }}
        >
          {cases.map(c => (
            <option key={c.id} value={c.id}>{c.name} - {c.id}</option>
          ))}
        </select>
      </div>

      {error && <div className="rc-error" style={{ marginBottom: 12 }}>{error}</div>}
      {loading && <p className="muted">Loading movement history...</p>}

      {!loading && analysis && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 320px)', gap: 14, marginBottom: 14 }}>
            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Route</div>
              <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.5 }}>{analysis.movement_pattern || 'No verified sightings yet'}</div>
            </div>
            {prediction && (
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>
                  {prediction.mode === 'radius' ? 'Probable Search Radius' : 'Probable Next Area'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{prediction.area}</div>
                <div style={{ fontSize: 13, color: '#0369a1', marginTop: 4 }}>
                  Confidence {prediction.confidence}%
                  {prediction.mode === 'radius' && prediction.radius_km ? ` • Radius ${prediction.radius_km} km` : ''}
                  {prediction.mode === 'route' && prediction.distance_km ? ` • Route ${prediction.distance_km} km` : ''}
                </div>
              </div>
            )}
          </div>

          <MapView
            center={center}
            markers={markers}
            polyline={prediction?.mode === 'radius' ? null : polyline.length > 1 ? polyline : null}
            circles={circles}
            height={460}
          />

          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            {trail.map((point, index) => (
              <div key={`${point.id || index}-${point.observed_at}`} style={{ display: 'grid', gridTemplateColumns: '42px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: '#fff' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: point.source === 'last_seen' ? '#dbeafe' : '#dcfce7', color: point.source === 'last_seen' ? '#1d4ed8' : '#15803d', display: 'grid', placeItems: 'center', fontWeight: 900 }}>
                  {index + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 800 }}>{point.location_text || 'Unknown location'}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {point.source === 'last_seen' ? 'Original last seen' : 'Witness GPS report'} • {formatDate(point.observed_at)}
                    {point.face_match_score != null ? ` • Face match ${Number(point.face_match_score).toFixed(1)}%` : ''}
                  </div>
                </div>
                <Link to={`/cases/${caseId}`} style={{ color: 'var(--green)', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>Open</Link>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
