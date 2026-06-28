require("dotenv").config();
const mysql  = require("mysql2/promise");
const crypto = require("crypto");
const util   = require("util");

const scrypt = util.promisify(crypto.scrypt);

/* ─── PASSWORD HASHER ────────────────────────────────────────── */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

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

/* ─── SEEDER ─────────────────────────────────────────────────── */
async function seedAdmin() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "makeup_booking",
  });

  const adminName = "Admin Default";
  const adminEmail = "admin@example.com";
  const adminPassword = "password123";

  try {
    console.log("Checking for existing admin...");
    const [rows] = await pool.execute("SELECT * FROM admins WHERE email = ?", [adminEmail]);

    if (rows.length > 0) {
      console.log(`❌ Admin account with email '${adminEmail}' already exists.`);
      process.exit(0);
    }

    console.log(`Creating new admin account (${adminEmail})...`);
    const hash = await hashPassword(adminPassword);
    
    const [result] = await pool.execute(
      "INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)",
      [adminName, adminEmail, hash]
    );

    const newAdminId = result.insertId;

    console.log("Setting up default configuration for the admin...");
    await pool.execute(
      "INSERT INTO app_config (admin_id, config_json) VALUES (?, ?)",
      [newAdminId, JSON.stringify(DEFAULT_CONFIG)]
    );

    console.log("\n✅ Database seeded successfully!");
    console.log("-----------------------------------------");
    console.log("Login Email    : admin@example.com");
    console.log("Login Password : password123");
    console.log("-----------------------------------------");

  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
  } finally {
    await pool.end();
  }
}

seedAdmin();
