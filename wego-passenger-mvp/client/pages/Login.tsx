import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Zap, AlertCircle, Loader2, Check } from "lucide-react";

type Mode = "signin" | "signup" | "reset";

const VALUE_PROPS = ["No surge pricing", "88% to drivers", "Driver-owned co-op"];

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
      // error set in context
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
    <div className="min-h-screen bg-background flex flex-col max-w-[430px] mx-auto">

      {/* ── BRAND HERO ── */}
      <div className="relative overflow-hidden px-6 pt-16 pb-10 flex flex-col items-center text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div
            className="w-20 h-20 rounded-[22px] bg-primary flex items-center justify-center mx-auto mb-4 shadow-[0_8px_32px_rgba(245,158,11,0.40)]"
          >
            <Zap size={38} strokeWidth={2.5} className="text-white" />
          </div>
          <h1 className="text-[2.6rem] font-bold text-foreground leading-none mb-2 tracking-tight">
            WeGo
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Rides that are fair for everyone
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {VALUE_PROPS.map((val) => (
              <span
                key={val}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/25 rounded-full text-xs font-semibold text-primary"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                {val}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── FORM CARD ── */}
      <div className="flex-1 px-5 pb-10">
        <div
          className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-float"
        >
          <h2 className="text-lg font-semibold text-foreground">
            {mode === "signin"
              ? "Sign in to your account"
              : mode === "signup"
              ? "Create your account"
              : "Reset password"}
          </h2>

          {error && (
            <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5">
              <AlertCircle size={15} className="text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {resetSent && (
            <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2.5">
              <Check size={15} className="text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-primary font-medium">Reset link sent. Check your email.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Your name"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="+1 (415) 555-0100"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@email.com"
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>

            {mode !== "reset" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={8}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
              className={`w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 ${!busy ? "btn-glow" : ""}`}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {mode === "signin"
                ? "Sign In"
                : mode === "signup"
                ? "Create Account"
                : "Send Reset Link"}
            </button>
          </form>

          <div className="pt-1 space-y-2 text-center">
            {mode === "signin" && (
              <>
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  className="text-xs text-primary hover:underline block w-full"
                >
                  Forgot password?
                </button>
                <p className="text-xs text-muted-foreground">
                  New to WeGo?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className="text-primary hover:underline font-semibold"
                  >
                    Create account
                  </button>
                </p>
              </>
            )}
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="text-primary hover:underline font-semibold"
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === "reset" && (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="text-xs text-primary hover:underline"
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-5 px-4 leading-relaxed">
          WeGo Cooperative — Driver-owned platform. No surge pricing, ever.
        </p>
      </div>
    </div>
  );
}
