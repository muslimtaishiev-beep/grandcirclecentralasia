import express from "express";
import cors from "cors";
import path from "path";
import { promises as fs, existsSync, readFileSync } from "fs";
import dotenv from "dotenv";
import admin from "firebase-admin";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200, // Limit each IP to 200 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

const PORT = Number(process.env.PORT) || 3005;
const DB_PATH = path.join(process.cwd(), "data", "db.json");

// Attempt to initialize Firebase Admin
let useFirebase = false;
try {
  const keyPath = path.join(process.cwd(), "serviceAccountKey.json");
  if (existsSync(keyPath)) {
    const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    useFirebase = true;
    console.log("🔥 Firebase Admin SDK initialized successfully from serviceAccountKey.json.");
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    useFirebase = true;
    console.log("🔥 Firebase Admin SDK initialized successfully from .env.");
  } else {
    console.warn("⚠️ No serviceAccountKey.json found. Falling back to local db.json.");
  }
} catch (e) {
  console.warn("⚠️ Failed to initialize Firebase Admin. Falling back to local db.json.", e);
}

// Middleware
// Removed duplicate app.use(express.json()) to preserve the 10MB limit set above.
// Memory active sessions store
let activeSessions = new Set<string>();

// Helper to read database
async function readDb() {
  const defaultMetrics = [
    { id: "m1", value: "500+", label_en: "Attendees", label_ru: "Участников", sublabel_en: "Students, parents, professionals", sublabel_ru: "Школьники, студенты, родители", order: 1 },
    { id: "m2", value: "1", label_en: "Intense Day", label_ru: "День форума", order: 2 },
    { id: "m3", value: "20+", label_en: "Speakers", label_ru: "Спикеров", order: 3 },
    { id: "m4", value: "Essay", label_en: "Competition", label_ru: "Competition", sublabel_en: "Largest in CA", sublabel_ru: "Крупнейший в ЦА", order: 4 },
    { id: "m5", value: "∞", label_en: "Motivation", label_ru: "Мотивации", order: 5 },
    { id: "m6", value: "4", label_en: "Panel Sessions", label_ru: "Панельные сессии", sublabel_en: "Admission strategies", sublabel_ru: "Стратегии поступления", order: 6 },
    { id: "m7", value: "VIP", label_en: "Dinner", label_ru: "Ужин", order: 7 },
    { id: "m8", value: "100%", label_en: "Networking", label_ru: "Нетворкинг", order: 8 }
  ];

  if (useFirebase) {
    try {
      const dbRef = admin.firestore().collection("system").doc("db");
      const doc = await dbRef.get();
      if (doc.exists) {
        const data = doc.data() || {};
        if (!data.metrics || data.metrics.length === 0) {
          data.metrics = defaultMetrics;
          await dbRef.set(data);
        }
        return data;
      }
    } catch (e) {
      console.error("Firebase read error", e);
    }
  }

  // Fallback / Initial schema
  try {
    const data = await fs.readFile(DB_PATH, "utf-8");
    const parsed = JSON.parse(data);
    if (!parsed.metrics || parsed.metrics.length === 0) {
      parsed.metrics = defaultMetrics;
      fs.writeFile(DB_PATH, JSON.stringify(parsed, null, 2), "utf-8").catch(e => console.error(e));
    }
    return parsed;
  } catch (error) {
    console.error("Database reading error, reloading blank structure.", error);
    return {
      settings: {
        eventDate: "June 26, 2026",
        eventVenue: "Astana Technopark, Block C4",
        adminPassword: "admin",
        contactEmail: "info@mainedu.kz",
        contactPhone: "+7 (7172) 55-44-33"
      },
      speakers: [],
      program: [],
      partners: [],
      tickets: [],
      subscribers: [],
      metrics: defaultMetrics
    };
  }
}

// Helper to write database
async function writeDb(data: any) {
  if (useFirebase) {
    try {
      const dbRef = admin.firestore().collection("system").doc("db");
      await dbRef.set(data);
      return true;
    } catch (e) {
      console.error("Firebase write error", e);
    }
  }

  try {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Database writing error: ", error);
    return false;
  }
}

// Authentication middleware
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace("Bearer ", "").trim();
  
  if (token && activeSessions.has(token)) {
    return next();
  }
  
  res.status(401).json({ error: "Unauthorized access to admin APIs." });
}

