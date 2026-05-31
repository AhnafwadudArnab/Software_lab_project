import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CaseCard from '../components/CaseCard';
import { api } from '../api/client';
import { useLang } from '../context/LangContext';
import heroBg from '../assets/202507asia_bangladesh_enforced_disappearances.webp';
import logoGif from '../assets/output-onlinegiftools.gif';

export default function Home() {
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState({ total: 0, found: 0, active: 0 });
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { t } = useLang();

  useEffect(() => {
    api.get('/cases').then(r => {
      const data = r.data || [];
      setCases(data);
      setStats({
        total: data.length,
        found: data.filter(c => c.status === 'found').length,
        active: data.filter(c => c.status === 'active' || c.status === 'verified').length,
      });
    }).catch(() => setCases([]));
  }, []);

  const recent = cases.slice(0, 4);

  function handleSearch(e) {
    e.preventDefault();
    navigate(search.trim() ? `/cases?q=${encodeURIComponent(search.trim())}` : '/cases');
  }

  return (
    <div className="home-page">
      <Navbar />

      {/* ── HERO ── */}
      <section className="home-hero" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="home-hero-overlay" />
        <div className="home-hero-content">
          <div className="home-hero-badge">
            {t('home.hero_badge')}
          </div>
          <h1 className="home-hero-title">
            {t('home.hero_title')}<br />
            <span className="home-hero-accent">{t('home.hero_accent')}</span>
          </h1>
          <p className="home-hero-sub">
            {t('home.hero_sub')}
          </p>

          {/* Search */}
          <form className="home-search-bar" onSubmit={handleSearch}>
            <span className="home-search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('home.search_placeholder')}
            />
            <button type="submit">{t('home.search_btn')}</button>
          </form>

          {/* CTAs — red for emergency report, outline for sighting */}
          <div className="home-hero-btns">
            <Link className="home-btn-primary" to="/report">
              {t('home.report_btn')}
            </Link>
            <Link className="home-btn-outline" to="/sighting">
              {t('home.sighting_btn')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="home-stats-bar">
        <div className="home-stats-inner">
          <div className="home-stat">
            <span className="home-stat-num">{stats.total}</span>
            <span className="home-stat-label">{t('home.stat_reported')}</span>
          </div>
          <div className="home-stat-divider" />
          <div className="home-stat">
            <span className="home-stat-num home-stat-green">{stats.found}</span>
            <span className="home-stat-label">{t('home.stat_found')}</span>
          </div>
          <div className="home-stat-divider" />
          <div className="home-stat">
            <span className="home-stat-num">{stats.active}</span>
            <span className="home-stat-label">{t('home.stat_active')}</span>
          </div>
          <div className="home-stat-divider" />
          <div className="home-stat">
            <span className="home-stat-num home-stat-green">24/7</span>
            <span className="home-stat-label">{t('home.stat_available')}</span>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="home-section home-how">
        <div className="home-section-inner">
          <div className="home-section-label">{t('home.how_label')}</div>
          <h2 className="home-section-title">{t('home.how_title')}</h2>
          <p className="home-section-sub">{t('home.how_sub')}</p>
          <div className="home-steps">
            {[
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, step: '01', title: t('home.step1_title'), desc: t('home.step1_desc') },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>, step: '02', title: t('home.step2_title'), desc: t('home.step2_desc') },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>, step: '03', title: t('home.step3_title'), desc: t('home.step3_desc') },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, step: '04', title: t('home.step4_title'), desc: t('home.step4_desc') },
            ].map(s => (
              <div className="home-step" key={s.step}>
                <div className="home-step-icon">{s.icon}</div>
                <div className="home-step-num">{s.step}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RECENT ALERTS ── */}
      <section className="home-section home-alerts-section">
        <div className="home-section-inner">
          <div className="home-alerts-header">
            <div className="home-section-label">{t('home.recent_label')}</div>
            <h2 className="home-section-title" style={{ marginBottom: 4 }}>{t('home.recent_title')}</h2>
            <p className="home-section-sub" style={{ marginTop: 0, marginBottom: 16 }}>
              {t('home.recent_sub')}
            </p>
            <Link className="home-btn-secondary" to="/cases">{t('home.view_all')}</Link>
          </div>

          {recent.length === 0 ? (
            <div className="home-empty">
              <span style={{ display: 'block', marginBottom: 16 }}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.29 6.29l1.28-1.28a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              </span>
              <p>{t('home.no_cases')}</p>
              <Link className="home-btn-primary" to="/report">{t('home.no_cases_btn')}</Link>
            </div>
          ) : (
            <div className="home-cards-grid">
              {recent.map(c => <CaseCard item={c} key={c.id} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="home-section home-features-section">
        <div className="home-section-inner">
          <div className="home-section-label">{t('home.features_label')}</div>
          <h2 className="home-section-title">{t('home.features_title')}</h2>
          <p className="home-section-sub">{t('home.features_sub')}</p>
          <div className="home-features-grid">
            {[
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, title: t('home.feat1_title'), desc: t('home.feat1_desc') },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>, title: t('home.feat2_title'), desc: t('home.feat2_desc') },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, title: t('home.feat3_title'), desc: t('home.feat3_desc') },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>, title: t('home.feat4_title'), desc: t('home.feat4_desc') },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>, title: t('home.feat5_title'), desc: t('home.feat5_desc') },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#27AE60" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>, title: t('home.feat6_title'), desc: t('home.feat6_desc') },
            ].map(f => (
              <div className="home-feature-card" key={f.title}>
                <div className="home-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── JOIN US ── */}
      <section className="home-join-section">
        <div className="home-section-inner">
          <div className="home-section-label">{t('home.join_label')}</div>
          <h2 className="home-section-title">{t('home.join_title')}</h2>
          <p className="home-section-sub">{t('home.join_sub')}</p>
          <div className="home-join-cards">
            <div className="home-join-card">
              <div className="home-join-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
              <h3>{t('home.join_witness_title')}</h3>
              <p>{t('home.join_witness_desc')}</p>
              <Link className="home-btn-outline-white" to="/sighting">{t('home.join_witness_btn')}</Link>
            </div>
            <div className="home-join-card home-join-card-featured">
              <div className="home-join-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <h3>{t('home.join_report_title')}</h3>
              <p>{t('home.join_report_desc')}</p>
              <Link className="home-btn-primary" to="/report">{t('home.join_report_btn')}</Link>
            </div>
            <div className="home-join-card">
              <div className="home-join-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <h3>{t('home.join_browse_title')}</h3>
              <p>{t('home.join_browse_desc')}</p>
              <Link className="home-btn-green" to="/cases">{t('home.join_browse_btn')}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <span className="home-footer-logo">
              <img src={logoGif} alt="Missing Diary" style={{ width: 280, height: 96, objectFit: 'contain', mixBlendMode: 'screen', filter: 'brightness(1.2)' }} />
            </span>
            <p>{t('home.footer_brand')}</p>
          </div>
          <div className="home-footer-links">
            <h4>{t('home.footer_links')}</h4>
            <Link to="/report">{t('home.report_missing_link')}</Link>
            <Link to="/sighting">{t('home.submit_sighting_link')}</Link>
            <Link to="/cases">{t('home.active_cases_link')}</Link>
          </div>
          <div className="home-footer-contact">
            <h4>{t('home.footer_emergency')}</h4>
            <p>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:4}}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.29 6.29l1.28-1.28a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              {t('home.footer_helpline')}: <strong>999</strong>
            </p>
            <p>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:4}}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              support@missingdiary.com
            </p>
          </div>
        </div>
        <div className="home-footer-bottom">
          <p>{t('home.footer_copyright')}</p>
        </div>
      </footer>
    </div>
  );
}
