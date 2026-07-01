import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
export const db = getFirestore(app);
