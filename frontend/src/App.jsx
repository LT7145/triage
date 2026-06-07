import React, { useState, useEffect, useMemo } from "react";
import { Inbox, AlertTriangle, CheckCircle2, Sparkles, Zap, ChevronRight, X, Send, RefreshCw, BarChart3, LogOut } from "lucide-react";

const API_BASE = "http://localhost:4000";
const PRIORITY = {
  urgent: { label: "Urgent", bg: "#fdecec", fg: "#a32d2d", dot: "#e24b4a" },
  high:   { label: "High",   bg: "#faeeda", fg: "#854f0b", dot: "#ba7517" },
  medium: { label: "Medium", bg: "#e6f1fb", fg: "#185fa5", dot: "#378add" },
  low:    { label: "Low",    bg: "#eaf3de", fg: "#3b6d11", dot: "#639922" },
};
const SENTIMENT = { angry: "😡", frustrated: "😟", neutral: "😐", positive: "🙂" };
const TEAM = { billing: "Billing", engineering: "Engineering", success: "Success", product: "Product", support: "Support" };

function api(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  return {
    get: (p) => fetch(API_BASE + p, { headers }).then(r => r.json()),
    post: (p, body) => fetch(API_BASE + p, { method: "POST", headers, body: body ? JSON.stringify(body) : undefined })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Request failed"); return d; }),
  };
}

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  if (!token) return <Login onAuth={(t, u) => { setToken(t); setUser(u); }} />;
  return <Dashboard token={token} user={user} onLogout={() => { setToken(null); setUser(null); }} />;
}

