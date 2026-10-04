import { useAuth } from '../context/AuthContext';
import AiInvestmentDecisionModel from '../components/ai-investment-decision-model';

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back, {user?.name}.</p>
      </div>
      <div className="card">
        <p className="text-muted">
          <AiInvestmentDecisionModel />
        </p>
        {user?.role === 'admin' && (
          <div className="alert alert-info" style={{ marginTop: 20 }}>
            You're an admin. Use the <strong>Invites</strong> tab to add new users to the platform.
          </div>
        )}
      </div>
    </div>
  );
}
