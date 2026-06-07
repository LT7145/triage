import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import db from "./db.js";
import { triageTicket } from "./triage.js";
import {
  hashPassword,
  verifyPassword,
  signToken,
  authMiddleware,
  requireAdmin,
} from "./auth.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// ---------- Auth ----------
app.post("/api/auth/register", (req, res) => {
  const { org_name, name, email, password } = req.body;
  if (!org_name || !name || !email || !password)
    return res.status(400).json({ error: "Missing fields" });

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "Email already registered" });

  const now = new Date().toISOString();
  const orgId = `org_${nanoid(8)}`;
  const userId = `usr_${nanoid(8)}`;
  db.prepare(
    "INSERT INTO orgs (id, name, plan, api_quota, api_used, created_at) VALUES (?,?,?,?,?,?)"
  ).run(orgId, org_name, "free", 100, 0, now);
  db.prepare(
    "INSERT INTO users (id, org_id, email, name, role, password_hash, created_at) VALUES (?,?,?,?,?,?,?)"
  ).run(userId, orgId, email, name, "admin", hashPassword(password), now);

  const user = { id: userId, org_id: orgId, role: "admin", email };
  res.json({ token: signToken(user), user: { id: userId, name, email, role: "admin" } });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !verifyPassword(password, user.password_hash))
    return res.status(401).json({ error: "Invalid credentials" });
  res.json({
    token: signToken(user),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// ---------- Org / usage ----------
app.get("/api/org", authMiddleware, (req, res) => {
  const org = db.prepare("SELECT * FROM orgs WHERE id = ?").get(req.auth.org_id);
  res.json(org);
});

// ---------- Tickets ----------
app.get("/api/tickets", authMiddleware, (req, res) => {
  const { status, priority } = req.query;
  let sql = "SELECT * FROM tickets WHERE org_id = ?";
  const params = [req.auth.org_id];
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (priority) { sql += " AND priority = ?"; params.push(priority); }
  sql += " ORDER BY created_at DESC";
  res.json(db.prepare(sql).all(...params));
});

app.get("/api/tickets/stats", authMiddleware, (req, res) => {
  const orgId = req.auth.org_id;
  const total = db.prepare("SELECT COUNT(*) c FROM tickets WHERE org_id=?").get(orgId).c;
  const open = db.prepare("SELECT COUNT(*) c FROM tickets WHERE org_id=? AND status='open'").get(orgId).c;
  const urgent = db.prepare("SELECT COUNT(*) c FROM tickets WHERE org_id=? AND priority='urgent'").get(orgId).c;
  const triaged = db.prepare("SELECT COUNT(*) c FROM tickets WHERE org_id=? AND triaged=1").get(orgId).c;
  const byCategory = db.prepare(
    "SELECT category, COUNT(*) c FROM tickets WHERE org_id=? AND category IS NOT NULL GROUP BY category"
  ).all(orgId);
  res.json({ total, open, urgent, triaged, byCategory });
});

app.post("/api/tickets", authMiddleware, (req, res) => {
  const { subject, body, customer_email } = req.body;
  if (!subject || !body || !customer_email)
    return res.status(400).json({ error: "Missing fields" });
  const id = `tkt_${nanoid(8)}`;
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO tickets (id, org_id, subject, body, customer_email, status, created_at) VALUES (?,?,?,?,?,?,?)"
  ).run(id, req.auth.org_id, subject, body, customer_email, "open", now);
  res.json(db.prepare("SELECT * FROM tickets WHERE id=?").get(id));
});

// The core AI action: triage a single ticket
app.post("/api/tickets/:id/triage", authMiddleware, async (req, res) => {
  const ticket = db
    .prepare("SELECT * FROM tickets WHERE id=? AND org_id=?")
    .get(req.params.id, req.auth.org_id);
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  const org = db.prepare("SELECT * FROM orgs WHERE id=?").get(req.auth.org_id);
  if (org.api_used >= org.api_quota)
    return res.status(429).json({ error: "AI quota exceeded for this plan" });

  try {
    const result = await triageTicket(ticket);
    db.prepare(
      `UPDATE tickets SET category=?, priority=?, sentiment=?, assigned_team=?,
       summary=?, suggested_reply=?, confidence=?, triaged=1 WHERE id=?`
    ).run(
      result.category, result.priority, result.sentiment, result.assigned_team,
      result.summary, result.suggested_reply, result.confidence, ticket.id
    );
    db.prepare("UPDATE orgs SET api_used = api_used + 1 WHERE id=?").run(org.id);
    res.json(db.prepare("SELECT * FROM tickets WHERE id=?").get(ticket.id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Triage failed", detail: String(e.message) });
  }
});

app.patch("/api/tickets/:id", authMiddleware, (req, res) => {
  const { status } = req.body;
  const allowed = ["open", "in_progress", "resolved"];
  if (status && !allowed.includes(status))
    return res.status(400).json({ error: "Invalid status" });
  db.prepare("UPDATE tickets SET status=? WHERE id=? AND org_id=?")
    .run(status, req.params.id, req.auth.org_id);
  res.json(db.prepare("SELECT * FROM tickets WHERE id=?").get(req.params.id));
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Triage API running on http://localhost:${PORT}`));
