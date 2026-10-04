import { useState, useMemo, useEffect } from "react";

// ============ design tokens ============
const C = {
  paper: "#F7F5F0",
  panel: "#FFFFFF",
  ink: "#14181F",
  inkSoft: "#454C58",
  inkFaint: "#8A8F99",
  line: "#E2DFD6",
  invest: "#2F6F4E",
  investSoft: "#DCEAE2",
  pilot: "#B8762F",
  pilotSoft: "#F3E4D2",
  hold: "#8A8460",
  holdSoft: "#EDE9DC",
  decline: "#9B3F2E",
  declineSoft: "#F1DCD5",
};
const SERIF = "Source Serif Pro, Georgia, serif";
const SANS = "system-ui, -apple-system, sans-serif";

// ============ scoring model ============
const ORGS = [
  { id: "cto", label: "CTO — Product Engineering", mandate: "Engineering velocity, code quality, delivery speed" },
  { id: "cio", label: "CIO — IT / SRE / Architecture", mandate: "Reliability, security, infrastructure efficiency" },
  { id: "cpo", label: "CPO — Product, PM, Scrum", mandate: "Product outcomes, customer value, roadmap throughput" },
];

const TIERS = [
  { id: 1, label: "Minimal", desc: "Internal drafting, individual productivity", riskScore: 5 },
  { id: 2, label: "Moderate", desc: "Customer-facing content, internal data analysis", riskScore: 4 },
  { id: 3, label: "High", desc: "Regulated data, automated decisions", riskScore: 2 },
  { id: 4, label: "Critical", desc: "Autonomous agents, financial/legal actions", riskScore: 1 },
];

const WEIGHTS = { value: 0.25, fit: 0.20, risk: 0.20, cost: 0.15, reversibility: 0.10, adoption: 0.10 };

function scoreToVerdict(score, valueScore, adoptionScore) {
  let verdict;
  if (score >= 80) verdict = { label: "INVEST", color: C.invest, soft: C.investSoft, sub: "Fund full rollout" };
  else if (score >= 60) verdict = { label: "PILOT", color: C.pilot, soft: C.pilotSoft, sub: "Scoped trial, defined checkpoint" };
  else if (score >= 40) verdict = { label: "HOLD", color: C.hold, soft: C.holdSoft, sub: "Needs more definition before funding" };
  else verdict = { label: "DECLINE", color: C.decline, soft: C.declineSoft, sub: "Does not clear the bar today" };

  // Gates: a cheap, low-risk request with no defined value or adoption plan should never
  // pass on cost/risk alone — that combination is exactly the invisible-spend pattern.
  if (valueScore !== undefined && valueScore <= 1 && verdict.label !== "DECLINE") {
    return { label: "HOLD", color: C.hold, soft: C.holdSoft, sub: "Gated: no value metric defined — define a measurable outcome before this can advance" };
  }
  if (adoptionScore !== undefined && adoptionScore <= 1 && verdict.label === "INVEST") {
    return { label: "PILOT", color: C.pilot, soft: C.pilotSoft, sub: "Gated: no adoption plan — prove usage in a pilot before full rollout" };
  }
  return verdict;
}

function ScoreSlider({ label, value, onChange, help, leftLabel, rightLabel }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: SANS }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.ink, fontFamily: SERIF }}>{value}/5</span>
      </div>
      <input
        type="range" min={1} max={5} step={1} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ width: "100%", height: 5, accentColor: C.ink, cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 10.5, color: C.inkFaint }}>{leftLabel}</span>
        <span style={{ fontSize: 10.5, color: C.inkFaint }}>{rightLabel}</span>
      </div>
      {help && <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 5, lineHeight: 1.4 }}>{help}</div>}
    </div>
  );
}

