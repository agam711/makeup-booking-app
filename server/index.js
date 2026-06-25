require("dotenv").config();
const express    = require("express");
const path       = require("path");
const cors       = require("cors");
const crypto     = require("crypto");
const util       = require("util");
const jwt        = require("jsonwebtoken");
const mysql      = require("mysql2/promise");
const { google } = require("googleapis");

const app  = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-please-change-in-production";

const scrypt = util.promisify(crypto.scrypt);

/* ─── CRYPTO PASSWORD HELPERS ────────────────────────────────── */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, hash) {
  if (!hash || !hash.includes(":")) return false;
  const [salt, key] = hash.split(":");
  const derivedKey = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(key, "hex"), derivedKey);
}

/* ─── DATABASE POOL ──────────────────────────────────────────── */
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "makeup_booking",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Database initialization
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      google_refresh_token TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_config (
      admin_id INT PRIMARY KEY,
      config_json TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NOT NULL,
      booking_ref VARCHAR(50) UNIQUE NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(50) NOT NULL,
      service_name VARCHAR(255) NOT NULL,
      service_price INT NOT NULL,
      addons_json TEXT,
      event_date VARCHAR(50) NOT NULL,
      event_time VARCHAR(50) NOT NULL,
      location VARCHAR(255) NOT NULL,
      eo_contact VARCHAR(255),
      notes TEXT,
      total_price INT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      calendar_event_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

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

    const [existingRows] = await pool.execute("SELECT id FROM admins WHERE email = ?", [email]);
    if (existingRows.length > 0) return res.status(409).json({ error: "Email already registered." });

    const hash = await hashPassword(password);
    const [result] = await pool.execute(
      "INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, hash]
    );
    const id = result.insertId;

    await pool.execute(
      "INSERT INTO app_config (admin_id, config_json) VALUES (?, ?)",
      [id, JSON.stringify(DEFAULT_CONFIG)]
    );

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
    const [rows] = await pool.execute("SELECT * FROM admins WHERE email = ?", [email]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: "Invalid email or password." });

    const ok = await verifyPassword(password, admin.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password." });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name },
      JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.json({ token, user: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, name, email, google_refresh_token FROM admins WHERE id = ?",
      [req.admin.id]
    );
    const admin = rows[0];
    if (!admin) return res.status(404).json({ error: "Not found." });
    res.json({ id: admin.id, name: admin.name, email: admin.email, calendarConnected: !!admin.google_refresh_token });
  } catch (err) {
    console.error("Auth me error:", err);
    res.status(500).json({ error: "Failed to fetch user profile." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   CONFIG ROUTES
   ═══════════════════════════════════════════════════════════════ */

// Public — booking page loads this
app.get("/api/config", async (req, res) => {
  try {
    const adminId = parseInt(req.query.adminId) || 1;
    const [rows] = await pool.execute("SELECT config_json FROM app_config WHERE admin_id = ?", [adminId]);
    const row = rows[0];
    res.json(row ? JSON.parse(row.config_json) : DEFAULT_CONFIG);
  } catch (err) {
    console.error("Get config error:", err);
    res.json(DEFAULT_CONFIG);
  }
});

// Admin only — save settings
app.put("/api/config", requireAuth, async (req, res) => {
  try {
    const { config } = req.body;
    const [rows] = await pool.execute("SELECT admin_id FROM app_config WHERE admin_id = ?", [req.admin.id]);
    const exists = rows[0];
    if (exists) {
      await pool.execute(
        "UPDATE app_config SET config_json = ? WHERE admin_id = ?",
        [JSON.stringify(config), req.admin.id]
      );
    } else {
      await pool.execute(
        "INSERT INTO app_config (admin_id, config_json) VALUES (?, ?)",
        [req.admin.id, JSON.stringify(config)]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Save config error:", err);
    res.status(500).json({ error: "Failed to save config." });
  }
});

/* ─── GOOGLE CALENDAR ROUTES ────────────────────────────────── */

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

    await pool.execute(
      "UPDATE admins SET google_refresh_token = ? WHERE id = ?",
      [refreshToken, parseInt(adminId)]
    );

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
app.get("/api/calendar/status", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT google_refresh_token FROM admins WHERE id = ?", [req.admin.id]);
    const admin = rows[0];
    res.json({ connected: !!admin?.google_refresh_token });
  } catch (err) {
    console.error("Calendar status error:", err);
    res.status(500).json({ error: "Failed to get calendar status." });
  }
});

// Public — get available dates for a given admin
app.get("/api/calendar/available", async (req, res) => {
  try {
    const adminId = parseInt(req.query.adminId) || 1;
    const [rows] = await pool.execute("SELECT google_refresh_token FROM admins WHERE id = ?", [adminId]);
    const admin = rows[0];

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
    const [rows] = await pool.execute("SELECT google_refresh_token FROM admins WHERE id = ?", [parseInt(adminId)]);
    const admin = rows[0];

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
      await pool.execute(
        "UPDATE bookings SET calendar_event_id = ?, status = 'confirmed' WHERE booking_ref = ?",
        [event.data.id, booking.bookingRef]
      );
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
app.post("/api/bookings", async (req, res) => {
  try {
    const { adminId, booking } = req.body;
    const ref = `MKP-${Date.now().toString().slice(-6)}`;

    await pool.execute(`
      INSERT INTO bookings
        (admin_id, booking_ref, customer_name, customer_phone, service_name, service_price,
         addons_json, event_date, event_time, location, eo_contact, notes, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      parseInt(adminId), ref,
      booking.customerName, booking.customerPhone,
      booking.serviceName, booking.servicePrice,
      JSON.stringify(booking.addons || []),
      booking.date, booking.eventTime,
      booking.location,
      booking.eoContact || "",
      booking.notes    || "",
      booking.totalPrice
    ]);

    res.json({ success: true, bookingRef: ref });
  } catch (err) {
    console.error("Booking error:", err);
    res.status(500).json({ error: "Failed to save booking." });
  }
});

// Admin only — list all bookings
app.get("/api/bookings", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM bookings WHERE admin_id = ? ORDER BY created_at DESC",
      [req.admin.id]
    );
    res.json(rows.map(b => ({ ...b, addons: JSON.parse(b.addons_json || "[]") })));
  } catch (err) {
    console.error("Get bookings error:", err);
    res.status(500).json({ error: "Failed to fetch bookings." });
  }
});

/* ═══════════════════════════════════════════════════════════════
   SERVE REACT APP IN PRODUCTION
   ═══════════════════════════════════════════════════════════════ */
if (process.env.NODE_ENV === "production") {
  const dist = path.join(__dirname, "../client/dist");
  app.use(express.static(dist));
  app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
}

/* ─── STARTUP ────────────────────────────────────────────────── */
async function startServer() {
  try {
    // 1. Auto-create database tables if not existing
    console.log("Checking and initializing MySQL database...");
    await initDB();
    console.log("Database initialized successfully.");

    // 2. Start listening
    app.listen(PORT, () => {
      console.log(`\n🌸 Makeup Booking Server`);
      console.log(`   Running → http://localhost:${PORT}`);
      console.log(`   Mode    → ${process.env.NODE_ENV || "development"}\n`);
    });
  } catch (err) {
    console.error("Failed to initialize database and start server:", err);
    process.exit(1);
  }
}

startServer();
