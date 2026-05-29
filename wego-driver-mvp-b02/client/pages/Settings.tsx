import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Moon, Sun, Bell, BellOff, Car, Map, Shield, ChevronRight, ChevronLeft,
  LogOut, User, Phone, Mail, Star, HelpCircle, FileText,
  Camera, Upload, CheckCircle, Eye, EyeOff, Lock, Pencil, Users, Copy, Banknote, ClipboardCheck
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import BottomSheet from "@/components/BottomSheet";
import { saveBankAccount, getBankAccount, type BankAccount } from "@/lib/db";

// ─── Shared sub-components ────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      aria-label={checked ? "Turn off" : "Turn on"}
      className={`relative w-11 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${
        checked ? "translate-x-[22px]" : "translate-x-1"
      }`} />
    </button>
  );
}

function Row({
  icon, label, sublabel, right, onClick, danger,
}: {
  icon: React.ReactNode; label: string; sublabel?: string;
  right?: React.ReactNode; onClick?: () => void; danger?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 py-3 pl-4 pr-4 ${
        onClick ? "hover:bg-muted/30 active:bg-muted/50 cursor-pointer" : ""
      }`}
    >
      <div className={`flex-shrink-0 ${danger ? "text-destructive" : "text-muted-foreground"}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight ${danger ? "text-destructive" : "text-foreground"}`}>{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{sublabel}</p>}
      </div>
      <div className="flex-shrink-0 ml-2">
        {right !== undefined ? right : onClick && !danger ? <ChevronRight size={16} className="text-muted-foreground" /> : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1.5">{title}</p>
      <div className="bg-card border border-border rounded-xl divide-y divide-border">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SaveButton({ onClick, label = "Save Changes" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-2xl active:scale-95 transition-transform btn-glow"
    >
      {label}
    </button>
  );
}

function HelpFaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-background border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left">
        <p className="text-sm font-medium text-foreground leading-snug">{q}</p>
        <ChevronRight size={14} className={`text-muted-foreground flex-shrink-0 mt-0.5 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line pt-3">{a}</p>
        </div>
      )}
    </div>
  );
}

function UploadBox({
  label, preview, accept, onFile,
}: {
  label: string; preview: string | null; accept: string;
  onFile: (f: File, url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file, URL.createObjectURL(file));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <img src={preview} alt="Uploaded document" className="w-full h-40 object-cover" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 right-2 bg-card/90 border border-border px-3 py-1.5 rounded-lg text-xs font-semibold text-foreground flex items-center gap-1.5 backdrop-blur-sm"
          >
            <Pencil size={12} /> Replace
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-1 flex flex-col items-center gap-2 py-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
          >
            <Upload size={20} />
            <span className="text-xs font-medium">Upload File</span>
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex-1 flex flex-col items-center gap-2 py-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
          >
            <Camera size={20} />
            <span className="text-xs font-medium">Take Photo</span>
          </button>
        </div>
      )}
      {/* On mobile, accept="image/*" prompts camera or gallery natively */}
      <input ref={inputRef} type="file" accept={accept} aria-label={`Upload ${label}`} className="hidden" onChange={handleChange} />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type ModalId =
  | "editProfile" | "vehicleInfo" | "insurance" | "inspection"
  | "phone" | "email" | "password" | "help" | "payout"
  | "agreement" | "privacy" | "verification" | null;