function Login({ onAuth }) {
  const [email, setEmail] = useState("demo@acme.com");
  const [password, setPassword] = useState("demo1234");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setErr("");
    try { const d = await api().post("/api/auth/login", { email, password }); onAuth(d.token, d.user); }
    catch { setErr("Login failed, or backend not reachable at " + API_BASE); }
    finally { setBusy(false); }
  }
  const inp = { width: "100%", padding: "10px 12px", border: "1px solid #e2e0d9", borderRadius: 8, fontSize: 14, marginBottom: 16, outline: "none", boxSizing: "border-box" };
  const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: "#56524a", marginBottom: 6 };
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f7f6f3", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 360, background: "#fff", border: "1px solid #e8e6e0", borderRadius: 14, padding: "32px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1c1b19", display: "flex", alignItems: "center", justifyContent: "center" }}><Zap size={18} color="#fff" fill="#fff" /></div>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4, color: "#1c1b19" }}>Triage</span>
        </div>
        <label style={lbl}>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} style={inp} />
        <label style={lbl}>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={inp} />
        {err && <div style={{ color: "#a32d2d", fontSize: 12.5, marginBottom: 12 }}>{err}</div>}
        <button onClick={submit} disabled={busy} style={{ width: "100%", background: "#1c1b19", color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {busy ? <RefreshCw size={15} className="spin" /> : null} Sign in
        </button>
        <div style={{ fontSize: 12, color: "#a39e92", textAlign: "center", marginTop: 14 }}>Demo: demo@acme.com / demo1234</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}`}</style>
    </div>
  );
}

function Dashboard({ token, user, onLogout }) {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState({});
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const client = useMemo(() => api(token), [token]);
  async function load() { setLoading(true); const d = await client.get("/api/tickets"); setTickets(Array.isArray(d) ? d : []); setLoading(false); }
  useEffect(() => { load(); }, []);
  const stats = useMemo(() => ({
    open: tickets.filter(t => t.status === "open").length,
    urgent: tickets.filter(t => t.priority === "urgent").length,
    triaged: tickets.filter(t => t.triaged).length,
    total: tickets.length,
  }), [tickets]);
  const visible = tickets.filter(t => filter === "all" ? true : filter === "untriaged" ? !t.triaged : t.priority === filter);
  async function runTriage(t) {
    setBusy(b => ({ ...b, [t.id]: true }));
    try {
      const u = await client.post("/api/tickets/" + t.id + "/triage");
      setTickets(prev => prev.map(x => x.id === t.id ? u : x));
      setSelected(s => (s && s.id === t.id ? u : s));
    } catch (e) { alert("Triage failed: " + e.message); }
    finally { setBusy(b => ({ ...b, [t.id]: false })); }
  }
  async function triageAll() { for (const t of tickets.filter(t => !t.triaged)) await runTriage(t); }
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f7f6f3", minHeight: "100vh", color: "#1c1b19" }}>
      <style>{`*{box-sizing:border-box}@keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .8s linear infinite}.tk-row:hover{background:#faf9f6}button{font-family:inherit;cursor:pointer}`}</style>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px", borderBottom: "1px solid #e8e6e0", background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1c1b19", display: "flex", alignItems: "center", justifyContent: "center" }}><Zap size={17} color="#fff" fill="#fff" /></div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4 }}>Triage</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#7a766c", background: "#f1efe8", padding: "3px 8px", borderRadius: 5, marginLeft: 4 }}>{(user && user.name ? user.name : "").toUpperCase()}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={triageAll} style={{ display: "flex", alignItems: "center", gap: 7, background: "#1c1b19", color: "#fff", border: "none", borderRadius: 8, padding: "9px 15px", fontSize: 13, fontWeight: 600 }}><Sparkles size={15} /> Triage all</button>
          <button onClick={onLogout} title="Log out" style={{ background: "#fff", border: "1px solid #e2e0d9", borderRadius: 8, padding: "9px 11px", color: "#56524a" }}><LogOut size={15} /></button>
        </div>
      </header>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          <Stat icon={<Inbox size={18} />} label="Open tickets" value={stats.open} tint="#185fa5" tintBg="#e6f1fb" />
          <Stat icon={<AlertTriangle size={18} />} label="Urgent" value={stats.urgent} tint="#a32d2d" tintBg="#fdecec" />
          <Stat icon={<CheckCircle2 size={18} />} label="AI triaged" value={stats.triaged + "/" + stats.total} tint="#0f6e56" tintBg="#e1f5ee" />
          <Stat icon={<BarChart3 size={18} />} label="Avg confidence" value={stats.triaged ? Math.round(tickets.filter(t=>t.triaged).reduce((a,t)=>a+(t.confidence||0),0)/stats.triaged*100) + "%" : "—"} tint="#534ab7" tintBg="#eeedfe" />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[["all","All"],["untriaged","Needs triage"],["urgent","Urgent"],["high","High"]].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{ padding: "6px 13px", borderRadius: 7, fontSize: 13, fontWeight: 500, border: "1px solid " + (filter===k ? "#1c1b19" : "#e2e0d9"), background: filter===k ? "#1c1b19" : "#fff", color: filter===k ? "#fff" : "#56524a" }}>{l}</button>
          ))}
        </div>
        <div style={{ background: "#fff", border: "1px solid #e8e6e0", borderRadius: 12, overflow: "hidden" }}>
          {loading && <div style={{ padding: 40, textAlign: "center", color: "#a39e92" }}>Loading tickets…</div>}
          {!loading && visible.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#a39e92" }}>No tickets match this filter.</div>}
          {visible.map((t, i) => {
            const p = t.priority ? PRIORITY[t.priority] : null;
            return (
              <div key={t.id} className="tk-row" onClick={() => setSelected(t)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderTop: i ? "1px solid #f0eee8" : "none", cursor: "pointer" }}>
                <div style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: p ? p.dot : "#d3d1c7" }}></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.subject}</div>
                  <div style={{ fontSize: 12.5, color: "#8b867a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.triaged ? t.summary : t.customer_email}</div>
                </div>
                {t.triaged && <span style={{ fontSize: 16 }}>{SENTIMENT[t.sentiment]}</span>}
                {t.triaged && <span style={{ fontSize: 11.5, fontWeight: 600, color: "#56524a", background: "#f1efe8", padding: "3px 8px", borderRadius: 5 }}>{TEAM[t.assigned_team]}</span>}
                {p && <span style={{ fontSize: 11.5, fontWeight: 700, color: p.fg, background: p.bg, padding: "3px 9px", borderRadius: 5 }}>{p.label}</span>}
                {!t.triaged && <button onClick={(e) => { e.stopPropagation(); runTriage(t); }} disabled={busy[t.id]} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#fff", background: "#534ab7", border: "none", borderRadius: 7, padding: "6px 11px" }}>{busy[t.id] ? <RefreshCw size={13} className="spin" /> : <Sparkles size={13} />}{busy[t.id] ? "Triaging" : "Triage"}</button>}
                <ChevronRight size={16} color="#c4c0b6" />
              </div>
            );
          })}
        </div>
      </div>
      {selected && <Drawer ticket={selected} busy={busy[selected.id]} onClose={() => setSelected(null)} onTriage={() => runTriage(selected)} />}
    </div>
  );
}

