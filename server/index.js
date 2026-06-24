require("dotenv").config();
const express    = require("express");
const path       = require("path");
const cors       = require("cors");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const Database   = require("better-sqlite3");
const { google } = require("googleapis");

const app  = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-please-change-in-production";

/* ─── DATABASE ───────────────────────────────────────────────── */
const db = new Database(path.join(__dirname, "../bookings.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    name                 TEXT    NOT NULL,
    email                TEXT    UNIQUE NOT NULL,
    password_hash        TEXT    NOT NULL,
    google_refresh_token TEXT,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_config (
    admin_id   INTEGER PRIMARY KEY,
    config_json TEXT   NOT NULL DEFAULT '{}',
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id        INTEGER NOT NULL,
    booking_ref     TEXT    UNIQUE NOT NULL,
    customer_name   TEXT    NOT NULL,
    customer_phone  TEXT    NOT NULL,
    service_name    TEXT    NOT NULL,
    service_price   INTEGER NOT NULL,
    addons_json     TEXT    DEFAULT '[]',
    event_date      TEXT    NOT NULL,
    event_time      TEXT    NOT NULL,
    location        TEXT    NOT NULL,
    eo_contact      TEXT,
    notes           TEXT,
    total_price     INTEGER NOT NULL,
    status          TEXT    DEFAULT 'pending',
    calendar_event_id TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id)
  );
`);

/* ─── MIDDLEWARE ─────────────────────────────────────────────── */
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

/* ─── DEFAULT CONFIG ─────────────────────────────────────────── */
const DEFAULT_CONFIG = {
  appName: "My Makeup Studio",
  tagline: "Book your glam session ✨",
  whatsapp: "",
  instagram: "",
  instagramUrl: "",
  bankName: "",
  bankNumber: "",
  bankHolder: "",
  services: [
    { id: "s1", name: "Party Makeup",           price: 350000,  icon: "🎉", sub: "Glam look for any event" },
    { id: "s2", name: "Sister / Family Wedding", price: 750000,  icon: "👰", sub: "Support the bride in style" },
    { id: "s3", name: "Sweet Seventeen",         price: 500000,  icon: "🎂", sub: "Dreamy 17th birthday look" },
    { id: "s4", name: "Kondangan / Reception",   price: 400000,  icon: "💐", sub: "Elegant wedding-guest look" },
    { id: "s5", name: "Graduation",              price: 400000,  icon: "🎓", sub: "Fresh graduation day look" },
    { id: "s6", name: "Photoshoot",              price: 450000,  icon: "📸", sub: "Camera-ready professional" },
    { id: "s7", name: "Full Bridal (Pengantin)", price: 1500000, icon: "💍", sub: "Complete bridal experience" },
    { id: "s8", name: "Custom / Other",          price: 350000,  icon: "✨", sub: "Discuss your dream look" },
  ],
  addons: [
    { id: "a1", name: "Hairdo",  price: 250000, icon: "💇", hasTime: false },
    { id: "a2", name: "Retouch", price: 150000, icon: "🔄", hasTime: true  },
  ],
};

/* ─── GOOGLE OAUTH HELPER ────────────────────────────────────── */
const getOAuth2 = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/api/calendar/callback`
);

/* ─── CALENDAR HELPERS ───────────────────────────────────────── */
const getFallbackDates = () => {
  const dates = [], today = new Date();
  for (let i = 2; i <= 62; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() !== 1) dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
};

const getAvailableFromBusy = (busyTimes) => {
  const available = [], today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 2; i <= 62; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() === 1) continue;
    const dateStr = d.toISOString().split("T")[0];
    const dayStart = new Date(dateStr + "T00:00:00Z");
    const dayEnd   = new Date(dateStr + "T23:59:59Z");
    const busy = busyTimes.some(b => new Date(b.start) < dayEnd && new Date(b.end) > dayStart);
    if (!busy) available.push(dateStr);
  }
  return available;
};