// PUBLIC API ENDPOINTS

// 1. Get all public forum details in a single highly-efficient request
app.get("/api/public/data", async (req, res) => {
  const db = await readDb();
  // Strip password from public settings
  const publicSettings = { ...db.settings };
  delete publicSettings.adminPassword;

  res.json({
    settings: publicSettings,
    speakers: db.speakers || [],
    program: db.program || [],
    partners: db.partners || [],
    tickets: db.tickets || [],
    metrics: db.metrics || [],
    universities: db.universities || []
  });
});

// 2. Subscribe to newsletter
app.post("/api/public/subscribe", async (req, res) => {
  const { email, name, ticket } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  const db = await readDb();
  if (!db.subscribers) db.subscribers = [];
  
  if (!db.subscribers.some((s: any) => s.email === email)) {
    db.subscribers.push({
      id: "sub_" + Date.now(),
      email,
      name: name || "",
      ticket: ticket || "",
      date: new Date().toISOString()
    });
    await writeDb(db);
  }
  res.status(201).json({ success: true });
});

// GAS Proxy
app.post("/api/gas", async (req, res) => {
  const gasUrl = process.env.VITE_GAS_URL;
  const gasApiKey = "GRAND_CIRCLE_SECURE_API_KEY_2026";
  
  if (!gasUrl) {
    return res.status(500).json({ error: "GAS URL is not configured on the server." });
  }

  try {
    const payload = { ...req.body, apiKey: gasApiKey };
    
    // Check if tester
    const TESTER_PIN = process.env.VITE_TESTER_PIN;
    if (TESTER_PIN && payload.action === "submitTest" && payload.testerPin) {
      if (payload.testerPin === TESTER_PIN) {
        payload.isTester = true;
      }
      delete payload.testerPin; // do not send pin to GAS
    }
    
    // For protected actions, verify Firebase Auth token
    const publicActions = ["submitTest", "getStudentByShortId", "getAllStudents", "setFinalDecision", "submitManagerForm", "getPsychologistStudent", "submitPsychologistForm"];
    if (!publicActions.includes(payload.action)) {
      const authHeader = req.headers["authorization"] || "";
      const token = authHeader.replace("Bearer ", "").trim();
      
      if (!token) {
         return res.status(401).json({ error: "Unauthorized: Missing Firebase ID Token" });
      }
      
      try {
        await admin.auth().verifyIdToken(token);
      } catch(e) {
        return res.status(401).json({ error: "Unauthorized: Invalid Firebase ID Token" });
      }
    }

    const fetchRes = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const data = await fetchRes.json();
    res.json(data);
  } catch (err: any) {
    console.error("GAS Proxy error:", err);
    res.status(500).json({ error: "Failed to communicate with GAS" });
  }
});

// 3. Submit Newsletter / Subscriber Registration with validation
app.post("/api/subscribe", async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Name is required." });
    }

    const db = await readDb();
    db.subscribers = db.subscribers || [];

    // Avoid duplicate subscriptions
    const exists = db.subscribers.some((sub: any) => sub.email.toLowerCase() === email.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: "This email is already registered." });
    }

    const newSubscriber = {
      id: "sub_" + Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: (phone || "").trim(),
      timestamp: new Date().toISOString()
    };

    db.subscribers.push(newSubscriber);
    await writeDb(db);

    res.status(201).json({ success: true, message: "Thank you for subscribing!" });
  } catch (err: any) {
    res.status(500).json({ error: "Server error during subscription." });
  }
});


// ADMIN ENDPOINTS

// 1. Administrative Login
app.post("/api/admin/login", async (req, res) => {
  const { password } = req.body;
  const db = await readDb();

  const correctPassword = db.settings.adminPassword || "admin";

  if (password === correctPassword) {
    // Generate a unique session token
    const token = "token_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
    activeSessions.add(token);
    return res.json({ success: true, token });
  }

  res.status(400).json({ error: "Invalid administrative password." });
});

// 2. Administrative Check Token
app.get("/api/admin/check", async (req, res) => {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace("Bearer ", "").trim();
  
  if (token && activeSessions.has(token)) {
    return res.json({ valid: true });
  }
  res.json({ valid: false });
});

