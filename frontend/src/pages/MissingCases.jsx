import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CaseCard from '../components/CaseCard';
import MapView from '../components/MapView';
import { api } from '../api/client';
import { useLang } from '../context/LangContext';

// Public-visible statuses only — backend never returns pending/rejected to anonymous users
const STATUSES = ['all', 'active', 'verified', 'found', 'closed'];

function getDistricts(cases) {
  const set = new Set();
  cases.forEach(c => {
    if (c.last_seen_location) {
      const parts = c.last_seen_location.split(',');
      const last = parts[parts.length - 1]?.trim();
      if (last) set.add(last);
    }
  });
  return Array.from(set).sort();
}

export default function MissingCases() {
  const [cases, setCases]             = useState([]);
  const [searchParams]                = useSearchParams();
  const [search, setSearch]           = useState(searchParams.get('q') || '');
  const [status, setStatus]           = useState('all');
  const [gender, setGender]           = useState('all');
  const [district, setDistrict]       = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView]               = useState('grid');
  const { t } = useLang();

  useEffect(() => {
    api.get('/cases').then(r => setCases(r.data)).catch(() => setCases([]));
  }, []);

  const districts = getDistricts(cases);

  const filtered = cases.filter(c => {
    const matchSearch   = [c.name, c.last_seen_location, c.gender, String(c.age || ''), c.case_id || '']
      .join(' ').toLowerCase().includes(search.toLowerCase());
    const matchStatus   = status === 'all' || c.status === status;
    const matchGender   = gender === 'all' || c.gender?.toLowerCase() === gender.toLowerCase();
    const matchDistrict = district === 'all' ||
      c.last_seen_location?.toLowerCase().includes(district.toLowerCase());
    return matchSearch && matchStatus && matchGender && matchDistrict;
  });

  const markers = filtered.map(c => ({
    lat: c.last_seen_lat, lng: c.last_seen_lng,
    title: c.name, description: c.last_seen_location
  }));

  return (
    <div className="cases-page-bg">
      <Navbar />
      <main className="container">

        <div className="mc-header">
          <div>
            <h1 className="mc-title">{t('cases.title')}</h1>
            <p className="mc-subtitle">
              {t('mc.subtitle').replace('{n}', cases.length)}
            </p>
          </div>
          <div className="mc-view-toggle">
            <button
              className={`mc-view-btn ${view === 'grid' ? 'active' : ''}`}
              onClick={() => setView('grid')}
              aria-label="Grid view"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
                <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
                <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
                <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
              </svg>
              Grid
            </button>
            <button
              className={`mc-view-btn ${view === 'map' ? 'active' : ''}`}
              onClick={() => setView('map')}
              aria-label="Map view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m0 13l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 10m0 3V7"/>
              </svg>
              Map
            </button>
          </div>
        </div>

        <div className="mc-search-wrap">
          <div className="mc-search-box">
            <svg className="mc-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              className="mc-search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('cases.search_placeholder')}
            />
            {search && (
              <button className="mc-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <button
            className={`mc-filter-btn ${filtersOpen ? 'active' : ''}`}
            onClick={() => setFiltersOpen(o => !o)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            {t('mc.filters')}
            {(status !== 'all' || gender !== 'All Genders' || district !== 'All Districts') && (
              <span className="mc-filter-dot" />
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="mc-filter-row">
            <select className="mc-select" value={district} onChange={e => setDistrict(e.target.value)}>
              <option value="all">{t('mc.all_districts')}</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              className="mc-select"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="all">{t('mc.all_status')}</option>
              {STATUSES.filter(s => s !== 'all').map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <select className="mc-select" value={gender} onChange={e => setGender(e.target.value)}>
              <option value="all">{t('mc.all_genders')}</option>
              <option value="male">{t('mc.male')}</option>
              <option value="female">{t('mc.female')}</option>
            </select>
          </div>
        )}

        <p className="mc-count">{t('mc.showing').replace('{f}', filtered.length).replace('{t}', cases.length)}</p>

        {view === 'grid' && (
          filtered.length === 0
            ? <div className="db-empty"><p>{t('cases.no_cases')}</p></div>
            : <div className="mun-cards-grid">{filtered.map(c => <CaseCard item={c} key={c.id} />)}</div>
        )}

        {view === 'map' && <MapView markers={markers} height={520} />}

      </main>
    </div>
  );
}
