import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function check() {
  const usersSnap = await db.collection("users").get();
  console.log("USERS:");
  usersSnap.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, data.firstName, data.lastName, data.decisionStatus);
  });

  const decisionsSnap = await db.collection("decisions").get();
  console.log("DECISIONS:");
  decisionsSnap.forEach(doc => {
    console.log(doc.id, doc.data().decisionStatus);
  });
}

check().catch(console.error);