// 3. Administrative Logout
app.post("/api/admin/logout", (req, res) => {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace("Bearer ", "").trim();
  
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

// 4. Get administrative state (with subscribers & actual settings with password)
app.get("/api/admin/data", requireAuth, async (req, res) => {
  const db = await readDb();
  res.json(db);
});

// Update Administrative Settings (including password)
app.put("/api/admin/settings", requireAuth, async (req, res) => {
  const { eventDate, eventVenue, adminPassword, contactEmail, contactPhone } = req.body;
  const db = await readDb();

  db.settings = {
    eventDate: eventDate || db.settings.eventDate,
    eventVenue: eventVenue || db.settings.eventVenue,
    adminPassword: adminPassword || db.settings.adminPassword,
    contactEmail: contactEmail || db.settings.contactEmail,
    contactPhone: contactPhone || db.settings.contactPhone
  };

  await writeDb(db);
  res.json({ success: true, settings: db.settings });
});

// --- Speakers CRUD ---
app.post("/api/admin/speakers", requireAuth, async (req, res) => {
  const { name_ru, name_en, university, major_ru, major_en, admissionYear, story_ru, story_en, lectureTopic_ru, lectureTopic_en, lectureTime, colorTheme, isFeatured, avatarBase64, lat, lng } = req.body;
  
  if (!name_en || !university || !lectureTopic_en) {
    return res.status(400).json({ error: "Speaker name, university and topic are required." });
  }

  const db = await readDb();
  const nextId = String(Number(db.speakers.reduce((max: number, s: any) => Math.max(max, Number(s.id) || 0), 0)) + 1);

  const newSpeaker = {
    id: nextId,
    name_ru: name_ru || name_en,
    name_en: name_en,
    university: university,
    major_ru: major_ru || "",
    major_en: major_en || "",
    admissionYear: admissionYear || "",
    story_ru: story_ru || story_en || "",
    story_en: story_en || "",
    lectureTopic_ru: lectureTopic_ru || lectureTopic_en,
    lectureTopic_en: lectureTopic_en,
    lectureTime: lectureTime || "To Be Determined",
    colorTheme: colorTheme || "blue",
    isFeatured: isFeatured === true || isFeatured === "true",
    avatarBase64: avatarBase64 || "",
    lat: lat,
    lng: lng
  };

  db.speakers.push(newSpeaker);
  await writeDb(db);

  res.status(201).json({ success: true, speaker: newSpeaker });
});

app.post("/api/admin/speakers/bulk", requireAuth, async (req, res) => {
  const { speakers } = req.body;
  if (!Array.isArray(speakers)) {
    return res.status(400).json({ error: "Invalid data format. Expected an array of speakers." });
  }

  const db = await readDb();
  let nextId = Number(db.speakers.reduce((max: number, s: any) => Math.max(max, Number(s.id) || 0), 0)) + 1;
  const newUniversitiesAdded: string[] = [];

  if (!db.universities) db.universities = [];

  for (const speaker of speakers) {
    if (!speaker.name_en || !speaker.university || !speaker.lectureTopic_en) {
      continue; // skip invalid records
    }
    
    // Check if university exists (case insensitive comparison)
    const uniExists = db.universities.some((u: any) => u.name.toLowerCase() === speaker.university.trim().toLowerCase());
    if (!uniExists && !newUniversitiesAdded.some(nu => nu.toLowerCase() === speaker.university.trim().toLowerCase())) {
      const nextUniId = String(Number(db.universities.reduce((max: number, u: any) => Math.max(max, Number(u.id) || 0), 0)) + 1);
      db.universities.push({
        id: nextUniId,
        name: speaker.university.trim(),
        domain: "",
        logoBase64: "",
        logoScale: 1
      });
      newUniversitiesAdded.push(speaker.university.trim());
    }

    const newSpeaker = {
      id: String(nextId++),
      name_ru: speaker.name_ru || speaker.name_en,
      name_en: speaker.name_en,
      university: speaker.university.trim(),
      major_ru: speaker.major_ru || "",
      major_en: speaker.major_en || "",
      admissionYear: speaker.admissionYear || "",
      story_ru: speaker.story_ru || speaker.story_en || "",
      story_en: speaker.story_en || "",
      lectureTopic_ru: speaker.lectureTopic_ru || speaker.lectureTopic_en,
      lectureTopic_en: speaker.lectureTopic_en,
      lectureTime: speaker.lectureTime || "To Be Determined",
      colorTheme: speaker.colorTheme || "blue",
      isFeatured: speaker.isFeatured === true || speaker.isFeatured === "true" || speaker.isFeatured === "TRUE" || speaker.isFeatured === "1",
      avatarBase64: "",
      lat: speaker.lat || "",
      lng: speaker.lng || ""
    };
    db.speakers.push(newSpeaker);
  }

  await writeDb(db);
  res.status(201).json({ success: true, count: speakers.length, newUniversitiesAdded });
});

app.put("/api/admin/speakers/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  const index = db.speakers.findIndex((s: any) => s.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Speaker not found." });
  }

  const { name_ru, name_en, university, major_ru, major_en, admissionYear, story_ru, story_en, lectureTopic_ru, lectureTopic_en, lectureTime, colorTheme, isFeatured, avatarBase64, lat, lng } = req.body;

  db.speakers[index] = {
    ...db.speakers[index],
    name_ru: name_ru !== undefined ? name_ru : db.speakers[index].name_ru,
    name_en: name_en !== undefined ? name_en : db.speakers[index].name_en,
    university: university !== undefined ? university : db.speakers[index].university,
    major_ru: major_ru !== undefined ? major_ru : db.speakers[index].major_ru,
    major_en: major_en !== undefined ? major_en : db.speakers[index].major_en,
    admissionYear: admissionYear !== undefined ? admissionYear : db.speakers[index].admissionYear,
    story_ru: story_ru !== undefined ? story_ru : db.speakers[index].story_ru,
    story_en: story_en !== undefined ? story_en : db.speakers[index].story_en,
    lectureTopic_ru: lectureTopic_ru !== undefined ? lectureTopic_ru : db.speakers[index].lectureTopic_ru,
    lectureTopic_en: lectureTopic_en !== undefined ? lectureTopic_en : db.speakers[index].lectureTopic_en,
    lectureTime: lectureTime !== undefined ? lectureTime : db.speakers[index].lectureTime,
    colorTheme: colorTheme !== undefined ? colorTheme : db.speakers[index].colorTheme,
    isFeatured: isFeatured !== undefined ? (isFeatured === true || isFeatured === "true") : db.speakers[index].isFeatured,
    avatarBase64: avatarBase64 !== undefined ? avatarBase64 : db.speakers[index].avatarBase64,
    lat: lat !== undefined ? lat : db.speakers[index].lat,
    lng: lng !== undefined ? lng : db.speakers[index].lng
  };

  await writeDb(db);
  res.json({ success: true, speaker: db.speakers[index] });
});