/* ═══════════════════════════════════════════════════════════════
   AUTH ROUTES
═══════════════════════════════════════════════════════════════ */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields are required." });
    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });

    const existing = db.prepare("SELECT id FROM admins WHERE email = ?").get(email);
    if (existing) return res.status(409).json({ error: "Email already registered." });

    const hash = await bcrypt.hash(password, 12);
    const { lastInsertRowid: id } = db
      .prepare("INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)")
      .run(name, email, hash);

    db.prepare("INSERT INTO app_config (admin_id, config_json) VALUES (?, ?)")
      .run(id, JSON.stringify(DEFAULT_CONFIG));

    const token = jwt.sign({ id, email, name }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: { id, name, email } });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = db.prepare("SELECT * FROM admins WHERE email = ?").get(email);
    if (!admin) return res.status(401).json({ error: "Invalid email or password." });

    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password." });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.json({ token, user: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) {
    res.status(500).json({ error: "Login failed." });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const admin = db.prepare("SELECT id, name, email, google_refresh_token FROM admins WHERE id = ?").get(req.admin.id);
  if (!admin) return res.status(404).json({ error: "Not found." });
  res.json({ id: admin.id, name: admin.name, email: admin.email, calendarConnected: !!admin.google_refresh_token });
});

/* ═══════════════════════════════════════════════════════════════
   CONFIG ROUTES
═══════════════════════════════════════════════════════════════ */

// Public — booking page loads this
app.get("/api/config", (req, res) => {
  const adminId = parseInt(req.query.adminId) || 1;
  const row = db.prepare("SELECT config_json FROM app_config WHERE admin_id = ?").get(adminId);
  res.json(row ? JSON.parse(row.config_json) : DEFAULT_CONFIG);
});

// Admin only — save settings
app.put("/api/config", requireAuth, (req, res) => {
  try {
    const { config } = req.body;
    const exists = db.prepare("SELECT admin_id FROM app_config WHERE admin_id = ?").get(req.admin.id);
    if (exists) {
      db.prepare("UPDATE app_config SET config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE admin_id = ?")
        .run(JSON.stringify(config), req.admin.id);
    } else {
      db.prepare("INSERT INTO app_config (admin_id, config_json) VALUES (?, ?)").run(req.admin.id, JSON.stringify(config));
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save config." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   GOOGLE CALENDAR ROUTES
═══════════════════════════════════════════════════════════════ */

// Start OAuth flow — returns Google auth URL
app.get("/api/calendar/connect", requireAuth, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID)
    return res.status(503).json({ error: "Google Calendar not configured. Add GOOGLE_CLIENT_ID to .env" });

  const url = getOAuth2().generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar"],
    prompt: "consent",
    state: String(req.admin.id),
  });
  res.json({ url });
});