const DRIVER_FAQS = [
  { q: "What are the cancellation fees if a passenger cancels?", a: "You are protected by distance-based cancellation fees that go 100% to you — WeGo keeps none of it.\n\n• Free: passenger cancels within 5 min of booking (driver not yet dispatched)\n• $5.00: passenger cancels while you are nearby (< 5 miles en route)\n• $9.00: passenger cancels while you are 5–10 miles en route\n• $14.00: passenger cancels after you drove 10+ miles including highway\n• Distance fee + $3.00: passenger cancels after you have already arrived (e.g. drove 10+ miles = $14 + $3 = $17)\n\nFees are credited to your account within 24 hours." },
  { q: "What do I do if a passenger is a no-show?", a: "After arriving at the pickup location you have a free wait window:\n• 5 minutes for standard on-demand rides\n• 8 minutes for advance/Reserve bookings\n\nAfter the free window, a $0.50/min wait meter runs for up to 2 more minutes. If the passenger still hasn't appeared, tap 'Passenger No-Show' in the app. You'll receive the full arrived cancellation fee (distance fee + $3.00) and the ride is closed. You are never penalised for a no-show — 100% of the fee goes to you." },
  { q: "What is my take-home per ride?", a: "You keep 88% of every fare. WeGo takes 12% — this covers the app, dispatch infrastructure, and cooperative operations (pension fund, insurance pool, AV fleet).\n\nExample: $65 fare → you earn $57.20. Compare to Corp where drivers typically keep ~45% effective pay after all platform deductions — WeGo pays you roughly 96% more per dollar of gross fare." },
  { q: "Do I earn extra for advance/scheduled rides?", a: "Yes — every Reserve (advance booking) ride includes a flat $8.00 scheduling bonus that goes 100% to you. WeGo keeps none of it.\n\nExample: $38 base fare → you earn $33.44 (88%) + $8.00 advance fee = $41.44 total.\n\nPassengers still pay $15–25 less than they would on Corp Reserve, so drivers get better booking volume without sacrificing pay.\n\nThe advance fee is your compensation for committing your schedule to a specific pickup time." },
  { q: "Do I get paid for mid-trip stops or extra wait time?", a: "Yes — both are compensated 100% and go directly to you.\n\n• Stop fee: $2.00 per stop when a passenger requests a mid-route stop (e.g. coffee, ATM). Tap 'Log Passenger Stop' in the app each time.\n\n• Wait meter: If a passenger takes longer than the free wait window at pickup, a $0.50/min meter runs (after 5 min for standard rides, after 8 min for advance bookings). This is added to the final fare and goes 100% to you.\n\nBoth fees appear as separate line items on the passenger's receipt so everything is transparent." },
  { q: "Can I receive tips?", a: "Yes — 100% of tips go directly to you. WeGo never takes a cut of tips. Passengers are prompted to tip after ride completion and can also tip from their Ride History within 24 hours. Tips are deposited with your next weekly payout and appear as a separate line item in your Earnings tab." },
  { q: "How does the $75/month membership due work?", a: "The $75/month breaks down as:\n• $20 — group commercial insurance contribution\n• $15 — app infrastructure & technology\n• $10 — operations reserve\n• $25 — directly into your Retirement Trust\n• $5 — cooperative dividend reserve\n\nThe $45/month covering insurance and operations is tax-deductible as a business expense. The $25 going into your Retirement Trust is legally protected in a separate ERISA trust — management cannot access or redirect it." },
  { q: "When do I get paid?", a: "Earnings are deposited every Monday for the prior week's completed rides. You can view your real-time running total in the Earnings tab at any time. Cancellation fees appear as a separate line item within 24 hours of the event. Tips are included in the same Monday deposit." },
  { q: "What happens if I stop driving for a period?", a: "Your cooperative seat is preserved for up to 6 months on approved leave. During an approved pause your $75/month dues are not charged, and your vesting clock is preserved (not reset). After 6 months of inactivity without a formal leave, your seat enters a suspended state — you retain your pension credits but lose active voting rights until you return. Contact the member services committee to formally request a leave." },
  { q: "Can I be deactivated by an algorithm?", a: "No. Unlike Corp, WeGo cannot deactivate you algorithmically. Every deactivation requires:\n• Documented human review of the specific incident\n• Written notice with the stated reason\n• 30-day appeal right to the member-elected board committee\n• Management cannot override a board appeal decision\n\nThis protection is written into the cooperative's founding constitution and requires a 75% supermajority to amend." },
  { q: "How do I dispute a rating or complaint?", a: "Go to Settings → Support or contact the member services committee directly. All complaints are reviewed by a human within 48 hours. Ratings from cancelled rides or unverified complaints are not counted against your score. You will always receive written notice of the complaint and the outcome." },
  { q: "What if a passenger reports a lost item?", a: "You may be contacted through the app for up to 24 hours after a ride if a passenger reports a lost item. Check your vehicle and respond through the in-app message. If you find the item, coordinate return directly with the passenger — you keep any reasonable retrieval arrangement you agree to. WeGo does not charge a lost item fee or take a cut of retrieval arrangements." },
  { q: "What is RideCheck and what does it mean for me?", a: "RideCheck is WeGo's passive safety monitoring system. If the app detects an unusually long stop during a trip, it may send a check-in to you and the passenger asking if everything is okay. Tap the green 'All Good' button to dismiss it — this takes about 2 seconds and prevents an automatic safety flag. If there is a genuine emergency, the app connects both parties to 911. RideCheck does not affect your rating or payout for normal ride activity." },
  { q: "What insurance covers me while driving?", a: "WeGo's group commercial policy covers all active driving periods (app on through trip completion). Coverage includes:\n• $1M+ liability per incident while app is on (Period 1, 2, and 3)\n• Comprehensive & collision (with deductible) for at-fault accidents during trips\n• Your personal insurance handles off-app periods\n\nYou do not need a separate rideshare endorsement — the group policy covers the full gap that personal policies exclude. Your $20/month dues contribution funds this pool." },
];