export default function GovernanceModel() {
  const [requestName, setRequestName] = useState("Copilot — engineering org-wide");
  const [org, setOrg] = useState("cto");
  const [tier, setTier] = useState(1);
  const [monthlyCost, setMonthlyCost] = useState(8000);
  const [orgBudget, setOrgBudget] = useState(150000);

  const [valueScore, setValueScore] = useState(3);
  const [fitScore, setFitScore] = useState(4);
  const [reversibilityScore, setReversibilityScore] = useState(4);
  const [adoptionScore, setAdoptionScore] = useState(3);

  const [ledger, setLedger] = useState([]);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Base URL of your API server. Set VITE_API_URL (Vite) or REACT_APP_API_URL
  // (CRA) in your frontend's .env — falling back to localhost for local dev.
  const API_BASE =
    (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
    (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_URL) ||
    "http://localhost:4000";

  // The decision routes require login — send the JWT stored by AuthContext.
  const authHeaders = () => {
    const token = localStorage.getItem("di_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Load persisted ledger from the API on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/decisions`, { headers: authHeaders() });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        setLedger(data);
      } catch (e) {
        setSaveError(`Couldn't load saved decisions (${e.message}). Check the API server is running.`);
      } finally {
        setLedgerLoaded(true);
      }
    })();
  }, [API_BASE]);

  const tierObj = TIERS.find((t) => t.id === tier);
  const riskScore = tierObj.riskScore;

  const costRatio = orgBudget > 0 ? monthlyCost / orgBudget : 0;
  const costScore = useMemo(() => {
    if (costRatio <= 0.02) return 5;
    if (costRatio <= 0.05) return 4;
    if (costRatio <= 0.10) return 3;
    if (costRatio <= 0.18) return 2;
    return 1;
  }, [costRatio]);

  const composite = useMemo(() => {
    const raw =
      valueScore * WEIGHTS.value +
      fitScore * WEIGHTS.fit +
      riskScore * WEIGHTS.risk +
      costScore * WEIGHTS.cost +
      reversibilityScore * WEIGHTS.reversibility +
      adoptionScore * WEIGHTS.adoption;
    return (raw / 5) * 100;
  }, [valueScore, fitScore, riskScore, costScore, reversibilityScore, adoptionScore]);

  const verdict = scoreToVerdict(composite, valueScore, adoptionScore);

  const breakdown = [
    { label: "Value Clarity", score: valueScore, weight: WEIGHTS.value },
    { label: "Org Mandate Fit", score: fitScore, weight: WEIGHTS.fit },
    { label: "Risk Tier", score: riskScore, weight: WEIGHTS.risk },
    { label: "Cost Proportionality", score: costScore, weight: WEIGHTS.cost },
    { label: "Reversibility", score: reversibilityScore, weight: WEIGHTS.reversibility },
    { label: "Adoption Readiness", score: adoptionScore, weight: WEIGHTS.adoption },
  ];

  // Note: the API recomputes composite + verdict server-side from the raw
  // scores rather than trusting whatever we display locally — this call
  // sends the same six inputs the UI is already showing.
  async function logDecision() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${API_BASE}/api/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: requestName,
          org,
          tier,
          monthlyCost,
          orgBudget,
          scores: {
            value: valueScore,
            fit: fitScore,
            reversibility: reversibilityScore,
            adoption: adoptionScore,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }
      const created = await res.json();
      setLedger((prev) => [created, ...prev]);
    } catch (e) {
      setSaveError(`Couldn't save this decision (${e.message}).`);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteEntry(id) {
    setSaveError(null);
    try {
      const res = await fetch(`${API_BASE}/api/decisions/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }
      setLedger((prev) => prev.filter((row) => row._id !== id));
    } catch (e) {
      setSaveError(`Couldn't delete this entry (${e.message}).`);
    }
  }

  const orgObj = ORGS.find((o) => o.id === org);

  return (
    <div style={{ background: C.paper, minHeight: "100vh", padding: "36px 24px", fontFamily: SANS }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        {/* header */}
        <div style={{ marginBottom: 30, borderBottom: `2px solid ${C.ink}`, paddingBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.inkFaint, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
            Capital Allocation Instrument
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 700, color: C.ink, margin: 0 }}>
            AI Investment Decision Model
          </h1>
          <p style={{ fontSize: 13.5, color: C.inkSoft, marginTop: 6, maxWidth: 680, lineHeight: 1.5 }}>
            One scoring test, applied the same way whether the request comes from the CTO, CIO, or CPO. Score a request,
            see the verdict, log it to compare against everything else competing for budget this quarter.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 380px", gap: 22 }}>
          {/* ---- COLUMN 1: request intake ---- */}
          <div style={{ background: C.panel, borderRadius: 4, padding: 22, border: `1px solid ${C.line}` }}>
            <SectionLabel>1 — The request</SectionLabel>

            <Field label="Request name">
              <input
                value={requestName} onChange={(e) => setRequestName(e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field label="Requesting Org">
              <select value={org} onChange={(e) => setOrg(e.target.value)} style={inputStyle}>
                {ORGS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <div style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 6, fontStyle: "italic" }}>
                Mandate: {orgObj.mandate}
              </div>
            </Field>

            <Field label="Risk / Access Tier">
              <select value={tier} onChange={(e) => setTier(parseInt(e.target.value))} style={inputStyle}>
                {TIERS.map((t) => <option key={t.id} value={t.id}>{t.id} — {t.label}</option>)}
              </select>
              <div style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 6 }}>{tierObj.desc}</div>
            </Field>

            <Field label="Monthly Cost ($)">
              <input
                type="number" value={monthlyCost} onChange={(e) => setMonthlyCost(parseFloat(e.target.value) || 0)}
                style={inputStyle}
              />
            </Field>

            <Field label="Requesting Org's Monthly Budget ($)">
              <input
                type="number" value={orgBudget} onChange={(e) => setOrgBudget(parseFloat(e.target.value) || 0)}
                style={inputStyle}
              />
              <div style={{ fontSize: 11.5, color: C.inkFaint, marginTop: 6 }}>
                This request is {(costRatio * 100).toFixed(1)}% of that org's monthly budget.
              </div>
            </Field>
          </div>

          {/* ---- COLUMN 2: scoring ---- */}
          <div style={{ background: C.panel, borderRadius: 4, padding: 22, border: `1px solid ${C.line}` }}>
            <SectionLabel>2 — Score it</SectionLabel>

            <ScoreSlider
              label="Value Clarity"
              value={valueScore} onChange={setValueScore}
              leftLabel="No Metric Defined" rightLabel="Hard KPI Committed Pre-spend"
              help="Is there a measurable outcome (hours saved, MTTR, conversion, deal velocity) defined before money moves?"
            />
            <ScoreSlider
              label="Org Mandate Fit"
              value={fitScore} onChange={setFitScore}
              leftLabel="Generic / Unclear Fit" rightLabel="Directly Serves Org's Mandate"
              help="Does this match what this specific org is accountable for, or is it a nice-to-have?"
            />
            <ScoreSlider
              label="Reversibility"
              value={reversibilityScore} onChange={setReversibilityScore}
              leftLabel="Locked In, Hard To Exit" rightLabel="Cancel/Downgrade Anytime"
              help="If this doesn't pay back, how easily can you unwind it — contract terms, data lock-in, retraining cost?"
            />
            <ScoreSlider
              label="Adoption Readiness"
              value={adoptionScore} onChange={setAdoptionScore}
              leftLabel="No Plan, Likely Shelfware" rightLabel="Named Owner, Rollout plan, Training"
              help="Will people actually use this, or does it become a line item nobody touches in 90 days?"
            />

            <div style={{ marginTop: 18, padding: "12px 14px", background: C.paper, borderRadius: 6, fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>
              <strong style={{ color: C.ink }}>Risk tier</strong> and <strong style={{ color: C.ink }}>cost proportionality</strong> are
              scored automatically from your inputs on the left — risk tier 3-4 and high cost-to-budget ratios pull the
              composite down regardless of how well you score the other four.
            </div>
          </div>

          {/* ---- COLUMN 3: verdict ---- */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: C.ink, borderRadius: 4, padding: "26px 24px", textAlign: "center", position: "relative" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9098A6", letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
                Composite Score
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 56, fontWeight: 700, color: "#FFF", lineHeight: 1 }}>
                {composite.toFixed(0)}
              </div>
              <div style={{ fontSize: 12, color: "#7E8694", marginBottom: 18 }}>out of 100</div>

              <div
                style={{
                  display: "inline-block", padding: "10px 28px", border: `2.5px solid ${verdict.color}`,
                  borderRadius: 3, transform: "rotate(-2deg)",
                }}
              >
                <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 800, color: verdict.color, letterSpacing: 1.5 }}>
                  {verdict.label}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#B6BCC6", marginTop: 12 }}>{verdict.sub}</div>
            </div>

            <div style={{ background: C.panel, borderRadius: 4, padding: 18, border: `1px solid ${C.line}` }}>
              <SectionLabel small>Score breakdown</SectionLabel>
              {breakdown.map((b) => (
                <div key={b.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}>
                    <span style={{ color: C.inkSoft, fontWeight: 600 }}>{b.label}</span>
                    <span style={{ color: C.ink, fontWeight: 700 }}>{b.score}/5 · {(b.weight * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 6, background: C.paper, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(b.score / 5) * 100}%`, background: C.ink, opacity: 0.4 + b.weight * 1.5 }} />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={logDecision}
              disabled={!ledgerLoaded || isSaving}
              style={{
                background: ledgerLoaded && !isSaving ? C.ink : C.inkFaint, color: "#FFF", border: "none", borderRadius: 4, padding: "12px 0",
                fontSize: 13, fontWeight: 700, cursor: ledgerLoaded && !isSaving ? "pointer" : "not-allowed", letterSpacing: 0.5, textTransform: "uppercase",
                fontFamily: SANS,
              }}
            >
              {!ledgerLoaded ? "Loading ledger…" : isSaving ? "Saving…" : "Log this decision"}
            </button>
            {saveError && (
              <div style={{ fontSize: 11.5, color: C.decline, background: C.declineSoft, padding: "8px 10px", borderRadius: 4, lineHeight: 1.4 }}>
                {saveError}
              </div>
            )}
          </div>
        </div>

        {/* ---- LEDGER ---- */}
        {ledger.length > 0 && (
          <div style={{ marginTop: 28, background: C.panel, borderRadius: 4, padding: 22, border: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <SectionLabel>Decision ledger — this quarter</SectionLabel>
              <span style={{ fontSize: 11, color: C.inkFaint, fontStyle: "italic" }}>Stored in Supabase · shared with all signed-in users</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.ink}` }}>
                  {["Request", "Org", "Tier", "Monthly cost", "Score", "Verdict", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, color: C.inkFaint, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => {
                  const vMap = { INVEST: C.invest, PILOT: C.pilot, HOLD: C.hold, DECLINE: C.decline };
                  const vSoftMap = { INVEST: C.investSoft, PILOT: C.pilotSoft, HOLD: C.holdSoft, DECLINE: C.declineSoft };
                  return (
                    <tr key={row._id} style={{ borderBottom: `1px solid ${C.line}` }}>
                      <td style={{ padding: "10px", fontSize: 13, color: C.ink, fontWeight: 600 }}>{row.name}</td>
                      <td style={{ padding: "10px", fontSize: 13, color: C.inkSoft }}>{ORGS.find((o) => o.id === row.org)?.label.split(" — ")[0]}</td>
                      <td style={{ padding: "10px", fontSize: 13, color: C.inkSoft }}>{row.tier}</td>
                      <td style={{ padding: "10px", fontSize: 13, color: C.inkSoft }}>${row.monthlyCost.toLocaleString()}/mo</td>
                      <td style={{ padding: "10px", fontSize: 13, fontWeight: 700, color: C.ink, fontFamily: SERIF }}>{row.composite}</td>
                      <td style={{ padding: "10px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: vMap[row.verdict], background: vSoftMap[row.verdict], padding: "3px 10px", borderRadius: 3 }}>
                          {row.verdict}
                        </span>
                      </td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        <button
                          onClick={() => deleteEntry(row._id)}
                          title="Remove this entry"
                          style={{
                            background: "none", border: "none", color: C.inkFaint, cursor: "pointer",
                            fontSize: 13, fontWeight: 700, padding: "2px 6px",
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ fontSize: 11, color: C.inkFaint, lineHeight: 1.6, marginTop: 20, maxWidth: 900 }}>
          This model scores relative comparability, not absolute truth — the weights (25/20/20/15/10/10) and verdict
          bands (80/60/40) are starting defaults for you to calibrate against a handful of decisions you've already made
          and felt good or bad about. Once they reproduce your own judgment on 5-6 known cases, trust it on new ones.
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children, small }) {
  return (
    <div style={{ fontSize: small ? 11 : 12, fontWeight: 700, color: C.ink, textTransform: "uppercase", letterSpacing: 1, marginBottom: small ? 10 : 16 }}>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.ink, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "9px 11px", fontSize: 13.5, border: `1.5px solid #D8D4C8`,
  borderRadius: 4, fontFamily: SANS, color: C.ink, background: "#FFF", boxSizing: "border-box",
};