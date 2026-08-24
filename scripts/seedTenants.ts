import admin from 'firebase-admin';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

try {
  let serviceAccount;
  const keyPath = path.join(__dirname, '../serviceAccountKey.json');
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else if (fs.existsSync(keyPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  } else {
    throw new Error("No service account found");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (e) {
  console.error("Error initializing Firebase Admin:", e);
  process.exit(1);
}

const db = admin.firestore();

async function seedTenants() {
  console.log("🌱 Seeding tenants into Firestore...");

  const tenants = [
    {
      id: "org_future_leaders",
      name: "Академия Будущих Лидеров",
      plan: "enterprise",
      status: "active",
      limits: { maxUsers: 10000, storageGB: 1000 },
      metrics: { activeUsers: 842, storageUsed: 120, lastActiveAt: new Date().toISOString() },
      features: { customDomain: true, whiteLabel: true, apiAccess: true, sso: true },
      createdAt: new Date().toISOString()
    },
    {
      id: "org_math_geniuses",
      name: "Школа Точных Наук «Архимед»",
      plan: "business",
      status: "active",
      limits: { maxUsers: 500, storageGB: 100 },
      metrics: { activeUsers: 310, storageUsed: 45, lastActiveAt: new Date().toISOString() },
      features: { customDomain: false, whiteLabel: true, apiAccess: false, sso: false },
      createdAt: new Date().toISOString()
    },
    {
      id: "org_english_first",
      name: "English First Academy",
      plan: "starter",
      status: "suspended",
      limits: { maxUsers: 50, storageGB: 10 },
      metrics: { activeUsers: 45, storageUsed: 8, lastActiveAt: new Date().toISOString() },
      features: { customDomain: false, whiteLabel: false, apiAccess: false, sso: false },
      createdAt: new Date().toISOString()
    }
  ];

  for (const t of tenants) {
    await db.collection("tenants").doc(t.id).set(t);
    console.log(`✅ Seeded tenant: ${t.name}`);
  }

  console.log("🎉 All tenants seeded successfully!");
  process.exit(0);
}

seedTenants().catch(console.error);
