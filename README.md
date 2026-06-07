# Triage — AI Support Ticket Triage

An AI-powered B2B SaaS that turns a chaotic support inbox into a sorted, actionable queue. Incoming tickets are automatically classified, prioritized, routed to the right team, scored for sentiment, and given a draft reply — powered by Claude.

## Features

- AI triage of support tickets: category, priority, sentiment, team routing, summary, and a suggested reply
- Structured AI output via Anthropic tool use (validated JSON every time)
- Keyword fallback so the app runs even without an API key
- JWT auth, multi-org support, and per-plan AI usage quotas
- React dashboard: stat cards, filtering, and a detail drawer per ticket

## Tech stack

- Backend: Node.js, Express, node:sqlite (built-in, no native deps), JWT
- Frontend: React + Vite
- AI: Anthropic API (claude-sonnet-4)

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env        # then edit .env with your real values
npm start                   # http://localhost:4000
```

Generate a JWT secret with `openssl rand -hex 32` and paste it into `.env`.
On first run the backend seeds a demo org and 5 sample tickets.
Demo login: `demo@acme.com` / `demo1234`.

### Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Open the printed URL, sign in with the demo credentials, and start triaging.

## API

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/register` | Create an org + admin user |
| POST | `/api/auth/login` | Get a JWT |
| GET | `/api/tickets` | List tickets |
| GET | `/api/tickets/stats` | Dashboard metrics |
| POST | `/api/tickets` | Ingest a ticket |
| POST | `/api/tickets/:id/triage` | Run AI triage |
| PATCH | `/api/tickets/:id` | Update ticket status |
| GET | `/api/org` | Plan + usage |

## Roadmap

- Stripe billing tied to the usage quota
- Email/webhook ingestion (Zendesk, Intercom, IMAP)
- Background worker so triage runs on ingest instead of on click
- Postgres + Redis for production scale

## License

MIT
