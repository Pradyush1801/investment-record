import { query, queryOne } from './db.js';

// Scoring model — mirrors frontend/src/components/ai-investment-decision-model.jsx.
// Composite and verdict are recomputed here so the stored ledger can't be spoofed by the client.
const ORGS = ['cto', 'cio', 'cpo'];
const TIER_RISK = { 1: 5, 2: 4, 3: 2, 4: 1 };
const WEIGHTS = { value: 0.25, fit: 0.20, risk: 0.20, cost: 0.15, reversibility: 0.10, adoption: 0.10 };

function costScoreFor(monthlyCost, orgBudget) {
  const ratio = orgBudget > 0 ? monthlyCost / orgBudget : 0;
  if (ratio <= 0.02) return 5;
  if (ratio <= 0.05) return 4;
  if (ratio <= 0.10) return 3;
  if (ratio <= 0.18) return 2;
  return 1;
}

function verdictFor(score, valueScore, adoptionScore) {
  let verdict;
  if (score >= 80) verdict = 'INVEST';
  else if (score >= 60) verdict = 'PILOT';
  else if (score >= 40) verdict = 'HOLD';
  else verdict = 'DECLINE';

  // Gates: no value metric → never advance; no adoption plan → never full rollout.
  if (valueScore <= 1 && verdict !== 'DECLINE') return 'HOLD';
  if (adoptionScore <= 1 && verdict === 'INVEST') return 'PILOT';
  return verdict;
}

const isScore = (n) => Number.isInteger(n) && n >= 1 && n <= 5;

const DECISION_COLS = `
  id as "_id", name, org, tier,
  monthly_cost::float8 as "monthlyCost", org_budget::float8 as "orgBudget",
  scores, composite, verdict, created_by as "createdBy",
  created_at as "createdAt", updated_at as "updatedAt"`;

export function registerDecisionRoutes(app, { requireAuth, isUuid }) {
  // GET /api/decisions — newest first
  app.get('/api/decisions', requireAuth, async (_req, res) => {
    const decisions = await query(`select ${DECISION_COLS} from decisions order by created_at desc`);
    res.json(decisions);
  });

  // POST /api/decisions — log a decision
  app.post('/api/decisions', requireAuth, async (req, res) => {
    const { name, org, tier, monthlyCost, orgBudget, scores = {} } = req.body;
    const { value, fit, reversibility, adoption } = scores;

    if (!name?.trim()) return res.status(400).json({ error: 'Request name required' });
    if (!ORGS.includes(org)) return res.status(400).json({ error: 'Invalid org' });
    if (!TIER_RISK[tier]) return res.status(400).json({ error: 'Invalid tier' });
    if (!(Number(monthlyCost) >= 0) || !(Number(orgBudget) >= 0)) {
      return res.status(400).json({ error: 'Monthly cost and org budget must be non-negative numbers' });
    }
    if (![value, fit, reversibility, adoption].every(isScore)) {
      return res.status(400).json({ error: 'Scores must be integers from 1 to 5' });
    }

    const raw =
      value * WEIGHTS.value +
      fit * WEIGHTS.fit +
      TIER_RISK[tier] * WEIGHTS.risk +
      costScoreFor(Number(monthlyCost), Number(orgBudget)) * WEIGHTS.cost +
      reversibility * WEIGHTS.reversibility +
      adoption * WEIGHTS.adoption;
    const score = (raw / 5) * 100;

    const decision = await queryOne(
      `insert into decisions (name, org, tier, monthly_cost, org_budget, scores, composite, verdict, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning ${DECISION_COLS}`,
      [
        name.trim(), org, tier, Number(monthlyCost), Number(orgBudget),
        { value, fit, reversibility, adoption },
        Math.round(score), verdictFor(score, value, adoption),
        isUuid(req.user.id) ? req.user.id : null,
      ]
    );
    res.status(201).json(decision);
  });

  // DELETE /api/decisions/:id
  app.delete('/api/decisions/:id', requireAuth, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(404).json({ error: 'Decision not found' });
    const deleted = await queryOne(`delete from decisions where id = $1 returning id`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Decision not found' });
    res.json({ message: 'Decision deleted' });
  });
}
