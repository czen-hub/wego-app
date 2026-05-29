import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAg79MjNqwS1Xn3hTNCJoIjpKdcYWtw6Ak",
  authDomain: "wego-app-53f6d.firebaseapp.com",
  projectId: "wego-app-53f6d",
  storageBucket: "wego-app-53f6d.firebasestorage.app",
  messagingSenderId: "1094223622724",
  appId: "1:1094223622724:web:0857b6557e931d99fec211",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
