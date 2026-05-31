import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../api/client';

export default function CctvEvidenceUpload() {
  const { token } = useParams();
  const [request, setRequest] = useState(null);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ uploaded_by_name: '', uploaded_by_contact: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get(`/admin/cctv-evidence/upload/${token}`)
      .then(r => setRequest(r.data))
      .catch(err => setError(err.response?.data?.message || 'Evidence upload request could not be loaded.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function submitEvidence(e) {
    e.preventDefault();
    if (!file) {
      setError('Please attach the CCTV image or video file.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('uploaded_by_name', form.uploaded_by_name);
      fd.append('uploaded_by_contact', form.uploaded_by_contact);
      fd.append('notes', form.notes);
      fd.append('evidence', file);
      await api.post(`/admin/cctv-evidence/upload/${token}`, fd);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload CCTV evidence.');
    }
    setSaving(false);
  }

  return (
    <>
      <Navbar />
      <main className="cctv-upload-page">
        <section className="cctv-upload-panel">
          {loading && <p className="muted">Loading secure request...</p>}
          {!loading && error && !request && <div className="rc-error">{error}</div>}
          {request && !success && (
            <>
              <div className="cctv-upload-header">
                <h1>CCTV Evidence Upload</h1>
                <p>Submit footage only if you are the verified CCTV owner or authorized authority for this camera.</p>
              </div>
              <div className="cctv-upload-summary">
                <div><span>Case</span><b>{request.case_name} ({request.case_id})</b></div>
                <div><span>Camera</span><b>{request.camera_name}</b></div>
                <div><span>Location</span><b>{request.city}{request.area ? `, ${request.area}` : ''}</b></div>
              </div>
              {request.request_message && <p className="cctv-notes">{request.request_message}</p>}

              <form className="cctv-upload-form" onSubmit={submitEvidence}>
                <label>
                  Your Name / Authority
                  <input required value={form.uploaded_by_name} onChange={e => setForm(f => ({ ...f, uploaded_by_name: e.target.value }))} />
                </label>
                <label>
                  Contact
                  <input required value={form.uploaded_by_contact} onChange={e => setForm(f => ({ ...f, uploaded_by_contact: e.target.value }))} />
                </label>
                <label>
                  CCTV Image or Video
                  <input required type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" onChange={e => setFile(e.target.files?.[0] || null)} />
                </label>
                <label>
                  Notes
                  <textarea rows="4" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </label>
                {error && <div className="rc-error">{error}</div>}
                <button className="rc-btn-submit" disabled={saving}>
                  {saving ? 'Uploading...' : 'Submit Evidence'}
                </button>
              </form>
            </>
          )}
          {success && (
            <div className="cctv-upload-success">
              <h1>Evidence Submitted</h1>
              <p>Thank you. The Missing Diary team can now review the uploaded CCTV evidence for this case.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