app.delete("/api/admin/speakers/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  
  if (db.speakers) {
    db.speakers = db.speakers.filter((s: any) => String(s.id) !== String(id));
  }
  await writeDb(db);
  res.json({ success: true });
});

// --- Schedule / Program CRUD ---
app.post("/api/admin/program", requireAuth, async (req, res) => {
  const { time, title_ru, title_en, description_ru, description_en, speakerId } = req.body;

  if (!time || !title_en) {
    return res.status(400).json({ error: "Time slots and titles are required." });
  }

  const db = await readDb();
  const nextId = "s_" + Date.now();

  const newSlot = {
    id: nextId,
    time: time,
    title_ru: title_ru || title_en,
    title_en: title_en,
    description_ru: description_ru || description_en || "",
    description_en: description_en || "",
    speakerId: speakerId || ""
  };

  db.program.push(newSlot);
  await writeDb(db);
  res.status(201).json({ success: true, slot: newSlot });
});

app.put("/api/admin/program/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  const index = db.program.findIndex((slot: any) => slot.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Program block not found." });
  }

  const { time, title_ru, title_en, description_ru, description_en, speakerId } = req.body;

  db.program[index] = {
    ...db.program[index],
    time: time !== undefined ? time : db.program[index].time,
    title_ru: title_ru !== undefined ? title_ru : db.program[index].title_ru,
    title_en: title_en !== undefined ? title_en : db.program[index].title_en,
    description_ru: description_ru !== undefined ? description_ru : db.program[index].description_ru,
    description_en: description_en !== undefined ? description_en : db.program[index].description_en,
    speakerId: speakerId !== undefined ? speakerId : db.program[index].speakerId
  };

  await writeDb(db);
  res.json({ success: true, slot: db.program[index] });
});

