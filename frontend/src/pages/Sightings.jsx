import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../api/client';
import { useLang } from '../context/LangContext';

// ── SightingHistoryDropdown ───────────────────────────────────
// একটা case এর sighting history dropdown
function SightingHistoryDropdown({ caseId }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadHistory() {
    if (history !== null) { setOpen(o => !o); return; }
    setOpen(true);
    setLoading(true);
    setError('');
    try {
      const r = await api.get(`/sightings/history/${caseId}`);
      setHistory(r.data.history || []);
    } catch {
      setError('History load করা যায়নি।');
      setHistory([]);
    }
    setLoading(false);
  }

  const confidenceLabel = { sure: 'নিশ্চিত', maybe: 'সম্ভবত', not_sure: 'অনিশ্চিত' };
  const scanStatusLabel = {
    matched: '✅ Face Match',
    no_match: '❌ No Match',
    low_confidence: '⚠️ Low Confidence',
    error: '🔴 Scan Error',
  };
  const scanStatusColor = {
    matched: '#16a34a',
    no_match: '#dc2626',
    low_confidence: '#d97706',
    error: '#9ca3af',
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={loadHistory}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '7px 14px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--primary)',
          cursor: 'pointer',
          width: '100%',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Sighting History
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{
          border: '1px solid var(--border)',
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          background: 'var(--bg)',
          maxHeight: 340,
          overflowY: 'auto',
        }}>
          {loading && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              Loading...
            </div>
          )}
          {error && (
            <div style={{ padding: '12px 16px', color: '#dc2626', fontSize: 13 }}>{error}</div>
          )}
          {!loading && history !== null && history.length === 0 && (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              এখনো কোনো sighting নেই।
            </div>
          )}
          {!loading && history && history.map((entry, i) => (
            <div
              key={entry.sighting_id}
              style={{
                padding: '12px 16px',
                borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              {/* Date + confidence */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                  {new Date(entry.sighted_at).toLocaleString('bn-BD', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: entry.confidence_level === 'sure' ? '#dcfce7'
                    : entry.confidence_level === 'maybe' ? '#fef9c3' : '#fee2e2',
                  color: entry.confidence_level === 'sure' ? '#16a34a'
                    : entry.confidence_level === 'maybe' ? '#ca8a04' : '#dc2626',
                }}>
                  {confidenceLabel[entry.confidence_level] || entry.confidence_level}
                </span>
              </div>

              {/* Location */}
              {entry.location_text && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, fontSize: 13 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{entry.location_text}</span>
                </div>
              )}

              {/* Description */}
              {entry.description && (
                <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                  {entry.description}
                </p>
              )}

              {/* Sighting photo */}
              {entry.image_url && (
                <img
                  src={entry.image_url}
                  alt="Sighting"
                  style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 6 }}
                />
              )}

              {/* Face scan result */}
              {entry.scan_id && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginTop: 6,
                  padding: '6px 10px', borderRadius: 8,
                  background: entry.scan_status === 'matched' ? '#f0fdf4' : '#f9fafb',
                  border: `1px solid ${entry.scan_status === 'matched' ? '#bbf7d0' : 'var(--border)'}`,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={scanStatusColor[entry.scan_status] || '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 700, color: scanStatusColor[entry.scan_status] || '#6b7280' }}>
                    {scanStatusLabel[entry.scan_status] || entry.scan_status}
                  </span>
                  {entry.face_match_score != null && (
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                      {Number(entry.face_match_score).toFixed(1)}% match
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SightingCaseCard ──────────────────────────────────────────
// Sighting page এ প্রতিটা case এর জন্য card
function SightingCaseCard({ item }) {
  const img = item.images?.[0] || 'https://placehold.co/300x200?text=No+Photo';

  const statusColor = {
    active: { bg: '#dbeafe', text: '#1d4ed8' },
    found: { bg: '#dcfce7', text: '#16a34a' },
    closed: { bg: '#f3f4f6', text: '#6b7280' },
    pending: { bg: '#fef9c3', text: '#ca8a04' },
    verified: { bg: '#ede9fe', text: '#7c3aed' },
  }[item.status] || { bg: '#f3f4f6', text: '#6b7280' };

  const statusLabel = {
    active: 'সক্রিয়',
    found: 'পাওয়া গেছে',
    closed: 'বন্ধ',
    pending: 'অপেক্ষমাণ',
    verified: 'যাচাইকৃত',
  }[item.status] || item.status;

  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: 14,
      boxShadow: 'var(--shadow)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Photo */}
      <div style={{ position: 'relative', height: 180, overflow: 'hidden' }}>
        <img
          src={img}
          alt={item.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <span style={{
          position: 'absolute', top: 10, right: 10,
          background: statusColor.bg, color: statusColor.text,
          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
          {item.name}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, fontSize: 13, color: 'var(--muted)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          {item.last_seen_location}
        </div>

        {item.age && (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
            বয়স: {item.age} বছর {item.gender ? `• ${item.gender}` : ''}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 12 }}>
          <Link
            to={`/sighting/${item.id}`}
            style={{
              flex: 1, textAlign: 'center', textDecoration: 'none',
              background: 'var(--green)', color: '#fff',
              borderRadius: 8, padding: '8px 10px', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            আমি দেখেছি
          </Link>
          <Link
            to={`/cases/${item.id}`}
            style={{
              flex: 1, textAlign: 'center', textDecoration: 'none',
              background: 'transparent', color: 'var(--primary)',
              border: '1px solid var(--primary)',
              borderRadius: 8, padding: '8px 10px', fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            বিস্তারিত
          </Link>
        </div>

        {/* History dropdown */}
        <SightingHistoryDropdown caseId={item.id} />
      </div>
    </div>
  );
}

// ── Main Sightings Page ───────────────────────────────────────
export default function Sightings() {
  const { t } = useLang();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/cases')
      .then(r => { setCases(r.data); setLoading(false); })
      .catch(() => { setError('Cases load করা যায়নি। পেজ refresh করুন।'); setLoading(false); });
  }, []);

  const filtered = cases.filter(c =>
    [c.name, c.last_seen_location, c.gender, String(c.age || '')]
      .join(' ').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Navbar />
      <main className="container" style={{ paddingBottom: 60 }}>

        {/* Header */}
        <div style={{ margin: '28px 0 24px' }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 900, color: 'var(--text)' }}>
            Sighting রিপোর্ট করুন
          </h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
            নিচের যেকোনো case এর জন্য "আমি দেখেছি" বাটনে ক্লিক করুন। প্রতিটা card এ
            <strong> Sighting History</strong> dropdown এ আগের সব sighting দেখতে পাবেন।
          </p>
        </div>

        {/* Info banner */}
        <div style={{
          background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12,
          padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0369a1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style={{ fontSize: 13, color: '#0369a1', lineHeight: 1.6 }}>
            আপনার দেওয়া তথ্য ও ছবি <strong>face scanner</strong> দিয়ে scan হবে এবং
            match হলে সেই case এর history তে যোগ হবে। Anonymous submission সম্পূর্ণ নিরাপদ।
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <svg
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="নাম বা এলাকা দিয়ে খুঁজুন..."
            style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Count */}
        {!loading && !error && (
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {filtered.length} টি case দেখানো হচ্ছে
          </p>
        )}

        {/* States */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
            Loading cases...
          </div>
        )}
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}

        {/* Case cards grid */}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
            কোনো case পাওয়া যায়নি।
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {filtered.map(c => (
              <SightingCaseCard key={c.id} item={c} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
