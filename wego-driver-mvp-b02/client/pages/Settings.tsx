import { useState, useRef } from "react";
import {
  Moon, Sun, Bell, BellOff, Car, Map, Shield, ChevronRight,
  LogOut, User, Phone, Mail, Star, HelpCircle, FileText,
  Camera, Upload, CheckCircle, Eye, EyeOff, Lock, Pencil, Users, Copy
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import BottomSheet from "@/components/BottomSheet";

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
      className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all duration-200"
    >
      {label}
    </button>
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
  | "phone" | "email" | "password" | null;

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const profilePicRef = useRef<HTMLInputElement>(null);

  // ── Profile ──
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("Tenzin C.");
  const [profileDraft, setProfileDraft] = useState("Tenzin C.");

  // ── Vehicle ──
  const [vehicle, setVehicle] = useState({ nickname: "", make: "Toyota", model: "Camry", year: "2021", plate: "ABC-1234", color: "White" });
  const [vehicleDraft, setVehicleDraft] = useState(vehicle);

  // ── Insurance ──
  const [insurance, setInsurance] = useState({ company: "", policy: "", expiry: "" });
  const [insuranceDraft, setInsuranceDraft] = useState(insurance);
  const [insuranceDoc, setInsuranceDoc] = useState<string | null>(null);

  // ── Inspection ──
  const [inspection, setInspection] = useState({ date: "", mileage: "", inspector: "", notes: "" });
  const [inspectionDraft, setInspectionDraft] = useState(inspection);
  const [inspectionDoc, setInspectionDoc] = useState<string | null>(null);

  // ── Account ──
  const [phone, setPhone] = useState("+1 (415) 555-0182");
  const [phoneDraft, setPhoneDraft] = useState(phone);
  const [email, setEmail] = useState("tenzin.c@email.com");
  const [emailDraft, setEmailDraft] = useState(email);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState(false);

  // ── Notifications / Nav ──
  const [notifications, setNotifications] = useState({ rideRequests: true, earnings: true, governance: false, promotions: false });
  const [navApp, setNavApp] = useState<"google" | "waze" | "apple">("google");

  // ── Modal ──
  const [modal, setModal] = useState<ModalId>(null);
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const close = () => setModal(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const handleCopyCode = () => {
    navigator.clipboard?.writeText("WEGO-MT42");
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // Derived display strings
  const vehicleDisplay = vehicle.make
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.plate ? ` · ${vehicle.plate}` : ""}`
    : "Tap to add vehicle info";
  const insuranceDisplay = insurance.company ? `${insurance.company} · ${insurance.policy || "No policy #"}` : "Tap to add insurance";
  const inspectionDisplay = inspection.date ? `Last: ${inspection.date}` : "No inspection on record";

  // Handlers
  const saveProfile = () => { setProfileName(profileDraft); close(); };
  const saveVehicle = () => { setVehicle(vehicleDraft); close(); };
  const saveInsurance = () => { setInsurance(insuranceDraft); close(); };
  const saveInspection = () => { setInspection(inspectionDraft); close(); };
  const savePhone = () => { setPhone(phoneDraft); close(); };
  const saveEmail = () => { setEmail(emailDraft); close(); };
  const savePassword = () => {
    if (!pwForm.current) { setPwError("Enter your current password."); return; }
    if (pwForm.next.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError("Passwords do not match."); return; }
    setPwError("");
    setPwSaved(true);
    setTimeout(() => { setPwSaved(false); close(); setPwForm({ current: "", next: "", confirm: "" }); }, 1200);
  };

  const handleProfilePic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setProfilePic(URL.createObjectURL(file));
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
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">Manage your driver preferences</p>
          </div>

          {/* Profile card */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            {/* Avatar — tap to change photo */}
            <button
              type="button"
              onClick={() => profilePicRef.current?.click()}
              className="relative w-14 h-14 rounded-full flex-shrink-0 group"
              aria-label="Change profile photo"
            >
              {profilePic ? (
                <img src={profilePic} alt="Profile" className="w-14 h-14 rounded-full object-cover border-2 border-primary/40" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center">
                  <User size={26} className="text-primary" />
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
                <Camera size={16} className="text-white" />
              </div>
            </button>
            <input ref={profilePicRef} type="file" accept="image/*" aria-label="Upload profile photo" className="hidden" onChange={handleProfilePic} />

            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-foreground">{profileName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Star size={12} className="text-yellow-500 fill-yellow-500" />
                <span className="text-xs text-muted-foreground">4.94 · Seat #4821 · 3 yrs</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{email}</p>
            </div>

            <button
              type="button"
              onClick={() => { setProfileDraft(profileName); setModal("editProfile"); }}
              className="flex items-center gap-1 text-xs text-primary hover:opacity-80 transition-opacity font-medium flex-shrink-0"
            >
              <Pencil size={12} /> Edit
            </button>
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
                promotions: ["Promotions & Bonuses", "Zone surge alerts and bonus offers"],
              };
              return (
                <Row
                  key={key}
                  icon={key === "promotions" ? <BellOff size={18} /> : <Bell size={18} />}
                  label={labels[key][0]}
                  sublabel={labels[key][1]}
                  right={<Toggle checked={notifications[key]} onChange={() => setNotifications((p) => ({ ...p, [key]: !p[key] }))} />}
                  onClick={() => setNotifications((p) => ({ ...p, [key]: !p[key] }))}
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
                onClick={() => setNavApp(app.id)}
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

          {/* Refer a Driver */}
          <Section title="Refer a Driver">
            <div className="px-4 py-4 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">Share your referral code — earn <span className="text-primary font-semibold">+$50</span> when they complete their first 10 rides.</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-background border border-border rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-primary tracking-widest">WEGO-MT42</span>
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users size={13} className="text-primary flex-shrink-0" />
                <span>2 referrals pending · $100 earned so far</span>
              </div>
            </div>
          </Section>

          {/* Support */}
          <Section title="Support">
            <Row icon={<HelpCircle size={18} />} label="Help Center" sublabel="FAQs, guides, and driver support" onClick={() => alert("Help Center coming soon.")} />
            <Row icon={<FileText size={18} />} label="Member Agreement" sublabel="View your cooperative membership terms" onClick={() => alert("Member Agreement coming soon.")} />
            <Row icon={<FileText size={18} />} label="Privacy Policy" sublabel="How WeGo handles your data" onClick={() => alert("Privacy Policy coming soon.")} />
          </Section>

          {/* Sign Out */}
          <Section title="Session">
            {signOutConfirm ? (
              <div className="px-4 py-4 space-y-3">
                <p className="text-sm text-foreground font-medium">Sign out of your account?</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSignOutConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground active:scale-95 transition-transform">Cancel</button>
                  <button type="button" onClick={() => setSignOutConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-sm font-semibold text-destructive active:scale-95 transition-transform">Sign Out</button>
                </div>
              </div>
            ) : (
              <Row icon={<LogOut size={18} className="text-destructive" />} label="Sign Out" danger onClick={() => setSignOutConfirm(true)} right={null} />
            )}
          </Section>

          <p className="text-center text-xs text-muted-foreground pb-2">WeGo Driver v2.4.1 · Member since 2023</p>
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
            onFile={(_, url) => setInsuranceDoc(url)}
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
            onFile={(_, url) => setInspectionDoc(url)}
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
      <BottomSheet open={modal === "email"} onClose={close} title="Email Address">
        <div className="space-y-4">
          <Field
            label="Email Address"
            value={emailDraft}
            onChange={setEmailDraft}
            type="email"
            placeholder="you@email.com"
            hint="Your primary email for statements and notifications."
          />
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
    </>
  );
}
