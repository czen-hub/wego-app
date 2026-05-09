import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Car, AlertCircle, Loader2 } from "lucide-react";

type Mode = "signin" | "signup" | "reset";

export default function Login() {
  const { signIn, signUp, resetPassword, error, clearError, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (m: Mode) => {
    clearError();
    setResetSent(false);
    setMode(m);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else if (mode === "signup") {
        await signUp(email, password, name, phone);
      } else {
        await resetPassword(email);
        setResetSent(true);
      }
    } catch {
      // error already set in context
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-3">
            <Car size={32} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">WeGo Driver</h1>
          <p className="text-sm text-muted-foreground mt-1">Driver-owned cooperative</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            {mode === "signin" ? "Sign in to your account" : mode === "signup" ? "Create driver account" : "Reset password"}
          </h2>

          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2.5">
              <AlertCircle size={15} className="text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {resetSent && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2.5">
              <p className="text-xs text-primary font-medium">Reset link sent. Check your email.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Tenzin C."
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="+1 (415) 555-0100"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@email.com"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {mode !== "reset" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={8}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
            </button>
          </form>

          {/* Footer links */}
          <div className="pt-1 space-y-2 text-center">
            {mode === "signin" && (
              <>
                <button onClick={() => switchMode("reset")} className="text-xs text-primary hover:underline block w-full">
                  Forgot password?
                </button>
                <p className="text-xs text-muted-foreground">
                  New driver?{" "}
                  <button onClick={() => switchMode("signup")} className="text-primary hover:underline font-medium">
                    Create account
                  </button>
                </p>
              </>
            )}
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                Already have an account?{" "}
                <button onClick={() => switchMode("signin")} className="text-primary hover:underline font-medium">
                  Sign in
                </button>
              </p>
            )}
            {mode === "reset" && (
              <button onClick={() => switchMode("signin")} className="text-xs text-primary hover:underline">
                Back to sign in
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-6 px-4">
          WeGo Cooperative — Driver-owned rideshare platform. Keep 88% of every fare.
        </p>
      </div>
    </div>
  );
}