app.delete("/api/admin/program/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  
  if (db.program) {
    db.program = db.program.filter((p: any) => String(p.id) !== String(id));
  }
  await writeDb(db);
  res.status(200).json({ success: true });
});

// --- Universities CRUD ---

app.post("/api/admin/universities", requireAuth, async (req, res) => {
  const db = await readDb();
  if (!db.universities) db.universities = [];
  
  const newUniversity = {
    id: "uni_" + Date.now(),
    name: req.body.name || "",
    domain: req.body.domain || "",
    logoBase64: req.body.logoBase64 || ""
  };
  
  db.universities.push(newUniversity);
  await writeDb(db);
  res.status(201).json({ success: true, university: newUniversity });
});

app.put("/api/admin/universities/:id", requireAuth, async (req, res) => {
  const db = await readDb();
  if (!db.universities) db.universities = [];
  const idx = db.universities.findIndex((u: any) => String(u.id) === String(req.params.id));
  if (idx !== -1) {
    db.universities[idx] = { ...db.universities[idx], ...req.body };
    await writeDb(db);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "University not found" });
  }
});

app.delete("/api/admin/universities/:id", requireAuth, async (req, res) => {
  const db = await readDb();
  if (!db.universities) db.universities = [];
  db.universities = db.universities.filter((u: any) => String(u.id) !== String(req.params.id));
  await writeDb(db);
  res.json({ success: true });
});

// --- Partners CRUD ---
app.post("/api/admin/partners", requireAuth, async (req, res) => {
  const { name, role_ru, role_en, tier, url, logoUrl, logoBase64 } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Partner name is required." });
  }

  const db = await readDb();
  const nextId = "p_" + Date.now();

  const newPartner = {
    id: nextId,
    name: name,
    role_ru: role_ru || "",
    role_en: role_en || "",
    tier: tier || "partner",
    url: url || "",
    logoUrl: logoUrl || "",
    logoBase64: logoBase64 || ""
  };

  db.partners.push(newPartner);
  await writeDb(db);
  res.status(201).json({ success: true, partner: newPartner });
});

app.put("/api/admin/partners/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  const index = db.partners.findIndex((p: any) => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Partner not found." });
  }

  const { name, role_ru, role_en, tier, url, logoUrl, logoBase64 } = req.body;

  db.partners[index] = {
    ...db.partners[index],
    name: name !== undefined ? name : db.partners[index].name,
    role_ru: role_ru !== undefined ? role_ru : db.partners[index].role_ru,
    role_en: role_en !== undefined ? role_en : db.partners[index].role_en,
    tier: tier !== undefined ? tier : db.partners[index].tier,
    url: url !== undefined ? url : db.partners[index].url,
    logoUrl: logoUrl !== undefined ? logoUrl : db.partners[index].logoUrl,
    logoBase64: logoBase64 !== undefined ? logoBase64 : db.partners[index].logoBase64
  };

  await writeDb(db);
  res.json({ success: true, partner: db.partners[index] });
});

app.delete("/api/admin/partners/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();

  if (db.partners) {
    db.partners = db.partners.filter((p: any) => String(p.id) !== String(id));
  }
  await writeDb(db);
  res.json({ success: true });
});

// --- Tickets CRUD ---
app.post("/api/admin/tickets", requireAuth, async (req, res) => {
  const { name_ru, name_en, name_kg, price, features_ru, features_en, features_kg, url } = req.body;
  if (!name_en) return res.status(400).json({ error: "Ticket name is required." });
  
  const db = await readDb();
  const nextId = "t_" + Date.now();
  db.tickets.push({
    id: nextId, name_ru, name_en, name_kg, price, features_ru, features_en, features_kg, url
  });
  await writeDb(db);
  res.status(201).json({ success: true });
});



app.delete("/api/admin/tickets/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  if (db.tickets) {
    db.tickets = db.tickets.filter((t: any) => String(t.id) !== String(id));
  }
  await writeDb(db);
  res.json({ success: true });
});

