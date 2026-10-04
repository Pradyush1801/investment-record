# Decision Intelligence Platform — Auth + Invite App

A minimal full-stack React + Node.js app with:
- **Postgres (Supabase)** user storage
- **JWT** authentication (login / logout)
- **Invite-only registration** — admin sends a link, user registers themselves
- **Password reset** via email link
- **Role management** — admin can promote/demote and deactivate users

---

## Project layout

```
app/
  backend/      Express + Postgres (pg) API
  frontend/     React + Vite SPA
  README.md
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| Postgres | Supabase project (free tier) |

---

## Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

### Create the database (Supabase)

1. Create a free project at supabase.com.
2. **SQL Editor → New query** → paste the contents of `backend/schema.sql` → **Run**.
3. **Connect** (top bar) → copy the **Session pooler** connection string into `DATABASE_URL`
   and replace `[YOUR-PASSWORD]` with your database password.

Edit `.env`:

## node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

```env
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
JWT_SECRET=generate_a_64_char_random_string_here 
FRONTEND_URL=http://localhost:5173

# Email (optional in dev — emails print to console without these)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_gmail_app_password
EMAIL_FROM=no-reply@yourapp.com
```

### Create first admin

```bash
node seed-admin.js
# Creates admin@example.com / ChangeMe123! — change immediately!
```

### Start server

```bash
npm run dev          # development (auto-restart)
npm start            # production
```

Server runs at `http://localhost:4000`

---

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:4000
```

```bash
npm run dev          # http://localhost:5173
npm run build        # production build → dist/
```

---

## How the invite flow works

```
Admin (Invites page)
  └── clicks "Send invite" → enters email + role
        └── POST /invites
              ├── creates Invitation doc with 72h token
              ├── sends email with link: /register?token=<uuid>
              └── shows copyable link in UI

Invitee
  └── clicks link → /register?token=<uuid>
        ├── GET /invites/validate/:token (validates token, reads email+role)
        ├── shows pre-filled email (locked), asks for name + password
        └── POST /auth/register → creates User, marks invite used, returns JWT
```

---

## API reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | — | Email + password login |
| GET | `/auth/me` | Bearer | Verify token + return user |
| POST | `/auth/register` | — | Register via invite token |
| POST | `/auth/forgot-password` | — | Request reset link |
| POST | `/auth/reset-password` | — | Set new password via token |
| POST | `/invites` | Admin | Send invite email |
| GET | `/invites` | Admin | List all invites |
| DELETE | `/invites/:id` | Admin | Revoke pending invite |
| GET | `/invites/validate/:token` | — | Check invite token validity |
| GET | `/users` | Admin | List all users |
| PATCH | `/users/:id` | Admin | Change role or deactivate |

---

## Pages

| URL | Access | Description |
|-----|--------|-------------|
| `/login` | Public | Sign in |
| `/register?token=…` | Public (invite) | Self-registration |
| `/forgot-password` | Public | Request reset email |
| `/reset-password?token=…` | Public | Set new password |
| `/dashboard` | Any user | Main workspace |
| `/invites` | Admin only | Send + manage invites |
| `/users` | Admin only | Manage users + roles |

---

## Email in development

Without SMTP configured, all emails are **printed to the backend console** — no email provider needed for local dev. Look for:

```
──── EMAIL (dev mode) ────
TO:      user@example.com
SUBJECT: You've been invited…
...
─────────────────────────
```

Copy the invite/reset link from the console output.

---

## Production checklist

- [ ] Set `DATABASE_URL` to the Supabase session pooler connection string
- [ ] Ping `/health` at least weekly (e.g. cron-job.org) so the free Supabase project isn't paused
- [ ] Set `JWT_SECRET` to a random 64+ character string
- [ ] Set `FRONTEND_URL` to your deployed frontend domain
- [ ] Configure SMTP (SendGrid, Postmark, or Gmail app password)
- [ ] Run `npm run build` in frontend, deploy `dist/` to Vercel/Netlify
- [ ] Deploy backend to Railway/Render, set all env vars
- [ ] Change admin password after first login

---

## Dropping in your scoring component

The `Dashboard.jsx` is a blank canvas. Import your existing `ai-investment-decision-model.jsx` component there:

```jsx
// src/pages/Dashboard.jsx
import ScoringModel from '../components/ScoringModel';

export default function Dashboard() {
  return (
    <div>
      <ScoringModel />
    </div>
  );
}
```
