import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/firebase";
import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import Overview from "@/pages/Overview";
import Rides from "@/pages/Rides";
import History from "@/pages/History";
import Drivers from "@/pages/Drivers";
import Disputes from "@/pages/Disputes";
import Payouts from "@/pages/Payouts";
import Promotions from "@/pages/Promotions";

type AuthState = "loading" | "unauthenticated" | "authenticated";

export default function App() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setAuthState("unauthenticated");
        return;
      }
      // Verify admin status
      const snap = await getDoc(doc(db, "admins", u.uid));
      if (snap.exists()) {
        setUser(u);
        setAuthState("authenticated");
      } else {
        await auth.signOut();
        setUser(null);
        setAuthState("unauthenticated");
      }
    });
  }, []);

  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {authState === "unauthenticated" ? (
          <>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          <>
            <Route element={<Layout user={user!} />}>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/rides" element={<Rides />} />
              <Route path="/history" element={<History />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/disputes" element={<Disputes />} />
              <Route path="/payouts" element={<Payouts />} />
              <Route path="/promotions" element={<Promotions />} />
            </Route>
            <Route path="/login" element={<Navigate to="/overview" replace />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
