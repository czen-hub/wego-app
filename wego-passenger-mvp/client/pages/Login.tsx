import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Zap, AlertCircle, Loader2, Check, ArrowLeft } from "lucide-react";

type Mode = "signin" | "signup" | "reset";

const inputCls =
  "w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

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
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-[430px] mx-auto">

      {/* ── BRAND HERO ── */}
      <div className="flex flex-col items-center pt-14 pb-8 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-5 shadow-[0_4px_24px_rgba(37,99,235,0.35)]">
          <Zap size={28} strokeWidth={2.5} className="text-white" />
        </div>
        <h1 className="text-[2.2rem] font-bold text-foreground leading-none tracking-tight">
          WeGo
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          The cooperative rideshare
        </p>
        <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
          <span>No surge pricing</span>
          <span className="w-0.5 h-0.5 rounded-full bg-border flex-shrink-0" />
          <span>88% to drivers</span>
          <span className="w-0.5 h-0.5 rounded-full bg-border flex-shrink-0" />
          <span>Coop-owned</span>
        </div>
      </div>

      {/* ── FORM CARD ── */}
      <div className="flex-1 px-5 pb-10">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-float">

          {/* ── Mode switcher ── */}
          {mode !== "reset" && (
            <div className="flex bg-background border border-border rounded-xl p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`flex-1 py-2 text-sm font-semibold rounded-[10px] transition-all ${
                  mode === "signin"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`flex-1 py-2 text-sm font-semibold rounded-[10px] transition-all ${
                  mode === "signup"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* ── Reset back button ── */}
          {mode === "reset" && (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={15} />
              Back to sign in
            </button>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="flex items-start gap-2.5 bg-destructive/8 border border-destructive/20 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-destructive leading-relaxed">{error}</p>
            </div>
          )}

          {/* ── Reset success ── */}
          {resetSent && (
            <div className="flex items-start gap-2.5 bg-primary/8 border border-primary/20 rounded-xl px-3 py-2.5">
              <Check size={14} className="text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-primary font-medium">
                Reset link sent — check your inbox.
              </p>
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "signup" && (
              <>
                <Field label="Full Name">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Your name"
                    className={inputCls}
                  />
                </Field>
                <Field label="Phone Number">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="+1 (415) 555-0100"
                    className={inputCls}
                  />
                </Field>
              </>
            )}

            {mode === "reset" && (
              <p className="text-sm text-muted-foreground">
                Enter your email and we'll send a reset link.
              </p>
            )}

            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@email.com"
                className={inputCls}
              />
            </Field>

            {mode !== "reset" && (
              <Field label="Password">
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={8}
                    className={`${inputCls} pr-11`}
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
              </Field>
            )}

            {mode === "signin" && (
              <div className="text-right -mt-1">
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60 btn-glow mt-1"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {mode === "signin"
                ? "Sign In"
                : mode === "signup"
                ? "Create Account"
                : "Send Reset Link"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-5 px-4 leading-relaxed">
          WeGo Cooperative — Driver-owned. No surge pricing, ever.
        </p>
      </div>
    </div>
  );
}
