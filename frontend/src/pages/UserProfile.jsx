import { useState } from 'react';
import Navbar from '../components/Navbar';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function UserProfile() {
  const { user, refreshUser } = useAuth();
  const canChangePassword = user?.role !== 'admin' && user?.role !== 'police';
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    current_password: '',
    new_password: ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function setField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    setMessage('');
    setError('');
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
      };
      if (canChangePassword && form.new_password) {
        payload.current_password = form.current_password;
        payload.new_password = form.new_password;
      }
      const { data } = await api.patch('/auth/profile', payload);
      await refreshUser?.();
      setForm(prev => ({
        ...prev,
        name: data.user.name || '',
        email: data.user.email || '',
        phone: data.user.phone || '',
        current_password: '',
        new_password: ''
      }));
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="profile-page">
        <section className="profile-card">
          <div className="profile-header">
            <div className="profile-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
            <div>
              <h1>User Profile</h1>
              <p>Manage your account details and password.</p>
            </div>
          </div>

          <div className="profile-meta-grid">
            <div><span>Role</span><b>{user?.role}</b></div>
            <div><span>Verified</span><b>{user?.verified ? 'Yes' : 'No'}</b></div>
          </div>

          {message && <div className="auth-redirect-notice">{message}</div>}
          {error && <div className="auth-error-box">{error}</div>}

          <form className="profile-form" onSubmit={submit}>
            <div className="auth-form-row">
              <div className="auth-field">
                <label>Name</label>
                <input value={form.name} onChange={e => setField('name', e.target.value)} required />
              </div>
              <div className="auth-field">
                <label>Phone</label>
                <input value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="+880 1XXX-XXXXXX" />
              </div>
            </div>

            <div className="auth-field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setField('email', e.target.value)} required />
            </div>

            {canChangePassword && (
              <div className="profile-password-box">
                <h2>Change Password</h2>
                <p>Leave these fields empty if you do not want to change your password. If you used forgot password, use the emailed temporary password as your current password.</p>
                <div className="auth-form-row">
                  <div className="auth-field">
                    <label>Current Password</label>
                    <input
                      type="password"
                      value={form.current_password}
                      onChange={e => setField('current_password', e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="auth-field">
                    <label>New Password</label>
                    <input
                      type="password"
                      value={form.new_password}
                      onChange={e => setField('new_password', e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>
            )}

            <button className="btn" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
