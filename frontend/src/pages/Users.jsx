import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { users } = await api.getUsers();
      setUsers(users);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(u) {
    await api.updateUser(u._id, { isActive: !u.isActive });
    load();
  }

  async function changeRole(u, role) {
    if (u._id === me.id) { alert("You can't change your own role."); return; }
    await api.updateUser(u._id, { role });
    load();
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Users</h1>
        <p className="page-subtitle">All registered users. Use the Invites page to add new users.</p>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-muted text-center" style={{ padding: 32 }}>Loading…</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 500 }}>{u.name} {u._id === me.id && <span className="text-muted">(you)</span>}</td>
                    <td className="text-muted">{u.email}</td>
                    <td>
                      <select
                        className="form-select"
                        style={{ width: 'auto', padding: '4px 8px', fontSize: '.82rem' }}
                        value={u.role}
                        onChange={e => changeRole(u, e.target.value)}
                        disabled={u._id === me.id}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-active' : 'badge-inactive'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-muted" style={{ fontSize: '.82rem' }}>
                      {new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      {u._id !== me.id && (
                        <button
                          className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-ghost'}`}
                          onClick={() => toggleActive(u)}
                        >
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