export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { logOut, profile, user } = useAuth();
  const isDark = theme === "dark";
  const profilePicRef = useRef<HTMLInputElement>(null);

  // ── Profile ──
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileDraft, setProfileDraft] = useState("");

  // ── Vehicle ──
  const [vehicle, setVehicle] = useState({ nickname: "", make: "", model: "", year: "", plate: "", color: "" });
  const [vehicleDraft, setVehicleDraft] = useState(vehicle);

  // ── Insurance ──
  const [insurance, setInsurance] = useState({ company: "", policy: "", expiry: "" });
  const [insuranceDraft, setInsuranceDraft] = useState(insurance);
  const [insuranceDoc, setInsuranceDoc] = useState<string | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);

  // ── Inspection ──
  const [inspection, setInspection] = useState({ date: "", mileage: "", inspector: "", notes: "" });
  const [inspectionDraft, setInspectionDraft] = useState(inspection);
  const [inspectionDoc, setInspectionDoc] = useState<string | null>(null);
  const [inspectionFile, setInspectionFile] = useState<File | null>(null);

  // ── Account ──
  const [phone, setPhone] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [email, setEmail] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);

  // Sync Firebase profile into local state when it loads
  useEffect(() => {
    if (!profile) return;
    setProfileName(profile.name);
    setProfileDraft(profile.name);
    setPhone(profile.phone);
    setPhoneDraft(profile.phone);
    setEmail(profile.email);
    setEmailDraft(profile.email);
    if (profile.vehicleMake) {
      const v = { nickname: "", make: profile.vehicleMake, model: profile.vehicleModel, year: profile.vehicleYear, plate: profile.licensePlate, color: "" };
      setVehicle(v);
      setVehicleDraft(v);
    }
  }, [profile]);

  // Load saved bank account
  useEffect(() => {
    if (!user) return;
    getBankAccount(user.uid).then((acct) => {
      if (acct) setBankAccount(acct);
    });
  }, [user]);

  // Deep-link: Earnings page navigates here with { openModal: "payout" }
  const locationState = (location as any).state as { openModal?: string } | null;
  useEffect(() => {
    if (locationState?.openModal === "payout") {
      setBankDraft({ holderName: bankAccount?.holderName ?? "", bankName: bankAccount?.bankName ?? "", accountType: bankAccount?.accountType ?? "checking", routingNumber: "", accountNumber: "", accountNumberConfirm: "" });
      setBankError("");
      setModal("payout");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Payout / Banking ──
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [bankDraft, setBankDraft] = useState({ holderName: "", bankName: "", accountType: "checking" as "checking" | "savings", routingNumber: "", accountNumber: "", accountNumberConfirm: "" });
  const [bankError, setBankError] = useState("");
  const [bankSaving, setBankSaving] = useState(false);

  // ── Notifications / Nav ──
  const [notifications, setNotifications] = useState({ rideRequests: true, earnings: true, governance: false, promotions: false });
  const [navApp, setNavApp] = useState<"google" | "waze" | "apple">("google");

  // Load persisted preferences from Firestore on mount
  useEffect(() => {
    if (!user) return;
    import("firebase/firestore").then(({ getDoc, doc: fsDoc }) =>
      getDoc(fsDoc(db, "drivers", user.uid)).then((snap) => {
        if (!snap.exists()) return;
        const prefs = snap.data().preferences as Record<string, unknown> | undefined;
        if (!prefs) return;
        if (prefs.notifications) setNotifications(prefs.notifications as typeof notifications);
        if (prefs.navApp) setNavApp(prefs.navApp as "google" | "waze" | "apple");
      }).catch(() => {})
    );
  }, [user]);

  // ── Modal ──
  const [modal, setModal] = useState<ModalId>(null);
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const close = () => setModal(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const referralCode = profile?.referralCode || "";
  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard?.writeText(referralCode).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };
  const memberSinceYear = profile?.memberSince ? profile.memberSince.getFullYear() : null;

  // Derived display strings
  const vehicleDisplay = vehicle.make
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.plate ? ` · ${vehicle.plate}` : ""}`
    : "Tap to add vehicle info";
  const insuranceDisplay = insurance.company ? `${insurance.company} · ${insurance.policy || "No policy #"}` : "Tap to add insurance";
  const inspectionDisplay = inspection.date ? `Last: ${inspection.date}` : "No inspection on record";

  const updateProfile = async (fields: Record<string, unknown>) => {
    if (!user?.uid) return;
    await updateDoc(doc(db, "drivers", user.uid), fields);
  };

  const saveProfile = async () => {
    const prev = profileName;
    setProfileName(profileDraft);
    try {
      await updateProfile({ name: profileDraft });
      toast.success("Profile updated");
      close();
    } catch {
      setProfileName(prev);
      toast.error("Failed to save. Please try again.");
    }
  };
  const saveVehicle = async () => {
    const yearNum = parseInt(vehicleDraft.year, 10);
    if (!vehicleDraft.year || isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 1) {
      toast.error("Enter a valid 4-digit vehicle year.");
      return;
    }
    const prev = vehicle;
    setVehicle(vehicleDraft);
    try {
      await updateProfile({
        vehicleMake: vehicleDraft.make,
        vehicleModel: vehicleDraft.model,
        vehicleYear: vehicleDraft.year,
        licensePlate: vehicleDraft.plate,
      });
      toast.success("Vehicle info saved");
      close();
    } catch {
      setVehicle(prev);
      toast.error("Failed to save. Please try again.");
    }
  };
  const saveInsurance = async () => {
    const prev = insurance;
    setInsurance(insuranceDraft);
    try {
      if (insuranceFile && user) {
        const storageRef = ref(storage, `drivers/${user.uid}/insurance/${insuranceFile.name}`);
        const snapshot = await uploadBytes(storageRef, insuranceFile);
        const url = await getDownloadURL(snapshot.ref);
        setInsuranceDoc(url);
        await updateProfile({ insuranceDocUrl: url, insuranceExpiry: insuranceDraft.expiry });
        setInsuranceFile(null);
      }
      toast.success("Insurance saved");
      close();
    } catch {
      setInsurance(prev);
      toast.error("Failed to save. Please try again.");
    }
  };
  const saveInspection = async () => {
    const prev = inspection;
    setInspection(inspectionDraft);
    try {
      if (inspectionFile && user) {
        const storageRef = ref(storage, `drivers/${user.uid}/inspection/${inspectionFile.name}`);
        const snapshot = await uploadBytes(storageRef, inspectionFile);
        const url = await getDownloadURL(snapshot.ref);
        setInspectionDoc(url);
        await updateProfile({ inspectionDocUrl: url, inspectionDate: inspectionDraft.date });
        setInspectionFile(null);
      }
      toast.success("Inspection record saved");
      close();
    } catch {
      setInspection(prev);
      toast.error("Failed to save. Please try again.");
    }
  };
  const savePhone = async () => {
    const prev = phone;
    setPhone(phoneDraft);
    try {
      await updateProfile({ phone: phoneDraft });
      toast.success("Phone number updated");
      close();
    } catch {
      setPhone(prev);
      toast.error("Failed to save. Please try again.");
    }
  };

  const handleSaveBankAccount = async () => {
    setBankError("");
    const { holderName, bankName, accountType, routingNumber, accountNumber, accountNumberConfirm } = bankDraft;
    if (!holderName.trim()) { setBankError("Enter the account holder name."); return; }
    if (!bankName.trim()) { setBankError("Enter the bank name."); return; }
    if (!/^\d{9}$/.test(routingNumber.replace(/\s/g, ""))) { setBankError("Routing number must be exactly 9 digits."); return; }
    if (accountNumber.length < 4) { setBankError("Account number must be at least 4 digits."); return; }
    if (accountNumber !== accountNumberConfirm) { setBankError("Account numbers do not match."); return; }
    if (!user) return;
    setBankSaving(true);
    try {
      await saveBankAccount(user.uid, { holderName: holderName.trim(), bankName: bankName.trim(), accountType, routingNumber: routingNumber.replace(/\s/g, ""), accountNumber: accountNumber.replace(/\s/g, "") });
      const updated: BankAccount = { holderName: holderName.trim(), bankName: bankName.trim(), accountType, routingNumberLast4: routingNumber.slice(-4), accountNumberLast4: accountNumber.slice(-4) };
      setBankAccount(updated);
      toast.success("Bank account saved");
      close();
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setBankSaving(false);
    }
  };
  const saveEmail = async () => {
    if (!emailDraft.trim()) { setEmailError("Enter a new email address."); return; }
    if (!emailPassword) { setEmailError("Enter your current password to confirm."); return; }
    if (!user || !user.email) { setEmailError("Not signed in."); return; }
    setEmailError("");
    try {
      const credential = EmailAuthProvider.credential(user.email, emailPassword);
      await reauthenticateWithCredential(user, credential);
      await updateEmail(user, emailDraft.trim());
      await updateProfile({ email: emailDraft.trim() });
      setEmail(emailDraft.trim());
      setEmailPassword("");
      close();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setEmailError("Current password is incorrect.");
      } else if (msg.includes("email-already-in-use")) {
        setEmailError("That email is already in use.");
      } else {
        setEmailError("Failed to update email. Please try again.");
      }
    }
  };
  const savePassword = async () => {
    if (!pwForm.current) { setPwError("Enter your current password."); return; }
    if (pwForm.next.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError("Passwords do not match."); return; }
    if (!user || !user.email) { setPwError("Not signed in."); return; }
    setPwError("");
    try {
      const credential = EmailAuthProvider.credential(user.email, pwForm.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, pwForm.next);
      setPwSaved(true);
      setTimeout(() => { setPwSaved(false); close(); setPwForm({ current: "", next: "", confirm: "" }); }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setPwError("Current password is incorrect.");
      } else {
        setPwError("Failed to update password. Please try again.");
      }
    }
  };

  const handleProfilePic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setProfilePic(URL.createObjectURL(file));
    try {
      const storageRef = ref(storage, `drivers/${user.uid}/profile.jpg`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      await updateDoc(doc(db, "drivers", user.uid), { photoURL: downloadUrl });
      toast.success("Profile photo updated");
    } catch {
      toast.error("Failed to upload photo. Please try again.");
    }
  };

  const navApps = [
    { id: "google" as const, label: "Google Maps" },
    { id: "waze" as const, label: "Waze" },
    { id: "apple" as const, label: "Apple Maps" },
  ];

  return (
    <>
      <div className="pt-4 px-4 pb-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Header */}
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center active:scale-95 transition-transform mb-3"
            >
              <ChevronLeft size={18} className="text-foreground" />
            </button>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your driver preferences</p>
          </div>

          {/* Profile hero */}
          <div className="bg-gradient-to-b from-primary/10 via-primary/4 to-transparent rounded-2xl px-4 pt-5 pb-4">
            <div className="flex items-start gap-4 mb-4">
              <button
                type="button"
                onClick={() => profilePicRef.current?.click()}
                className="relative w-20 h-20 rounded-2xl flex-shrink-0 overflow-hidden group bg-primary flex items-center justify-center shadow-[0_4px_16px_hsl(var(--primary)/0.30)]"
                aria-label="Change profile photo"
              >
                {profilePic ? (
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-primary-foreground">
                    {(profileName || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
                  <Camera size={18} className="text-white" />
                </div>
              </button>
              <input ref={profilePicRef} type="file" accept="image/*" aria-label="Upload profile photo" className="hidden" onChange={handleProfilePic} />

              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xl font-bold text-foreground leading-tight truncate">{profileName || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setProfileDraft(profileName); setModal("editProfile"); }}
                    className="px-3 py-1.5 bg-secondary border border-border rounded-xl text-xs font-semibold text-foreground flex-shrink-0 active:scale-95 transition-transform"
                  >
                    Edit
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <Star size={13} className="text-primary fill-primary flex-shrink-0" />
                  <span className="text-sm font-semibold text-foreground">{profile?.rating?.toFixed(2) ?? "5.00"}</span>
                  <span className="text-xs text-muted-foreground">· {profile?.totalRides ?? 0} ride{(profile?.totalRides ?? 0) !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Appearance */}
          <Section title="Appearance">
            <Row
              icon={isDark ? <Moon size={18} /> : <Sun size={18} />}
              label="Dark Mode"
              sublabel={isDark ? "Currently dark — tap to switch to light" : "Currently light — tap to switch to dark"}
              right={<Toggle checked={isDark} onChange={toggleTheme} />}
              onClick={toggleTheme}
            />
          </Section>

          {/* Notifications */}
          <Section title="Notifications">
            {(["rideRequests", "earnings", "governance", "promotions"] as const).map((key) => {
              const labels = {
                rideRequests: ["Ride Requests", "Alerts for incoming ride requests"],
                earnings: ["Earnings & Payouts", "Weekly summaries and payout alerts"],
                governance: ["Governance Votes", "Reminders for open member votes"],
                promotions: ["Promotions & Bonuses", "Zone event bonuses and special offers"],
              };
              return (
                <Row
                  key={key}
                  icon={key === "promotions" ? <BellOff size={18} /> : <Bell size={18} />}
                  label={labels[key][0]}
                  sublabel={labels[key][1]}
                  right={<Toggle checked={notifications[key]} onChange={() => {
                    setNotifications((p) => {
                      const next = { ...p, [key]: !p[key] };
                      if (user) updateDoc(doc(db, "drivers", user.uid), { "preferences.notifications": next }).catch(() => {});
                      return next;
                    });
                  }} />}
                  onClick={() => {
                    setNotifications((p) => {
                      const next = { ...p, [key]: !p[key] };
                      if (user) updateDoc(doc(db, "drivers", user.uid), { "preferences.notifications": next }).catch(() => {});
                      return next;
                    });
                  }}
                />
              );
            })}
          </Section>

          {/* Navigation App */}
          <Section title="Navigation App">
            {navApps.map((app) => (
              <Row
                key={app.id}
                icon={<Map size={18} />}
                label={app.label}
                right={
                  navApp === app.id
                    ? <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>
                    : <div className="w-5 h-5 rounded-full border-2 border-border" />
                }
                onClick={() => {
                  setNavApp(app.id);
                  if (user) updateDoc(doc(db, "drivers", user.uid), { "preferences.navApp": app.id }).catch(() => {});
                }}
              />
            ))}
          </Section>

          {/* Vehicle */}
          <Section title="Vehicle">
            <Row
              icon={<Car size={18} />}
              label="Vehicle Info"
              sublabel={vehicleDisplay}
              onClick={() => { setVehicleDraft(vehicle); setModal("vehicleInfo"); }}
            />
            <Row
              icon={<Shield size={18} />}
              label="Insurance Documents"
              sublabel={insuranceDisplay}
              onClick={() => { setInsuranceDraft(insurance); setModal("insurance"); }}
            />
            <Row
              icon={<FileText size={18} />}
              label="Inspection History"
              sublabel={inspectionDisplay}
              onClick={() => { setInspectionDraft(inspection); setModal("inspection"); }}
            />
          </Section>

          {/* Account */}
          <Section title="Account">
            <Row
              icon={<Phone size={18} />}
              label="Phone Number"
              sublabel={phone || "Tap to add phone number"}
              onClick={() => { setPhoneDraft(phone); setModal("phone"); }}
            />
            <Row
              icon={<Mail size={18} />}
              label="Email Address"
              sublabel={email || "Tap to add email"}
              onClick={() => { setEmailDraft(email); setModal("email"); }}
            />
            <Row
              icon={<Lock size={18} />}
              label="Security & Password"
              sublabel="Change your login password"
              onClick={() => { setPwForm({ current: "", next: "", confirm: "" }); setPwError(""); setPwSaved(false); setModal("password"); }}
            />
          </Section>

          {/* Payout & Banking */}
          <Section title="Payout & Banking">
            <Row
              icon={<Banknote size={18} />}
              label="Bank Account"
              sublabel={
                bankAccount
                  ? `${bankAccount.bankName} ****${bankAccount.accountNumberLast4} · ${bankAccount.accountType === "checking" ? "Checking" : "Savings"}`
                  : "Tap to add bank account"
              }
              right={
                bankAccount
                  ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">Linked</span>
                  : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Not set</span>
              }
              onClick={() => {
                setBankDraft({ holderName: bankAccount?.holderName ?? "", bankName: bankAccount?.bankName ?? "", accountType: bankAccount?.accountType ?? "checking", routingNumber: "", accountNumber: "", accountNumberConfirm: "" });
                setBankError("");
                setModal("payout");
              }}
            />
          </Section>

          {/* Refer a Driver */}
          <Section title="Refer a Driver">
            <div className="px-4 py-4 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">Share your referral code — earn <span className="text-primary font-semibold">+$50</span> when they complete their first 10 rides.</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-background border border-border rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-primary tracking-widest">{referralCode || "—"}</span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className={`flex items-center gap-1 text-xs font-medium transition-colors ${codeCopied ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                    aria-label="Copy referral code"
                  >
                    {codeCopied ? <CheckCircle size={13} /> : <Copy size={13} />}
                    {codeCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Referral earnings paid out weekly with your rides.</p>
            </div>
          </Section>

          {/* Driver Verification */}
          <Section title="Driver Verification">
            <div className="px-4 py-4 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Submit your driving license, background check consent, and vehicle registration to become a verified WeGo driver. Verified drivers get priority dispatch.
              </p>
              <button
                type="button"
                onClick={() => setModal("verification")}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary/10 border border-primary/25 rounded-xl text-sm font-semibold text-primary active:scale-95 transition-transform"
              >
                <ClipboardCheck size={16} />
                Submit Verification Documents
              </button>
            </div>
          </Section>

          {/* Support */}
          <Section title="Support">
            <Row icon={<HelpCircle size={18} />} label="Help Center" sublabel="FAQs, guides, and driver support" onClick={() => setModal("help")} />
            <Row icon={<FileText size={18} />} label="Member Agreement" sublabel="View your cooperative membership terms" onClick={() => setModal("agreement")} />
            <Row icon={<FileText size={18} />} label="Privacy Policy" sublabel="How WeGo handles your data" onClick={() => setModal("privacy")} />
          </Section>

          {/* Sign Out */}
          <Section title="Session">
            {signOutConfirm ? (
              <div className="px-4 py-4 space-y-3">
                <p className="text-sm text-foreground font-medium">Sign out of your account?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSignOutConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground active:scale-95 transition-transform">Cancel</button>
                  <button type="button" onClick={async () => { try { await logOut(); } catch {} }} className="flex-1 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-sm font-semibold text-destructive active:scale-95 transition-transform">Sign Out</button>
                </div>
              </div>
            ) : (
              <Row icon={<LogOut size={18} className="text-destructive" />} label="Sign Out" danger onClick={() => setSignOutConfirm(true)} right={null} />
            )}
          </Section>

          <p className="text-center text-xs text-muted-foreground pb-2">
            WeGo Driver v2.4.1{memberSinceYear ? ` · Member since ${memberSinceYear}` : ""}
          </p>
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}

      {/* Edit Profile */}
      <BottomSheet open={modal === "editProfile"} onClose={close} title="Edit Profile">
        <div className="space-y-4">
          <Field label="Full Name" value={profileDraft} onChange={setProfileDraft} placeholder="Your full name" />
          <SaveButton onClick={saveProfile} />
        </div>
      </BottomSheet>

      {/* Vehicle Info */}
      <BottomSheet open={modal === "vehicleInfo"} onClose={close} title="Vehicle Info">
        <div className="space-y-4">
          <Field label="Nickname (optional)" value={vehicleDraft.nickname} onChange={(v) => setVehicleDraft((p) => ({ ...p, nickname: v }))} placeholder='e.g. "My Camry"' />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Make" value={vehicleDraft.make} onChange={(v) => setVehicleDraft((p) => ({ ...p, make: v }))} placeholder="Toyota" />
            <Field label="Model" value={vehicleDraft.model} onChange={(v) => setVehicleDraft((p) => ({ ...p, model: v }))} placeholder="Camry" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year" value={vehicleDraft.year} onChange={(v) => setVehicleDraft((p) => ({ ...p, year: v }))} placeholder="2021" type="number" />
            <Field label="Color" value={vehicleDraft.color} onChange={(v) => setVehicleDraft((p) => ({ ...p, color: v }))} placeholder="White" />
          </div>
          <Field label="License Plate" value={vehicleDraft.plate} onChange={(v) => setVehicleDraft((p) => ({ ...p, plate: v }))} placeholder="ABC-1234" />
          <SaveButton onClick={saveVehicle} />
        </div>
      </BottomSheet>

      {/* Insurance Documents */}
      <BottomSheet open={modal === "insurance"} onClose={close} title="Insurance Documents">
        <div className="space-y-4">
          <Field label="Insurance Company" value={insuranceDraft.company} onChange={(v) => setInsuranceDraft((p) => ({ ...p, company: v }))} placeholder="e.g. Progressive" />
          <Field label="Policy Number" value={insuranceDraft.policy} onChange={(v) => setInsuranceDraft((p) => ({ ...p, policy: v }))} placeholder="POL-123456" />
          <Field label="Expiry Date" value={insuranceDraft.expiry} onChange={(v) => setInsuranceDraft((p) => ({ ...p, expiry: v }))} type="date" />
          <UploadBox
            label="Insurance Card / Document"
            preview={insuranceDoc}
            accept="image/*,.pdf"
            onFile={(file, url) => { setInsuranceFile(file); setInsuranceDoc(url); }}
          />
          <SaveButton onClick={saveInsurance} />
        </div>
      </BottomSheet>

      {/* Inspection History */}
      <BottomSheet open={modal === "inspection"} onClose={close} title="Inspection History">
        <div className="space-y-4">
          <Field label="Inspection Date" value={inspectionDraft.date} onChange={(v) => setInspectionDraft((p) => ({ ...p, date: v }))} type="date" />
          <Field label="Odometer (miles)" value={inspectionDraft.mileage} onChange={(v) => setInspectionDraft((p) => ({ ...p, mileage: v }))} placeholder="e.g. 42500" type="number" />
          <Field label="Inspector / Shop Name" value={inspectionDraft.inspector} onChange={(v) => setInspectionDraft((p) => ({ ...p, inspector: v }))} placeholder="e.g. Midas Auto" />
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
            <textarea
              value={inspectionDraft.notes}
              onChange={(e) => setInspectionDraft((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Any notes about the inspection..."
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
            />
          </div>
          <UploadBox
            label="Inspection Report"
            preview={inspectionDoc}
            accept="image/*,.pdf"
            onFile={(file, url) => { setInspectionFile(file); setInspectionDoc(url); }}
          />
          <SaveButton onClick={saveInspection} />
        </div>
      </BottomSheet>

      {/* Phone Number */}
      <BottomSheet open={modal === "phone"} onClose={close} title="Phone Number">
        <div className="space-y-4">
          <Field
            label="Phone Number"
            value={phoneDraft}
            onChange={setPhoneDraft}
            type="tel"
            placeholder="+1 (555) 000-0000"
            hint="Used for account recovery and urgent WeGo alerts."
          />
          <SaveButton onClick={savePhone} />
        </div>
      </BottomSheet>

      {/* Email Address */}
      <BottomSheet open={modal === "email"} onClose={() => { setEmailError(""); setEmailPassword(""); close(); }} title="Email Address">
        <div className="space-y-4">
          <Field
            label="New Email Address"
            value={emailDraft}
            onChange={setEmailDraft}
            type="email"
            placeholder="you@email.com"
            hint="Your primary email for statements and notifications."
          />
          <Field
            label="Current Password"
            value={emailPassword}
            onChange={setEmailPassword}
            type="password"
            placeholder="Confirm your password to change email"
          />
          {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          <SaveButton onClick={saveEmail} />
        </div>
      </BottomSheet>

      {/* Security & Password */}
      <BottomSheet open={modal === "password"} onClose={close} title="Security & Password">
        <div className="space-y-4">
          {/* Current password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Password</label>
            <div className="relative">
              <input
                type={showPw.current ? "text" : "password"}
                value={pwForm.current}
                onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                placeholder="Enter current password"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <button type="button" onClick={() => setShowPw((p) => ({ ...p, current: !p.current }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw.current ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Password</label>
            <div className="relative">
              <input
                type={showPw.next ? "text" : "password"}
                value={pwForm.next}
                onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
                placeholder="Min. 8 characters"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <button type="button" onClick={() => setShowPw((p) => ({ ...p, next: !p.next }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw.next ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confirm New Password</label>
            <div className="relative">
              <input
                type={showPw.confirm ? "text" : "password"}
                value={pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                placeholder="Repeat new password"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              />
              <button type="button" onClick={() => setShowPw((p) => ({ ...p, confirm: !p.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {pwError && <p className="text-xs text-destructive">{pwError}</p>}

          {pwSaved ? (
            <div className="flex items-center justify-center gap-2 py-3 text-primary">
              <CheckCircle size={18} />
              <span className="text-sm font-semibold">Password updated!</span>
            </div>
          ) : (
            <SaveButton onClick={savePassword} label="Update Password" />
          )}
        </div>
      </BottomSheet>

      {/* Payout & Banking */}
      <BottomSheet open={modal === "payout"} onClose={close} title="Bank Account">
        <div className="space-y-4">
          {bankAccount && (
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <CheckCircle size={16} className="text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{bankAccount.bankName} — {bankAccount.accountType === "checking" ? "Checking" : "Savings"}</p>
                <p className="text-xs text-muted-foreground">Account ending ****{bankAccount.accountNumberLast4} · Holder: {bankAccount.holderName}</p>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{bankAccount ? "Update your payout account below." : "Add your bank account to receive weekly payouts."}</p>
          <Field label="Account Holder Name" value={bankDraft.holderName} onChange={(v) => setBankDraft((p) => ({ ...p, holderName: v }))} placeholder="Full name as on bank account" />
          <Field label="Bank Name" value={bankDraft.bankName} onChange={(v) => setBankDraft((p) => ({ ...p, bankName: v }))} placeholder="e.g. Chase, Wells Fargo, Bank of America" />
          {/* Account Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Account Type</label>
            <div className="flex gap-3">
              {(["checking", "savings"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBankDraft((p) => ({ ...p, accountType: t }))}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all active:scale-95 ${bankDraft.accountType === t ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground bg-background"}`}
                >
                  {t === "checking" ? "Checking" : "Savings"}
                </button>
              ))}
            </div>
          </div>
          <Field
            label="Routing Number"
            value={bankDraft.routingNumber}
            onChange={(v) => setBankDraft((p) => ({ ...p, routingNumber: v.replace(/\D/g, "").slice(0, 9) }))}
            placeholder="9-digit routing number"
            type="tel"
            hint="Found at the bottom-left of your check."
          />
          <Field
            label="Account Number"
            value={bankDraft.accountNumber}
            onChange={(v) => setBankDraft((p) => ({ ...p, accountNumber: v.replace(/\D/g, "") }))}
            placeholder="Your account number"
            type="tel"
          />
          <Field
            label="Confirm Account Number"
            value={bankDraft.accountNumberConfirm}
            onChange={(v) => setBankDraft((p) => ({ ...p, accountNumberConfirm: v.replace(/\D/g, "") }))}
            placeholder="Re-enter account number"
            type="tel"
          />
          {bankError && <p className="text-xs text-destructive font-medium">{bankError}</p>}
          <div className="p-3 bg-muted/20 border border-border rounded-xl">
            <p className="text-[11px] text-muted-foreground leading-relaxed">Your account details are stored securely. Only the last 4 digits of your account number are displayed after saving. Payouts are processed every Monday for the prior week.</p>
          </div>
          <button
            type="button"
            onClick={handleSaveBankAccount}
            disabled={bankSaving}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-2xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 btn-glow"
          >
            {bankSaving ? <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Saving…</> : (bankAccount ? "Update Bank Account" : "Save Bank Account")}
          </button>
        </div>
      </BottomSheet>

      {/* Help Center */}
      <BottomSheet open={modal === "help"} onClose={close} title="Help Center">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Tap a question to expand the answer.</p>
          {DRIVER_FAQS.map((faq, i) => (
            <HelpFaqItem key={i} q={faq.q} a={faq.a} />
          ))}
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-center space-y-2 mt-2">
            <p className="text-sm font-semibold text-foreground">Still need help?</p>
            <p className="text-xs text-muted-foreground">Contact the member services committee — we respond within 24 hours.</p>
            <button type="button" onClick={() => { window.location.href = "mailto:support@wego.coop"; }} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-transform btn-glow">
              Contact Support
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Member Agreement */}
      <BottomSheet open={modal === "agreement"} onClose={close} title="Member Agreement">
        <div className="space-y-4 text-sm text-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">Effective January 1, 2025 · WeGo Driver Cooperative</p>
          <div className="space-y-3">
            <div>
              <p className="font-semibold mb-1">1. Cooperative Membership</p>
              <p className="text-xs text-muted-foreground">By joining WeGo, you become a member-owner of the cooperative. You have one vote on major platform decisions, board elections, and constitutional amendments. Membership requires active driving status or an approved leave of absence.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">2. Monthly Dues</p>
              <p className="text-xs text-muted-foreground">Monthly dues of $75 cover group commercial insurance ($20), app infrastructure ($15), operations reserve ($10), your Retirement Trust contribution ($25), and the cooperative dividend reserve ($5). Dues are waived during approved leave.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">3. Earnings & Platform Fee</p>
              <p className="text-xs text-muted-foreground">You retain 88% of every fare. WeGo's 12% covers dispatch, technology, and cooperative operations. Tips go 100% to you. Cancellation and no-show fees go 100% to you. Payouts are processed every Monday.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">4. Deactivation Protections</p>
              <p className="text-xs text-muted-foreground">No algorithmic deactivations. Every deactivation requires documented human review, written notice, and a 30-day appeal right to the member-elected board committee. This protection requires a 75% supermajority to amend.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">5. Retirement Trust</p>
              <p className="text-xs text-muted-foreground">Your $25/month Retirement Trust contribution is held in a legally separate ERISA trust. Management cannot access or redirect these funds. Vesting schedule and withdrawal rules are governed by the trust agreement.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">6. Dispute Resolution</p>
              <p className="text-xs text-muted-foreground">Disputes are reviewed by a human within 48 hours. You will receive written notice of any complaint and its outcome. Ratings from cancelled rides or unverified complaints are not counted against your score.</p>
            </div>
          </div>
          <div className="p-3 bg-muted/20 border border-border rounded-xl">
            <p className="text-[11px] text-muted-foreground">For the full member agreement, contact support@wegoapp.com or request a copy from the member services committee.</p>
          </div>
        </div>
      </BottomSheet>

      {/* Driver Verification */}
      <BottomSheet open={modal === "verification"} onClose={close} title="Driver Verification">
        <div className="space-y-4">
          <div className="p-4 bg-primary/5 border border-primary/15 rounded-xl space-y-2">
            <p className="text-sm font-semibold text-foreground">What to prepare</p>
            <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <li>• Valid driver's license (front and back)</li>
              <li>• Vehicle registration document</li>
              <li>• Proof of insurance (current policy)</li>
              <li>• Recent vehicle inspection report</li>
              <li>• Background check consent (signed)</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Click the button below to open the secure verification form. Upload each document as a photo or PDF. We review submissions within 3–5 business days.
          </p>
          <button
            type="button"
            onClick={() => {
              window.open("https://forms.gle/REPLACE_WITH_YOUR_FORM_ID", "_blank", "noopener,noreferrer");
            }}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-2xl active:scale-95 transition-transform btn-glow flex items-center justify-center gap-2"
          >
            <ClipboardCheck size={18} />
            Open Verification Form
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Documents are handled securely and only used for WeGo driver approval.
          </p>
        </div>
      </BottomSheet>

      {/* Privacy Policy */}
      <BottomSheet open={modal === "privacy"} onClose={close} title="Privacy Policy">
        <div className="space-y-4 text-sm text-foreground leading-relaxed">
          <p className="text-xs text-muted-foreground">Effective January 1, 2025 · WeGo Driver Cooperative</p>
          <div className="space-y-3">
            <div>
              <p className="font-semibold mb-1">Data We Collect</p>
              <p className="text-xs text-muted-foreground">Account information (name, email, phone), vehicle and insurance documents, location during active driving sessions, ride history, earnings data, and device identifiers for app function.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">How We Use Your Data</p>
              <p className="text-xs text-muted-foreground">To match you with passengers, process payouts, maintain safety records, comply with insurance and regulatory requirements, and improve the platform. We do not sell your personal data to third parties.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Location Data</p>
              <p className="text-xs text-muted-foreground">Precise location is collected only while the app is active during a driving session. Location data is retained for 90 days for safety and dispute purposes, then deleted. We do not collect background location when you are off-duty.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Banking Information</p>
              <p className="text-xs text-muted-foreground">Only the last 4 digits of your account and routing numbers are stored in our systems. Full banking details are transmitted securely to our payment processor and never stored on WeGo servers.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Your Rights</p>
              <p className="text-xs text-muted-foreground">You may request a copy of your data, correction of inaccurate data, or deletion of your account at any time by contacting support@wegoapp.com. Account deletion requests are processed within 30 days.</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Data Sharing</p>
              <p className="text-xs text-muted-foreground">Ride details (pickup/dropoff location, fare) are shared with passengers for trip transparency. Aggregate anonymized data may be used for cooperative reporting. No personally identifiable data is shared with advertisers.</p>
            </div>
          </div>
          <div className="p-3 bg-muted/20 border border-border rounded-xl">
            <p className="text-[11px] text-muted-foreground">Questions about your privacy? Contact support@wegoapp.com. For data deletion requests, include your member ID.</p>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
