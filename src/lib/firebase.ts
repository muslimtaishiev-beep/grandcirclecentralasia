import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

// Replace these values with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyBefuNSd2j9CJJ92EWcg0am9s3zBSSHS4Y",
  authDomain: "study-64ebf.firebaseapp.com",
  projectId: "study-64ebf",
  storageBucket: "study-64ebf.firebasestorage.app",
  messagingSenderId: "53040624855",
  appId: "1:53040624855:web:ec3ffb04513bc2237fac92",
  measurementId: "G-L1SZKG6Y2J"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Safari (and browsers behind certain corporate proxies/firewalls) can reject the
// default fetch-based WebChannel stream Firestore uses for onSnapshot listeners with
// a browser-level "access control checks" error — not a CORS misconfiguration on our
// side, but the streaming transport itself being blocked. autoDetectLongPolling falls
// back to classic long-polling (plain XHR, not the streaming fetch) transparently when
// that happens, without forcing the slower transport for every client.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