// --- Metrics CRUD ---
app.post("/api/admin/metrics", requireAuth, async (req, res) => {
  const { value, label_ru, label_en, sublabel_ru, sublabel_en, order } = req.body;
  if (!value || !label_en) {
    return res.status(400).json({ error: "Value and English Label are required." });
  }

  const db = await readDb();
  if (!db.metrics) db.metrics = [];
  
  const nextId = "m_" + Date.now();
  const newMetric = {
    id: nextId,
    value,
    label_ru: label_ru || label_en,
    label_en,
    sublabel_ru: sublabel_ru || "",
    sublabel_en: sublabel_en || "",
    order: order || db.metrics.length + 1
  };

  db.metrics.push(newMetric);
  db.metrics.sort((a: any, b: any) => a.order - b.order);
  await writeDb(db);
  res.status(201).json({ success: true, metric: newMetric });
});

app.put("/api/admin/metrics/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  if (!db.metrics) db.metrics = [];
  
  const index = db.metrics.findIndex((m: any) => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Metric not found." });
  }

  const { value, label_ru, label_en, sublabel_ru, sublabel_en, order } = req.body;

  db.metrics[index] = {
    ...db.metrics[index],
    value: value !== undefined ? value : db.metrics[index].value,
    label_ru: label_ru !== undefined ? label_ru : db.metrics[index].label_ru,
    label_en: label_en !== undefined ? label_en : db.metrics[index].label_en,
    sublabel_ru: sublabel_ru !== undefined ? sublabel_ru : db.metrics[index].sublabel_ru,
    sublabel_en: sublabel_en !== undefined ? sublabel_en : db.metrics[index].sublabel_en,
    order: order !== undefined ? order : db.metrics[index].order
  };

  db.metrics.sort((a: any, b: any) => a.order - b.order);
  await writeDb(db);
  res.json({ success: true, metric: db.metrics[index] });
});

app.delete("/api/admin/metrics/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  if (!db.metrics) db.metrics = [];
  
  db.metrics = db.metrics.filter((m: any) => m.id !== id);
  await writeDb(db);
  res.json({ success: true });
});

// --- Tickets Configuration ---
app.put("/api/admin/tickets/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const db = await readDb();
  const index = db.tickets.findIndex((t: any) => t.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Ticket category not found." });
  }

  const { name_ru, name_en, price, features_ru, features_en, url, utm_source, utm_medium, utm_campaign } = req.body;

  db.tickets[index] = {
    ...db.tickets[index],
    name_ru: name_ru !== undefined ? name_ru : db.tickets[index].name_ru,
    name_en: name_en !== undefined ? name_en : db.tickets[index].name_en,
    price: price !== undefined ? price : db.tickets[index].price,
    features_ru: features_ru !== undefined ? (Array.isArray(features_ru) ? features_ru : JSON.parse(features_ru)) : db.tickets[index].features_ru,
    features_en: features_en !== undefined ? (Array.isArray(features_en) ? features_en : JSON.parse(features_en)) : db.tickets[index].features_en,
    url: url !== undefined ? url : db.tickets[index].url,
    utm_source: utm_source !== undefined ? utm_source : db.tickets[index].utm_source,
    utm_medium: utm_medium !== undefined ? utm_medium : db.tickets[index].utm_medium,
    utm_campaign: utm_campaign !== undefined ? utm_campaign : db.tickets[index].utm_campaign
  };

  await writeDb(db);
  res.json({ success: true, ticket: db.tickets[index] });
});

// Export Subscribers to CSV
app.get("/api/admin/subscribers/export", requireAuth, async (req, res) => {
  try {
    const db = await readDb();
    const subs = db.subscribers || [];

    // Construct CSV content
    let csvContent = '\uFEFF'; // Add BOM for excel support
    csvContent += "ID,Name,Email,Phone,Registration Date (UTC)\n";

    subs.forEach((s: any) => {
      // Escape potential quotes in values
      const name = `"${(s.name || "").replace(/"/g, '""')}"`;
      const email = `"${(s.email || "").replace(/"/g, '""')}"`;
      const phone = `"${(s.phone || "").replace(/"/g, '""')}"`;
      const date = `"${new Date(s.timestamp || "").toISOString()}"`;
      csvContent += `${s.id},${name},${email},${phone},${date}\n`;
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=educational_forum_mailing_list.csv");
    res.status(200).send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to compile mailing base database." });
  }
});


// Dev vs Production Setup for Vite Frontend Assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully activated on http://localhost:${PORT}`);
  });
}

// Only start the server locally. Vercel will import the app and use it as a serverless function.
if (!process.env.VERCEL) {
  startServer();
}

export default app;
