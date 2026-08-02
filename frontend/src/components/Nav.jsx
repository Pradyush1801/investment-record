import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!user) return null;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const link = (to, label) => (
    <a key={to} href={to} className={`nav-link${pathname === to ? ' active' : ''}`}
      onClick={e => { e.preventDefault(); navigate(to); }}>
      {label}
    </a>
  );

  return (
    <nav className="nav">
      <span className="nav-logo">di·</span>
      <div className="nav-links">
        {link('/dashboard', 'Dashboard')}
        {user.role === 'admin' && link('/users', 'Users')}
        {user.role === 'admin' && link('/invites', 'Invites')}
      </div>
      <div className="nav-user">
        <span>Hello, <strong>{user.name}</strong></span>
        <span className={`badge badge-${user.role}`}>{user.role}</span>
        <button className="btn-logout" onClick={handleLogout}>Sign out</button>
      </div>
    </nav>
  );
}
