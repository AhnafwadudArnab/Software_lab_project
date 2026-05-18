import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import logoGif from '../assets/output-onlinegiftools.gif';
import { getAll as getOfflineQueue } from '../utils/offlineQueue';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const [reportOpen, setReportOpen] = useState(false);
  const [queueCount, setQueueCount] = useState(getOfflineQueue().length);
  const dropRef = useRef(null);
  const nav = useNavigate();
  const location = useLocation();

  const isAdmin = user?.role === 'admin' || user?.role === 'police';

  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setReportOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    function handleQueueUpdate() { setQueueCount(getOfflineQueue().length); }
    window.addEventListener('offlineQueueUpdated', handleQueueUpdate);
    window.addEventListener('storage', handleQueueUpdate);
    return () => {
      window.removeEventListener('offlineQueueUpdated', handleQueueUpdate);
      window.removeEventListener('storage', handleQueueUpdate);
    };
  }, []);

  function handleReportClick(path) {
    setReportOpen(false);
    nav(path);
  }

  const isActive = (path) => location.pathname === path;

  return (
    <header className="navbar">
      <Link to="/" className="brand">
        <div className="brand-logo">
          <img src={logoGif} alt="Missing Diary" className="brand-gif" />
        </div>
      </Link>

      <nav>
        {/* ── CENTER: public nav links (guardian/guest only) ── */}
        {!isAdmin && (
          <div className="nav-center">
            <Link to="/" style={isActive('/') ? { color: 'var(--text)' } : {}}>{t('nav.home')}</Link>
            <Link to="/cases" style={isActive('/cases') ? { color: 'var(--text)' } : {}}>{t('nav.cases')}</Link>
            <Link to="/sightings" style={isActive('/sightings') ? { color: 'var(--text)' } : {}}>{t('nav.sightings')}</Link>

            <div className="nav-dropdown" ref={dropRef}>
              <button
                className="btn small danger"
                onClick={() => setReportOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                {t('nav.report')}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {reportOpen && (
                <div className="nav-dropdown-menu">
                  <div className="nav-dropdown-item" onClick={() => handleReportClick('/report')}>
                    <span className="nav-dropdown-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                    </span>
                    <div>
                      <b>{t('nav.report_missing')}</b>
                      <p>Submit a new missing person case</p>
                    </div>
                  </div>
                  <div className="nav-dropdown-item" onClick={() => handleReportClick('/sighting')}>
                    <span className="nav-dropdown-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </span>
                    <div>
                      <b>{t('nav.submit_sighting')}</b>
                      <p>I saw someone who may be missing</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RIGHT: auth + lang controls ── */}
        <div className="nav-right">
          {isAdmin && (
            <Link to="/" style={isActive('/') ? { color: 'var(--text)' } : {}}>{t('nav.home')}</Link>
          )}

          {user ? (
            <>
              <Link
                to={user.role === 'police' ? '/police' : '/dashboard'}
                style={isActive('/dashboard') || isActive('/police') ? { color: 'var(--text)' } : {}}
              >
                {t('nav.dashboard')}
              </Link>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{user.name}</span>
              <button className="btn small outline" onClick={logout}>{t('nav.logout')}</button>
            </>
          ) : (
            <Link className="btn small" to="/login" style={{ background: 'var(--green)' }}>
              {t('nav.login')}
            </Link>
          )}

          <button
            className="btn small outline"
            onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
            style={{ minWidth: 48 }}
            aria-label="Toggle language"
          >
            {lang === 'en' ? 'বাং' : 'EN'}
          </button>

          {queueCount > 0 && (
            <span
              title={`${queueCount} report${queueCount !== 1 ? 's' : ''} pending submission`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#f59e0b', color: '#fff', borderRadius: 20,
                padding: '3px 10px', fontSize: 12, fontWeight: 700,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {queueCount}
            </span>
          )}
        </div>
      </nav>
    </header>
  );
}
