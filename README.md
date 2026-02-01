# NewsRoom

The digital newsroom for M3 Media — write, review, and publish stories from a single platform.

![NewsRoom Logo](public/newsroom-logo.jpeg)

## Features

- **Rich Text Editor** — Google Docs-like writing experience with formatting, links, embedded tweets, and images from a shared Google Drive library
- **Editorial Workflow** — Submit → Review → Approve/Revise/Reject → Publish pipeline with email notifications at each step
- **Multi-CMS Publishing** — Publish approved stories directly to WordPress or Ghost CMS sites
- **Role-Based Access** — Writers, Editors, and Admins each see what they need
- **Shared Image Library** — Browse and insert images from a shared Google Drive folder

## Tech Stack

- **Next.js 14** with TypeScript and App Router
- **PostgreSQL 16** with Prisma ORM
- **TipTap** rich text editor (ProseMirror-based)
- **Caddy** reverse proxy with automatic HTTPS
- **Docker Compose** for single-command deployment

---

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — at minimum set a DATABASE_URL and NEXTAUTH_SECRET

# 3. Push database schema & seed
npx prisma db push
npx prisma db seed

# 4. Start dev server
npm run dev
```

Default accounts after seeding:
- **Admin:** admin@m3media.com / changeme123
- **Writer:** writer@m3media.com / writer123

---

## Production Deployment (Docker Compose)

The entire stack deploys with a single `docker compose up`. Caddy automatically provisions and renews SSL certificates via Let's Encrypt.

### Prerequisites

- A server with Docker and Docker Compose installed (e.g., Hetzner, DigitalOcean, AWS)
- A domain name with an A record pointing to your server's IP

### Steps

```bash
# 1. Clone the repo on your server
git clone https://github.com/YOUR_ORG/newsroom.git
cd newsroom

# 2. Configure environment
cp .env.example .env
nano .env
# Set: DOMAIN, DB_PASSWORD, NEXTAUTH_URL, NEXTAUTH_SECRET
# Optionally: SMTP_*, GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_DRIVE_FOLDER_ID

# 3. Run database migrations & seed (one-time)
docker compose --profile setup up migrate

# 4. Start everything
docker compose up -d

# That's it! Visit https://your-domain.com
```

### What `docker compose up` does

| Service | Purpose |
|---------|---------|
| `db` | PostgreSQL 16 database with persistent volume |
| `app` | Next.js application (standalone build) |
| `caddy` | Reverse proxy with automatic HTTPS via Let's Encrypt |
| `migrate` | (setup profile only) Runs Prisma migrations and seeds the database |

### Updating

```bash
git pull
docker compose build app
docker compose up -d
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DOMAIN` | Yes | Your domain (used by Caddy for SSL) |
| `DB_PASSWORD` | Yes | PostgreSQL password |
| `NEXTAUTH_URL` | Yes | Full URL of your site |
| `NEXTAUTH_SECRET` | Yes | Random 32+ character secret |
| `SMTP_HOST` | No | SMTP server for email notifications |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASSWORD` | No | SMTP password |
| `SMTP_FROM` | No | From address for emails |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | No | Google service account JSON key (for Drive image library) |
| `GOOGLE_DRIVE_FOLDER_ID` | No | Shared Google Drive folder ID |

## Google Drive Setup

1. Create a Google Cloud project and enable the Drive API
2. Create a service account and download the JSON key
3. Share your Drive folder with the service account's email
4. Set `GOOGLE_SERVICE_ACCOUNT_KEY` (the full JSON string) and `GOOGLE_DRIVE_FOLDER_ID` in `.env`

## CMS Publishing Setup

- **Ghost:** Settings → Integrations → Custom Integration → Copy the Admin API Key
- **WordPress:** Users → Application Passwords → Generate one

Configure publish targets in the admin panel at `/admin/sites`.

---

## Project Structure

```
newsroom/
├── prisma/              # Database schema and seed
├── public/              # Static assets (logo, favicon)
├── src/
│   ├── app/             # Next.js pages and API routes
│   │   ├── api/         # REST API endpoints
│   │   ├── admin/       # Admin pages (users, sites)
│   │   ├── dashboard/   # Main dashboard
│   │   ├── editor/      # Article editor
│   │   └── login/       # Authentication
│   ├── components/      # Reusable UI components
│   │   ├── editor/      # TipTap editor, image picker, tag input
│   │   ├── dashboard/   # Publish modal
│   │   └── layout/      # Sidebar, AppShell
│   ├── lib/             # Utilities (auth, email, drive, publish)
│   └── types/           # TypeScript types
├── Caddyfile            # Caddy reverse proxy config
├── docker-compose.yml   # Full-stack deployment
├── Dockerfile           # Next.js production build
└── Dockerfile.migrate   # Database migration runner
```