// OAuth callback — exchanges code for tokens
app.get("/api/calendar/callback", async (req, res) => {
  try {
    const { code, state: adminId } = req.query;
    const oauth2 = getOAuth2();
    const { tokens } = await oauth2.getToken(code);
    const refreshToken = tokens.refresh_token || tokens.access_token;

    db.prepare("UPDATE admins SET google_refresh_token = ? WHERE id = ?")
      .run(refreshToken, parseInt(adminId));

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#FFF0F7;color:#8B3A6E">
        <div style="font-size:48px;margin-bottom:16px">✅</div>
        <h2>Google Calendar Connected!</h2>
        <p>You can close this window and return to your admin panel.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'CALENDAR_CONNECTED' }, '*');
            setTimeout(() => window.close(), 1500);
          }
        </script>
      </body></html>
    `);
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.send(`<html><body><p>❌ Failed to connect. Please try again.</p></body></html>`);
  }
});

// Calendar connection status
app.get("/api/calendar/status", requireAuth, (req, res) => {
  const admin = db.prepare("SELECT google_refresh_token FROM admins WHERE id = ?").get(req.admin.id);
  res.json({ connected: !!admin?.google_refresh_token });
});

// Public — get available dates for a given admin
app.get("/api/calendar/available", async (req, res) => {
  try {
    const adminId = parseInt(req.query.adminId) || 1;
    const admin = db.prepare("SELECT google_refresh_token FROM admins WHERE id = ?").get(adminId);

    if (!admin?.google_refresh_token || !process.env.GOOGLE_CLIENT_ID) {
      return res.json({ availableDates: getFallbackDates(), source: "fallback" });
    }

    const oauth2 = getOAuth2();
    oauth2.setCredentials({ refresh_token: admin.google_refresh_token });
    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    const today = new Date(), twoMonths = new Date();
    twoMonths.setDate(today.getDate() + 60);

    const { data } = await calendar.freebusy.query({
      requestBody: {
        timeMin: today.toISOString(),
        timeMax: twoMonths.toISOString(),
        items: [{ id: "primary" }],
      },
    });

    const busy = data.calendars.primary.busy || [];
    res.json({ availableDates: getAvailableFromBusy(busy), source: "google" });
  } catch (err) {
    console.error("Calendar available error:", err.message);
    res.json({ availableDates: getFallbackDates(), source: "fallback" });
  }
});

// Create a calendar event for a confirmed booking
app.post("/api/calendar/event", async (req, res) => {
  try {
    const { adminId, booking } = req.body;
    const admin = db.prepare("SELECT google_refresh_token FROM admins WHERE id = ?").get(parseInt(adminId));

    if (!admin?.google_refresh_token || !process.env.GOOGLE_CLIENT_ID) {
      return res.json({ success: false, reason: "Calendar not connected" });
    }

    const oauth2 = getOAuth2();
    oauth2.setCredentials({ refresh_token: admin.google_refresh_token });
    const calendar = google.calendar({ version: "v3", auth: oauth2 });

    const [h, m] = (booking.eventTime || "09:00").split(":");
    const endH   = String((parseInt(h) + 3) % 24).padStart(2, "0");
    const tz     = "Asia/Jakarta";

    const aoText = (booking.addons || [])
      .map(a => `${a.name}${a.time ? " at " + a.time : ""}`)
      .join(", ") || "None";

    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary:  `💄 ${booking.serviceName} — ${booking.customerName}`,
        location: booking.location,
        description: [
          `Booking ID: ${booking.bookingRef}`,
          `Customer: ${booking.customerName}`,
          `Phone: ${booking.customerPhone}`,
          `Service: ${booking.serviceName}`,
          `Add-ons: ${aoText}`,
          `EO Contact: ${booking.eoContact || "–"}`,
          `Total PAID: IDR ${(booking.totalPrice || 0).toLocaleString("id-ID")}`,
          `Notes: ${booking.notes || "–"}`,
        ].join("\n"),
        start: { dateTime: `${booking.date}T${booking.eventTime || "09:00"}:00`, timeZone: tz },
        end:   { dateTime: `${booking.date}T${endH}:${m}:00`, timeZone: tz },
      },
    });

    if (booking.bookingRef) {
      db.prepare("UPDATE bookings SET calendar_event_id = ?, status = 'confirmed' WHERE booking_ref = ?")
        .run(event.data.id, booking.bookingRef);
    }

    res.json({ success: true, eventId: event.data.id });
  } catch (err) {
    console.error("Calendar event error:", err.message);
    res.json({ success: false, error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════
   BOOKINGS ROUTES
═══════════════════════════════════════════════════════════════ */

// Public — submit a booking
app.post("/api/bookings", (req, res) => {
  try {
    const { adminId, booking } = req.body;
    const ref = `MKP-${Date.now().toString().slice(-6)}`;

    db.prepare(`
      INSERT INTO bookings
        (admin_id, booking_ref, customer_name, customer_phone, service_name, service_price,
         addons_json, event_date, event_time, location, eo_contact, notes, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      parseInt(adminId), ref,
      booking.customerName, booking.customerPhone,
      booking.serviceName, booking.servicePrice,
      JSON.stringify(booking.addons || []),
      booking.date, booking.eventTime,
      booking.location,
      booking.eoContact || "",
      booking.notes    || "",
      booking.totalPrice
    );

    res.json({ success: true, bookingRef: ref });
  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ error: "Failed to save booking." });
  }
});

// Admin only — list all bookings
app.get("/api/bookings", requireAuth, (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM bookings WHERE admin_id = ? ORDER BY created_at DESC"
  ).all(req.admin.id);
  res.json(rows.map(b => ({ ...b, addons: JSON.parse(b.addons_json || "[]") })));
});

/* ═══════════════════════════════════════════════════════════════
   SERVE REACT APP IN PRODUCTION
═══════════════════════════════════════════════════════════════ */
if (process.env.NODE_ENV === "production") {
  const dist = path.join(__dirname, "../client/dist");
  app.use(express.static(dist));
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`\n🌸 Makeup Booking Server`);
  console.log(`   Running → http://localhost:${PORT}`);
  console.log(`   Mode    → ${process.env.NODE_ENV || "development"}\n`);
});
