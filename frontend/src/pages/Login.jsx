import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { api } from '../api/client';
import logoGif from '../assets/output-onlinegiftools.gif';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const { login } = useAuth();
  const { lang, setLang, t } = useLang();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/dashboard';

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      // Role-based redirect: police → /police, others → redirect param or /dashboard
      if (loggedInUser.role === 'police') {
        nav('/police');
      } else {
        nav(redirect === '/dashboard' ? '/dashboard' : redirect);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  async function submitForgot(e) {
    e.preventDefault();
    const targetEmail = (forgotEmail || email).trim();
    if (!targetEmail) {
      setForgotMessage(t('login.forgot_need_email'));
      return;
    }
    setForgotEmail(targetEmail);
    setForgotMessage(t('login.forgot_sending'));
    try {
      const { data } = await api.post('/auth/forgot-password', { email: targetEmail });
      setForgotMessage(data?.message || t('login.forgot_done'));
    } catch (err) {
      setForgotMessage(err.response?.data?.message || t('login.forgot_failed'));
    }
  }

  return (
    <div className="auth-page">
      {/* Left Panel */}
      <div className="auth-left">
        <div className="auth-left-inner">
          <Link to="/" className="auth-logo">
            <img src={logoGif} alt="Missing Diary" className="auth-logo-img" />
          </Link>
          <div className="auth-left-body">
            <h2>{t('login.left_title')}</h2>
            <p>{t('login.left_sub')}</p>
            <div className="auth-left-stats">
              <div className="auth-left-stat">
                <span className="auth-stat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </span>
                <div>
                  <b>{t('login.stat1_title')}</b>
                  <p>{t('login.stat1_desc')}</p>
                </div>
              </div>
              <div className="auth-left-stat">
                <span className="auth-stat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <div>
                  <b>{t('login.stat2_title')}</b>
                  <p>{t('login.stat2_desc')}</p>
                </div>
              </div>
              <div className="auth-left-stat">
                <span className="auth-stat-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </span>
                <div>
                  <b>{t('login.stat3_title')}</b>
                  <p>{t('login.stat3_desc')}</p>
                </div>
              </div>
            </div>
          </div>
          <p className="auth-left-footer">{t('login.footer')}</p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right">
        <div className="auth-form-card">
          <div className="auth-top-actions">
            <button
              type="button"
              className="auth-lang-toggle"
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
              aria-label="Toggle language"
            >
              {lang === 'en' ? 'বাংলা' : 'EN'}
            </button>
          </div>
          <div className="auth-form-header">
            <div className="auth-form-icon-svg">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <h1>{t('login.title')}</h1>
            <p>{t('login.sub')}</p>
          </div>

          {/* Notice below welcome */}
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 13,
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {t('login.notice')}
          </div>

          {redirect !== '/dashboard' && (
            <div className="auth-redirect-notice">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6,verticalAlign:'middle'}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Login required to access <strong>{redirect}</strong>
            </div>
          )}

          {error && (
            <div className="auth-error-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6,verticalAlign:'middle'}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={submit} className="auth-form">
            <div className="auth-field">
              <label>{t('login.email')}</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field">
              <label>{t('login.password')}</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="auth-pass-toggle"
                  onClick={() => setShowPass(s => !s)}
                  tabIndex={-1}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : null}
              {loading ? t('login.signing_in') : t('login.submit')}
            </button>

            <div className="auth-login-options">
              <label className="auth-remember-me">
                <input type="checkbox" defaultChecked readOnly />
                <span>{t('login.remember')}</span>
              </label>
              <button
                type="button"
                className="auth-link-btn auth-forgot-trigger"
                onClick={() => {
                  setForgotOpen(open => !open);
                  setForgotMessage('');
                  setForgotEmail(email);
                }}
              >
                {t('login.forgot')}
              </button>
            </div>

            {forgotOpen && (
              <div className="auth-forgot-box">
                <b>{t('login.forgot_title')}</b>
                <p>{t('login.forgot_sub')}</p>
                <div className="auth-forgot-row">
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => {
                      setForgotEmail(e.target.value);
                      setForgotMessage('');
                    }}
                    placeholder={t('login.email')}
                  />
                  <button type="button" className="db-mini-btn verify" onClick={submitForgot}>
                    {t('login.forgot_send')}
                  </button>
                </div>
                {forgotMessage && <p className="auth-forgot-message">{forgotMessage}</p>}
              </div>
            )}

          </form>

          <div className="auth-divider"><span>{t('login.or')}</span></div>

          <p className="auth-switch">
            {t('login.no_account_text')} <Link to="/register">{t('login.signup')}</Link>
          </p>

          <p className="auth-switch" style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
            {t('login.admin_note')}
          </p>

        </div>
      </div>
    </div>
  );
}
