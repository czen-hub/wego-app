import { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface PassengerProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: "passenger";
  rating: number;
  totalRides: number;
}

interface AuthContextType {
  user: User | null;
  profile: PassengerProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, phone: string) => Promise<void>;
  logOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PassengerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, "passengers", firebaseUser.uid));
          if (snap.exists()) {
            const data = snap.data();
            setProfile({
              uid: firebaseUser.uid,
              name: data.name ?? "",
              email: data.email ?? firebaseUser.email ?? "",
              phone: data.phone ?? "",
              role: "passenger",
              rating: data.rating ?? 5.0,
              totalRides: data.totalRides ?? 0,
            });
          }
        } catch (err) {
          console.error("Passenger profile load failed:", err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      setError(friendlyError(msg));
      throw err;
    }
  };

  const signUp = async (email: string, password: string, name: string, phone: string) => {
    setError(null);
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "passengers", newUser.uid), {
        name,
        email,
        phone,
        role: "passenger",
        rating: 5.0,
        totalRides: 0,
        createdAt: serverTimestamp(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign up failed";
      setError(friendlyError(msg));
      throw err;
    }
  };

  const logOut = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Reset failed";
      setError(friendlyError(msg));
      throw err;
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, signIn, signUp, logOut, resetPassword, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

function friendlyError(msg: string): string {
  if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found"))
    return "Incorrect email or password.";
  if (msg.includes("email-already-in-use")) return "An account with this email already exists.";
  if (msg.includes("weak-password")) return "Password must be at least 6 characters.";
  if (msg.includes("invalid-email")) return "Please enter a valid email address.";
  if (msg.includes("network-request-failed")) return "Network error. Check your connection.";
  if (msg.includes("too-many-requests")) return "Too many attempts. Please try again later.";
  return "Something went wrong. Please try again.";
}
