import { DatabaseSync } from "node:sqlite";
import { nanoid } from "nanoid";

const db = new DatabaseSync("triage.db");
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS orgs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    api_quota INTEGER NOT NULL DEFAULT 100,
    api_used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent',
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (org_id) REFERENCES orgs(id)
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    category TEXT,
    priority TEXT,
    sentiment TEXT,
    assigned_team TEXT,
    summary TEXT,
    suggested_reply TEXT,
    confidence REAL,
    triaged INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (org_id) REFERENCES orgs(id)
  );
`);

const existing = db.prepare("SELECT COUNT(*) AS c FROM orgs").get();
if (existing.c === 0) {
  const now = new Date().toISOString();
  const orgId = "org_demo";
  db.prepare(
    "INSERT INTO orgs (id, name, plan, api_quota, api_used, created_at) VALUES (?,?,?,?,?,?)"
  ).run(orgId, "Acme Inc.", "pro", 5000, 0, now);

  db.prepare(
    "INSERT INTO users (id, org_id, email, name, role, password_hash, created_at) VALUES (?,?,?,?,?,?,?)"
  ).run("usr_demo", orgId, "demo@acme.com", "Demo Admin", "admin", "SEED:demo1234", now);

  const seedTickets = [
    { subject: "Charged twice for my subscription this month", body: "Hi, I just noticed two identical charges of $49 on my card for the Pro plan this billing cycle. I only have one account. Please refund the duplicate immediately, this is really frustrating.", customer_email: "maria.lopez@example.com" },
    { subject: "How do I export my data to CSV?", body: "Hello! Loving the product so far. Quick question — is there a way to export my reports as a CSV file? I checked settings but couldn't find it. Thanks!", customer_email: "tony@startup.io" },
    { subject: "URGENT: API returning 500 errors in production", body: "Our entire integration is down. The /v1/sync endpoint has been returning 500 errors for the last 40 minutes and our customers can't check out. We are losing revenue every minute. Need someone on this NOW.", customer_email: "ops@bigcorp.com" },
    { subject: "Feature request: dark mode", body: "Would love to see a dark mode option in the dashboard. My team works late and the white background is hard on the eyes. Not urgent but would be a nice touch!", customer_email: "designer@agency.co" },
    { subject: "Cancelling my account", body: "I'd like to cancel. The product is fine but we're consolidating tools and no longer need it. Can you confirm there are no early termination fees? Want to make sure I'm not charged again.", customer_email: "finance@retailco.com" },
  ];

  const insert = db.prepare(
    "INSERT INTO tickets (id, org_id, subject, body, customer_email, status, created_at) VALUES (?,?,?,?,?,?,?)"
  );
  for (const t of seedTickets) {
    insert.run(`tkt_${nanoid(8)}`, orgId, t.subject, t.body, t.customer_email, "open", now);
  }
  console.log("Seeded demo org, user (demo@acme.com / demo1234), and 5 tickets.");
}

export default db;
