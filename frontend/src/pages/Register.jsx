import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { login } = useAuth();

  const [inviteData, setInviteData] = useState(null);  // { email, role }
  const [tokenError, setTokenError] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!token) {
      setTokenError('No invite token found. Please use the invite link from your email.');
      setChecking(false);
      return;
    }
    api.validateInvite(token)
      .then(data => setInviteData(data))
      .catch(err => setTokenError(err.message))
      .finally(() => setChecking(false));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const { token: jwt, user } = await api.register(token, name, password);
      login(jwt, user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="auth-page">
        <div className="auth-card text-center">
          <p className="text-muted">Validating your invite…</p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">di·</div>
          <div className="alert alert-error" style={{ marginTop: 16 }}>{tokenError}</div>
          <div className="text-center mt-4">
            <Link to="/login" className="text-muted">← Back to sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">di·</div>
        <div className="auth-subtitle">Decision Intelligence Platform</div>
        <h2 className="auth-title">Create your account</h2>

        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          You've been invited as <strong>{inviteData.email}</strong> with role <strong>{inviteData.role}</strong>.
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input className="form-input" type="email" value={inviteData.email} disabled style={{ background: '#f9fafb', color: 'var(--muted)' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Your full name</label>
            <input className="form-input" type="text" value={name} onChange={e => setName(e.target.value)} required autoFocus placeholder="Jane Smith" />
          </div>
          <div className="form-group">
            <label className="form-label">Password <span className="text-muted">(min. 8 characters)</span></label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm password</label>
            <input className="form-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          <button className="btn btn-gold btn-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="text-center mt-4">
          <Link to="/login" className="text-muted" style={{ fontSize: '.875rem' }}>Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  );
}
