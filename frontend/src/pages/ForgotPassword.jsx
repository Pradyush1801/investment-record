import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await api.forgotPassword(email).catch(() => {});
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">di·</div>
        <div className="auth-subtitle">Decision Intelligence Platform</div>
        <h2 className="auth-title">Reset password</h2>

        {sent ? (
          <>
            <div className="alert alert-success">
              If an account exists for <strong>{email}</strong>, a reset link has been sent. Check your inbox.
            </div>
            <div className="text-center mt-4">
              <Link to="/login" className="text-muted">← Back to sign in</Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted" style={{ marginBottom: 20 }}>Enter your email and we'll send you a reset link.</p>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email address</label>
                <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
              </div>
              <button className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <div className="text-center mt-4">
              <Link to="/login" className="text-muted" style={{ fontSize: '.875rem' }}>← Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
