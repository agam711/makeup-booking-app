# 💄 Makeup Booking Platform

A full-stack booking platform for makeup artists — Node.js + Express + React.

---

## Tech Stack

| Layer    | Tech                  |
|----------|-----------------------|
| Server   | Node.js + Express     |
| Database | SQLite (better-sqlite3) |
| Auth     | JWT + bcryptjs        |
| Calendar | Google Calendar API   |
| Frontend | React + Vite          |

---

## Quick Start (Development)

### 1. Clone & Install

```bash
git clone <your-repo>
cd makeup-booking-app
npm install          # installs server + client deps
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env with your values (see below)
```

### 3. Run in development

```bash
npm run dev
```

- **API server** runs on → http://localhost:3001
- **React app** runs on → http://localhost:5173 (auto-proxies /api to 3001)

---

## Environment Variables

Edit `.env`:

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-long-random-secret-here

GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/calendar/callback

CLIENT_URL=http://localhost:5173
```

> **Generate JWT_SECRET:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

---

## Google Calendar Setup (10 minutes)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **"New Project"** → name it "Makeup Booking" → Create
3. Go to **APIs & Services → Library**
4. Search **"Google Calendar API"** → Enable it
5. Go to **APIs & Services → OAuth consent screen**
   - User Type: **External** → Create
   - Fill in App name (e.g. "Makeup Booking"), your email → Save
   - Scopes: click "Add or Remove Scopes" → search `calendar` → add `.../auth/calendar`
   - Test users: add your Gmail address → Save
6. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     - Dev: `http://localhost:3001/api/calendar/callback`
     - Prod: `https://YOUR-DOMAIN/api/calendar/callback`
7. Copy **Client ID** and **Client Secret** into `.env`

---

## Production Build

```bash
# Build the React frontend
npm run build

# Run in production mode
NODE_ENV=production npm start
```

The Express server will serve the React app at the root (`/`) and handle all `/api` routes.

---

## Deploy to Railway (Recommended — Free Tier Available)

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Add environment variables in Railway dashboard (Settings → Variables):
   ```
   NODE_ENV=production
   JWT_SECRET=<your-secret>
   GOOGLE_CLIENT_ID=<your-id>
   GOOGLE_CLIENT_SECRET=<your-secret>
   GOOGLE_REDIRECT_URI=https://YOUR-RAILWAY-URL/api/calendar/callback
   PORT=3001
   ```
5. Add a **build command**: `npm run setup`
6. Add a **start command**: `npm start`

> After deployment, update `GOOGLE_REDIRECT_URI` to your Railway URL and add it to Google Cloud Console → Credentials → Authorized redirect URIs.

---

## Deploy to Render (Free Tier Available)

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - **Build Command**: `npm run setup`
   - **Start Command**: `npm start`
4. Add environment variables (same as Railway above)

---

## Multi-Artist Support

Each registered makeup artist gets their own booking link:

```
https://yoursite.com/?adminId=1   ← Mary's booking page
https://yoursite.com/?adminId=2   ← Alice's booking page
```

The admin ID is shown in the settings panel after login, in the **"Your Booking Link"** box. Artists share their unique link with customers.

---

## API Reference

| Method | Path                        | Auth   | Description              |
|--------|-----------------------------|--------|--------------------------|
| POST   | /api/auth/register          | No     | Create admin account     |
| POST   | /api/auth/login             | No     | Sign in                  |
| GET    | /api/auth/me                | JWT    | Get current user         |
| GET    | /api/config?adminId=        | No     | Get booking page config  |
| PUT    | /api/config                 | JWT    | Save config              |
| GET    | /api/calendar/connect       | JWT    | Get Google OAuth URL     |
| GET    | /api/calendar/callback      | No     | Google OAuth callback    |
| GET    | /api/calendar/status        | JWT    | Calendar connection status|
| GET    | /api/calendar/available     | No     | Get available dates      |
| POST   | /api/calendar/event         | No     | Add event to calendar    |
| POST   | /api/bookings               | No     | Submit a booking         |
| GET    | /api/bookings               | JWT    | List all bookings        |

---

## Database

SQLite file is saved as `bookings.db` in the project root.

**Tables:**
- `admins` — makeup artist accounts + Google refresh tokens
- `app_config` — per-admin booking page configuration (JSON)
- `bookings` — all customer bookings

---

## License

MIT — free to use and modify.
