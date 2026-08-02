import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) setError('Invalid reset link. Please request a new one.');
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">di·</div>
        <div className="auth-subtitle">Decision Intelligence Platform</div>
        <h2 className="auth-title">Set new password</h2>

        {success ? (
          <div className="alert alert-success">
            Password updated! Redirecting you to sign in…
          </div>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}
            {!error || token ? (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">New password <span className="text-muted">(min. 8 characters)</span></label>
                  <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm new password</label>
                  <input className="form-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
                </div>
                <button className="btn btn-primary btn-full" disabled={loading || !token}>
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            ) : null}
          </>
        )}

        <div className="text-center mt-4">
          <Link to="/login" className="text-muted" style={{ fontSize: '.875rem' }}>← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
