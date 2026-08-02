import { useState, useEffect } from 'react';
import { api } from '../api';

function InviteModal({ onClose, onSent }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const data = await api.sendInvite(email, role);
      setResult(data.invite);
      onSent();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(result.inviteLink);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {!result ? (
          <>
            <h3 className="modal-title">Send invite</h3>
            <p className="modal-subtitle">The user will receive an email with a registration link valid for 72 hours.</p>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email address</label>
                <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus placeholder="colleague@company.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-2 mt-4">
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h3 className="modal-title">Invite sent ✓</h3>
            <p className="modal-subtitle">An email has been sent to <strong>{result.email}</strong>. You can also copy the link below.</p>
            <div className="alert alert-success">Invite link created and email dispatched.</div>
            <label className="form-label">Invite link</label>
            <div className="copy-box">
              <input className="copy-input" readOnly value={result.inviteLink} onClick={e => e.target.select()} />
              <button className="btn btn-ghost btn-sm" onClick={copyLink}>Copy</button>
            </div>
            <div className="mt-4">
              <button className="btn btn-primary btn-full" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Invites() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    try {
      const { invites } = await api.getInvites();
      setInvites(invites);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function revoke(id) {
    if (!confirm('Revoke this invite?')) return;
    await api.revokeInvite(id);
    load();
  }

  function getStatus(inv) {
    if (inv.usedAt) return { label: 'Used', cls: 'badge-used' };
    if (new Date(inv.expiresAt) < new Date()) return { label: 'Expired', cls: 'badge-expired' };
    return { label: 'Pending', cls: 'badge-pending' };
  }

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Invitations</h1>
          <p className="page-subtitle">Send invite links to new users. They register themselves using the link.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Send invite</button>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-muted text-center" style={{ padding: 32 }}>Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-muted text-center" style={{ padding: 32 }}>No invites sent yet. Click "Send invite" to get started.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Invited by</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invites.map(inv => {
                  const status = getStatus(inv);
                  const isPending = status.label === 'Pending';
                  return (
                    <tr key={inv._id}>
                      <td style={{ fontWeight: 500 }}>{inv.email}</td>
                      <td><span className={`badge badge-${inv.role}`}>{inv.role}</span></td>
                      <td className="text-muted">{inv.invitedBy?.name || '—'}</td>
                      <td className="text-muted" style={{ fontSize: '.82rem' }}>
                        {new Date(inv.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                      <td>
                        {isPending && (
                          <button className="btn btn-danger btn-sm" onClick={() => revoke(inv._id)}>Revoke</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <InviteModal
          onClose={() => setShowModal(false)}
          onSent={load}
        />
      )}
    </div>
  );
}