function Stat({ icon, label, value, tint, tintBg }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e8e6e0", borderRadius: 12, padding: "15px 17px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: tintBg, color: tint, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
        <span style={{ fontSize: 12.5, color: "#8b867a", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ background: "#faf9f6", border: "1px solid #eee", borderRadius: 9, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "#a39e92", marginBottom: 5, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

function Drawer({ ticket, busy, onClose, onTriage }) {
  const p = ticket.priority ? PRIORITY[ticket.priority] : null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(28,27,25,0.32)", display: "flex", justifyContent: "flex-end", zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 460, maxWidth: "92vw", background: "#fff", height: "100%", overflowY: "auto", boxShadow: "-8px 0 40px rgba(0,0,0,0.12)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35, marginBottom: 5 }}>{ticket.subject}</div>
            <div style={{ fontSize: 12.5, color: "#8b867a" }}>{ticket.customer_email}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#999", padding: 4 }}><X size={20} /></button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#a39e92", letterSpacing: 0.6, marginBottom: 8 }}>MESSAGE</div>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: "#3a382f", margin: "0 0 24px" }}>{ticket.body}</p>
          {!ticket.triaged ? (
            <button onClick={onTriage} disabled={busy} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#534ab7", color: "#fff", border: "none", borderRadius: 9, padding: "12px", fontSize: 14, fontWeight: 600 }}>{busy ? <><RefreshCw size={16} className="spin" /> Analyzing…</> : <><Sparkles size={16} /> Triage with AI</>}</button>
          ) : (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#a39e92", letterSpacing: 0.6, marginBottom: 10 }}>AI ANALYSIS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                <Field label="Priority"><span style={{ fontWeight: 700, color: p.fg, background: p.bg, padding: "3px 9px", borderRadius: 5, fontSize: 13 }}>{p.label}</span></Field>
                <Field label="Category"><b style={{ fontSize: 13.5, textTransform: "capitalize" }}>{(ticket.category||"").replace("_"," ")}</b></Field>
                <Field label="Assign to"><b style={{ fontSize: 13.5 }}>{TEAM[ticket.assigned_team]}</b></Field>
                <Field label="Sentiment"><b style={{ fontSize: 13.5, textTransform: "capitalize" }}>{SENTIMENT[ticket.sentiment]} {ticket.sentiment}</b></Field>
              </div>
              <div style={{ background: "#f7f6f3", borderRadius: 10, padding: "13px 15px", marginBottom: 18 }}>
                <div style={{ fontSize: 11.5, color: "#8b867a", marginBottom: 5, fontWeight: 600 }}>Summary</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{ticket.summary}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#a39e92", letterSpacing: 0.6, marginBottom: 8 }}>SUGGESTED REPLY</div>
              <div style={{ border: "1px solid #e6e4dd", borderRadius: 10, padding: "13px 15px", fontSize: 13.5, lineHeight: 1.6, color: "#3a382f", marginBottom: 12 }}>{ticket.suggested_reply}</div>
              <button style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#1c1b19", color: "#fff", border: "none", borderRadius: 9, padding: "11px", fontSize: 13.5, fontWeight: 600 }}><Send size={15} /> Send reply</button>
              <div style={{ textAlign: "center", fontSize: 11.5, color: "#a39e92", marginTop: 12 }}>Confidence {Math.round((ticket.confidence||0)*100)}%</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
