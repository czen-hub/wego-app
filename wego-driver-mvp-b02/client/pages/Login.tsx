import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Car, AlertCircle, Loader2, CheckCircle } from "lucide-react";

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
        <div className="w-8 h-8 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const inputClass = "w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-12 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center mb-4 shadow-[0_8px_32px_hsl(var(--primary)/0.4)]">
            <Car size={36} className="text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">WeGo Driver</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Driver-owned cooperative</p>
          <div className="flex items-center gap-4 mt-4">
            {["88% to drivers", "No surge pricing", "Coop-owned"].map((tag) => (
              <span key={tag} className="text-[10px] font-semibold text-primary/80 uppercase tracking-wide">{tag}</span>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-float">
          <h2 className="text-lg font-bold text-foreground">
            {mode === "signin" ? "Sign in to your account" : mode === "signup" ? "Create driver account" : "Reset your password"}
          </h2>

          {error && (
            <div className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
              <AlertCircle size={15} className="text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-destructive leading-relaxed">{error}</p>
            </div>
          )}

          {resetSent && (
            <div className="flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
              <CheckCircle size={15} className="text-primary flex-shrink-0" />
              <p className="text-xs text-primary font-medium">Reset link sent — check your email.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Your full name"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="+1 (415) 555-0100"
                    className={inputClass}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@email.com"
                className={inputClass}
              />
            </div>

            {mode !== "reset" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={8}
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary text-primary-foreground rounded-2xl py-3.5 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60 btn-glow mt-2"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
            </button>
          </form>

          {/* Footer links */}
          <div className="space-y-2 text-center border-t border-border pt-4">
            {mode === "signin" && (
              <>
                <button onClick={() => switchMode("reset")} className="text-xs text-primary font-semibold block w-full">
                  Forgot password?
                </button>
                <p className="text-xs text-muted-foreground">
                  New driver?{" "}
                  <button onClick={() => switchMode("signup")} className="text-primary font-semibold">
                    Create account
                  </button>
                </p>
              </>
            )}
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                Already have an account?{" "}
                <button onClick={() => switchMode("signin")} className="text-primary font-semibold">
                  Sign in
                </button>
              </p>
            )}
            {mode === "reset" && (
              <button onClick={() => switchMode("signin")} className="text-xs text-primary font-semibold">
                Back to sign in
              </button>
            )}
          </div>
        </div>

        {/* Cooperative badge */}
        <div className="mt-5 flex items-center justify-center gap-2 bg-primary/5 border border-primary/15 rounded-xl px-4 py-2.5">
          <Car size={13} className="text-primary flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground">Keep <span className="text-primary font-bold">88%</span> of every fare — driver-owned, always.</p>
        </div>
      </div>
    </div>
  );
}
