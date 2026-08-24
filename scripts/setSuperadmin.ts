import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env variables
dotenv.config({ path: path.join(__dirname, '../.env') });

try {
  let serviceAccount;
  const keyPath = path.join(__dirname, '../serviceAccountKey.json');
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log("Using FIREBASE_SERVICE_ACCOUNT from .env");
  } else if (fs.existsSync(keyPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    console.log("Using serviceAccountKey.json");
  } else {
    throw new Error("No service account found in .env or serviceAccountKey.json");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  console.error("Error initializing Firebase Admin:", e);
  process.exit(1);
}

const email = process.argv[2];

if (!email) {
  console.log("Usage: npx tsx scripts/setSuperadmin.ts <email>");
  process.exit(1);
}

async function makeSuperadmin(userEmail: string) {
  try {
    let user;
    try {
      user = await admin.auth().getUserByEmail(userEmail);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        console.log(`User ${userEmail} not found. Creating new user...`);
        user = await admin.auth().createUser({
          email: userEmail,
          password: 'Password123!', // default password
          emailVerified: true
        });
        console.log(`✅ Created user ${userEmail} with password: Password123!`);
      } else {
        throw e;
      }
    }

    await admin.auth().setCustomUserClaims(user.uid, {
      ...user.customClaims,
      isSuperadmin: true,
      globalRole: "superadmin"
    });
    
    // Create RBAC document in Firestore (as requested by user)
    await admin.firestore().collection("superadmins").doc(user.uid).set({
      email: userEmail,
      globalRole: "superadmin",
      isActive: true,
      grantedAt: new Date().toISOString()
    });

    console.log(`✅ Success! User ${userEmail} (UID: ${user.uid}) is now a Superadmin in both Token and Firestore DB.`);
    console.log(`⚠️ They must logout and login again for the token to update.`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error setting superadmin role for ${userEmail}:`, error);
    process.exit(1);
  }
}

makeSuperadmin(email);
