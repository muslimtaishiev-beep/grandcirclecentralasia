import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBefuNSd2j9CJJ92EWcg0am9s3zBSSHS4Y",
  authDomain: "study-64ebf.firebaseapp.com",
  projectId: "study-64ebf",
  storageBucket: "study-64ebf.firebasestorage.app",
  messagingSenderId: "53040624855",
  appId: "1:53040624855:web:ec3ffb04513bc2237fac92"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const usersSnap = await getDocs(collection(db, 'users'));
  const users = usersSnap.docs.map(d => ({ ...d.data(), id: d.id }));
  console.log("Registered users:");
  users.forEach(u => console.log(`- ID: ${u.id}, Name: ${u.firstName} ${u.lastName}, Email: ${u.email}`));

  const decisionsSnap = await getDocs(collection(db, 'decisions'));
  const decisions = decisionsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
  
  console.log("\nSimulating merge for registered users:");
  for (const ru of users) {
    const fullNameForward = `${ru.firstName.trim().toLowerCase()} ${ru.lastName.trim().toLowerCase()}`;
    const fullNameReverse = `${ru.lastName.trim().toLowerCase()} ${ru.firstName.trim().toLowerCase()}`;
    
    console.log(`Checking match for user: ${ru.firstName} ${ru.lastName}`);
    const matchForward = decisions.find(d => d.id === fullNameForward);
    const matchReverse = decisions.find(d => d.id === fullNameReverse);
    
    if (matchForward) console.log(`  -> Matched FORWARD: ${matchForward.id}`);
    else if (matchReverse) console.log(`  -> Matched REVERSE: ${matchReverse.id}`);
    else console.log(`  -> NO MATCH FOUND in decisions (Searched '${fullNameForward}' and '${fullNameReverse}')`);
  }
  process.exit(0);
}

check();
