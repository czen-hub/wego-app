import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  User, CreditCard, Shield, Building2, ChevronRight,
  Sun, Moon, LogOut, Star, HelpCircle, X, Plus, Trash2, Phone,
  Bell, Gift, Users, Copy, Check, ChevronDown, ChevronUp, Award,
  MapPin, Clock, Zap, Car, Camera,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

// ── Primitives ────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1.5">{title}</p>
      <div className="bg-card border border-border rounded-xl divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({
  icon, label, sublabel, right, onClick,
}: {
  icon: React.ReactNode; label: string; sublabel?: string;
  right?: React.ReactNode; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 py-3 pl-4 pr-4 ${onClick ? "hover:bg-muted/30 active:bg-muted/50 cursor-pointer" : ""}`}
    >
      <div className="flex-shrink-0 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{sublabel}</p>}
      </div>
      <div className="flex-shrink-0 ml-2">
        {right !== undefined ? right : onClick ? <ChevronRight size={16} className="text-muted-foreground" /> : null}
      </div>
    </div>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      className={`relative w-11 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${on ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${on ? "translate-x-[22px]" : "translate-x-1"}`} />
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[430px] bg-card border-t border-border rounded-t-2xl shadow-2xl px-4 pt-4 pb-8 space-y-4 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between sticky top-0 bg-card pb-2 pt-1 z-10">
          <p className="text-base font-bold text-foreground">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Static data ───────────────────────────────────────────────────────────────

interface InboxMessage { id: string; type: "promo" | "ride" | "safety" | "reward"; title: string; body: string; time: string; read: boolean }
const INITIAL_MESSAGES: InboxMessage[] = [
  { id: "m1", type: "reward", title: "You earned 10 points!", body: "Thanks for completing your ride with Marcus T. Keep riding to unlock discounts.", time: "Just now", read: false },
  { id: "m2", type: "promo", title: "Invite friends, earn $10", body: "Share your code SARAH-WEGO and get $10 credit when a friend completes their first ride.", time: "2 days ago", read: false },
  { id: "m3", type: "ride", title: "Receipt: Apr 27 ride", body: "Your $52.00 ride to 555 California St. Driver earned $45.76 (88%).", time: "Apr 27", read: false },
  { id: "m4", type: "safety", title: "Trip sharing updated", body: "Your emergency contact settings have been saved.", time: "Apr 23", read: true },
  { id: "m5", type: "promo", title: "No surge — ever", body: "Unlike Corp 1 and Corp 2, WeGo never applies surge pricing. Your fare is always fair.", time: "Apr 19", read: true },
];

const REFERRAL_CODE = "SARAH-WEGO";

const REWARDS_HISTORY = [
  { id: "rh1", label: "Completed ride with Marcus T.", pts: +10, date: "Today" },
  { id: "rh2", label: "Completed ride with Priya S.", pts: +10, date: "Apr 27" },
  { id: "rh3", label: "5-star rating given", pts: +5, date: "Apr 27" },
  { id: "rh4", label: "Completed ride with James W.", pts: +10, date: "Apr 23" },
  { id: "rh5", label: "Completed ride with Aisha K.", pts: +10, date: "Apr 19" },
  { id: "rh6", label: "Completed ride with Carlos M.", pts: +10, date: "Apr 14" },
  { id: "rh7", label: "5-star rating given", pts: +5, date: "Apr 14" },
  { id: "rh8", label: "Joined WeGo", pts: +15, date: "Apr 14" },
];
const REWARDS_TOTAL = REWARDS_HISTORY.reduce((s, r) => s + r.pts, 0);

const REDEEM_OPTIONS = [
  { id: "rd1", label: "$5 off next ride", cost: 500 },
  { id: "rd2", label: "$10 off next ride", cost: 900 },
  { id: "rd3", label: "Free ride up to $20", cost: 2000 },
];

const HOW_IT_WORKS_STEPS = [
  { icon: <MapPin size={16} className="text-primary" />, title: "Set your destination", body: "Open the app and type where you're going. Your fare is shown upfront — no surge, no surprises." },
  { icon: <Car size={16} className="text-primary" />, title: "Get matched to a coop driver", body: "Your driver is a verified WeGo cooperative member — not a gig worker. Background-checked and insured." },
  { icon: <Zap size={16} className="text-primary" />, title: "Transparent fare split", body: "88% of your fare goes directly to your driver. 12% funds the cooperative: pensions, insurance, and the AV fleet." },
  { icon: <Clock size={16} className="text-primary" />, title: "Rate and go", body: "After your ride, rate your driver. Your feedback shapes the cooperative — every vote counts." },
];

const COOP_FAQS = [
  { q: "What is the WeGo Cooperative?", a: "WeGo is a driver-owned cooperative, not a venture-backed corporation. Drivers democratically govern the platform, vote on policies, and share in the platform's growth. Every driver holds one seat with one vote — no outside investors, no board override." },
  { q: "Why 88% to drivers?", a: "Traditional ride-hail apps take ~55% of every fare in effective commission. WeGo takes only 12% — just enough to run operations, fund driver benefits, and build the shared AV fleet. That means drivers keep roughly 69% more of each fare compared to Corp 1 or Corp 2." },
  { q: "What is the cooperative fund used for?", a: "The 12% cooperative fee funds: driver pension plans, group commercial insurance, app infrastructure, and the shared autonomous vehicle fleet that drivers will own collectively by Year 6. A real-time Member Transparency Dashboard lets every driver track exactly where every dollar goes." },
  { q: "Why is there no surge pricing?", a: "Surge pricing extracts money from passengers during high-demand moments to maximise corporate profit. WeGo's cooperative model doesn't need to do that — our fares stay fair at all times. The fare shown at booking is the fare you pay, always." },
  { q: "Do drivers earn a pension?", a: "Yes. WeGo drivers who complete 20 years of active cooperative membership become eligible for a projected ~$2,500/month pension for life — funded by a legally separate ERISA trust that management cannot touch. Partial vesting starts at 3 years. It's modeled after the military's 20-year retirement." },
  { q: "Is WeGo currently operating?", a: "WeGo is currently operating in the San Francisco Bay Area and expanding to new cities through cooperative partnerships. Check the app for the latest coverage map." },
];

const DRIVER_FACTS = [
  { icon: <Check size={14} className="text-primary" />, text: "Background-checked and licensed before joining" },
  { icon: <Check size={14} className="text-primary" />, text: "Verified cooperative member with seat ownership" },
  { icon: <Check size={14} className="text-primary" />, text: "Earns 88% of every fare — vs. ~45% effective pay on Corp 1/Corp 2" },
  { icon: <Check size={14} className="text-primary" />, text: "Enrolled in cooperative 20-year pension plan" },
  { icon: <Check size={14} className="text-primary" />, text: "Covered by group commercial insurance through the coop" },
  { icon: <Check size={14} className="text-primary" />, text: "Votes on platform policy — 1 driver, 1 vote" },
  { icon: <Check size={14} className="text-primary" />, text: "Cannot be deactivated by an algorithm — human review required" },
];

const HELP_FAQS = [
  { q: "How do I cancel a ride?", a: "Open the ride screen and tap 'Cancel Ride'. You'll see the exact fee before confirming — no surprises. Cancelling within 5 minutes of booking is always free." },
  { q: "What are the cancellation fees?", a: "Free: within 5 minutes of booking.\n\n$5.00: driver nearby (< 5 miles) — +$3 if already arrived = $8.00.\n\n$9.00: driver 5–10 miles en route — +$3 if already arrived = $12.00.\n\n$14.00: driver drove 10+ miles — +$3 if already arrived = $17.00.\n\nThe $3.00 arrived fee covers up to 5 minutes of free wait time at your pickup (8 minutes for advance bookings). After that, a $0.50/min meter runs for up to 2 more minutes before the driver is eligible to leave.\n\n100% goes directly to your driver — WeGo keeps none of it." },
  { q: "What if my driver doesn't show?", a: "If your driver hasn't arrived within 10 minutes of the expected time, use the chat or call button on the ride screen to reach them. If the driver is significantly late, the app automatically waives the cancellation fee — you can cancel penalty-free." },
  { q: "How are fares calculated?", a: "Fares are based on distance, estimated trip time, a base rate, and a booking fee. There is never surge pricing on WeGo — the fare shown at booking is the fare you pay, always.\n\nCompared to Corp 1 X on-demand, WeGo fares are typically 10–20% lower. On advance bookings, the gap is larger — WeGo Reserve runs $15–25 cheaper than Corp 1 Reserve on the same route, because Corp 1 adds a hidden variable reservation fee that can reach $15–35+ depending on demand." },
  { q: "Can I schedule a ride in advance?", a: "Yes — tap 'Reserve' on the home screen to book up to 7 days ahead. A flat $8.00 advance booking fee applies — 100% of it goes directly to your driver as a scheduling commitment bonus, not to WeGo.\n\nFree cancellation up to 1 hour before your pickup. Even with the advance fee, WeGo Reserve is typically $15–25 cheaper than Corp 1 Reserve on the same route." },
  { q: "Can I ask my driver to make a stop?", a: "Yes — tap 'Request a Stop' during your ride. A flat $2.00 stop fee is added to your fare. 100% of it goes directly to your driver for the extra wait time. You can make multiple stops; each adds $2.00.\n\nBoth the stop fee and any wait meter charges appear as separate line items on your final receipt so everything is transparent." },
  { q: "Can I tip my driver?", a: "Yes — you can tip after your ride is complete. 100% of tips go directly to your driver. WeGo never takes a cut of tips. You'll be prompted to tip on the post-ride screen; you can also tip from your Ride History at any time within 24 hours." },
  { q: "How do I message or call my driver?", a: "Once a driver is matched, tap the phone or chat icon on the ride screen. You can send quick messages or type your own. All communication is in-app — your personal phone number is never shared with the driver." },
  { q: "I left something in the car — what do I do?", a: "Go to Ride History, find the trip, and tap 'Report Lost Item'. You can contact your driver directly through the app for up to 24 hours after the ride ends. If you can't reach the driver, contact WeGo support — we respond within 2 hours and will coordinate retrieval.\n\nWeGo does not charge a lost item retrieval fee — any arrangement is between you and your driver." },
  { q: "Is my personal information shared with the driver?", a: "No. Your full name, phone number, and home address are never shared with your driver. All calls and messages go through the in-app system. Drivers see only your first name and pickup/drop-off locations." },
  { q: "How do I get a refund?", a: "If you were overcharged or had a serious issue with your ride, tap 'Help' on the trip receipt in Ride History and describe the issue. Most refund requests are resolved within 24 hours. WeGo does not charge a dispute fee." },
  { q: "Are rides accessible for wheelchair users?", a: "WeGo is actively adding wheelchair-accessible vehicles (WAVs) to the cooperative fleet. When booking, check the vehicle type selector for WAV availability in your area. If no WAV is available in real-time, you can book a Reserve ride in advance to ensure a WAV is dispatched." },
  { q: "Is WeGo available in my city?", a: "WeGo is currently operating in the San Francisco Bay Area and expanding to new cities through cooperative partnerships. Check the app for the latest coverage map." },
];

// ── Main ──────────────────────────────────────────────────────────────────────

const INITIAL_CARDS = [{ id: "visa4242", label: "Visa", last4: "4242", isDefault: true }];
interface Contact { id: string; name: string; phone: string }

export default function Account() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { logOut, profile } = useAuth();

  // Profile
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftEmail, setDraftEmail] = useState(email);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync Firebase profile into local state when it loads
  useEffect(() => {
    if (!profile) return;
    setName(profile.name || "");
    setEmail(profile.email || "");
    setDraftName(profile.name || "");
    setDraftEmail(profile.email || "");
  }, [profile]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Inbox
  const [messages, setMessages] = useState<InboxMessage[]>(INITIAL_MESSAGES);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxTab, setInboxTab] = useState<"all" | "offers" | "updates">("all");
  const unreadCount = messages.filter((m) => !m.read).length;

  // Rewards
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [redeemFeedback, setRedeemFeedback] = useState<string | null>(null);

  // Invite
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Payment
  const [cards, setCards] = useState(INITIAL_CARDS);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [newCardNum, setNewCardNum] = useState("");
  const [newCardExpiry, setNewCardExpiry] = useState("");
  const [newCardCvv, setNewCardCvv] = useState("");

  // Safety
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [shareTrip, setShareTrip] = useState(false);
  const [rideCheck, setRideCheck] = useState(false);

  // About
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [ourDriversOpen, setOurDriversOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  // Help & sign out
  const [helpOpen, setHelpOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const saveProfile = () => {
    setName(draftName.trim() || name);
    setEmail(draftEmail.trim() || email);
    setEditProfileOpen(false);
  };

  const openEditProfile = () => {
    setDraftName(name);
    setDraftEmail(email);
    setEditProfileOpen(true);
  };

  const openInbox = () => {
    setInboxOpen(true);
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
  };

  const copyCode = () => {
    navigator.clipboard.writeText(REFERRAL_CODE).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const redeem = (label: string, cost: number) => {
    if (REWARDS_TOTAL < cost) return;
    setRedeemFeedback(`"${label}" applied to your next ride!`);
    setTimeout(() => setRedeemFeedback(null), 3000);
  };

  const addCard = () => {
    if (newCardNum.replace(/\s/g, "").length < 16) return;
    const last4 = newCardNum.replace(/\s/g, "").slice(-4);
    setCards((prev) => [...prev, { id: `card-${Date.now()}`, label: "Card", last4, isDefault: false }]);
    setNewCardNum(""); setNewCardExpiry(""); setNewCardCvv("");
    setAddCardOpen(false);
  };

  const removeCard = (id: string) => setCards((prev) => prev.filter((c) => c.id !== id));
  const setDefault = (id: string) => setCards((prev) => prev.map((c) => ({ ...c, isDefault: c.id === id })));

  const addContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    setContacts((prev) => [...prev, { id: `c-${Date.now()}`, name: newContactName.trim(), phone: newContactPhone.trim() }]);
    setNewContactName(""); setNewContactPhone("");
  };
  const removeContact = (id: string) => setContacts((prev) => prev.filter((c) => c.id !== id));

  const toggleFaq = (id: string) => setOpenFaq((prev) => (prev === id ? null : id));

  const defaultCard = cards.find((c) => c.isDefault) ?? cards[0];

  const MSG_ICON: Record<InboxMessage["type"], React.ReactNode> = {
    promo: <Gift size={14} className="text-primary" />,
    ride: <Car size={14} className="text-primary" />,
    safety: <Shield size={14} className="text-primary" />,
    reward: <Award size={14} className="text-primary" />,
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="bg-background pt-4 px-4 pb-6">
        <div className="max-w-2xl mx-auto space-y-5">

          <h1 className="text-3xl font-bold text-foreground">Account</h1>

          {/* Profile card */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 shadow-card">
            <div className="w-16 h-16 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-primary to-blue-400 flex items-center justify-center text-white text-2xl font-bold shadow-[0_4px_16px_rgba(0,71,255,0.4)]">
              {photo
                ? <img src={photo} alt="Profile" className="w-full h-full object-cover" />
                : (name.charAt(0) || "?").toUpperCase()
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold text-foreground">{name || "—"}</p>
              <p className="text-sm text-muted-foreground truncate">{email}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Star size={12} className="text-yellow-400 fill-yellow-400 flex-shrink-0" />
                <span className="text-xs text-muted-foreground">
                  {(profile?.rating ?? 5.0).toFixed(2)} rating
                </span>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground">
                  {profile?.totalRides ?? 0} ride{(profile?.totalRides ?? 0) !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <button type="button" onClick={openEditProfile} className="text-xs text-primary font-semibold px-1 flex-shrink-0">
              Edit
            </button>
          </div>

          {/* Notifications */}
          <Section title="Notifications">
            <Row
              icon={<Bell size={18} />}
              label="Inbox"
              sublabel={unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? "s" : ""}` : "All caught up"}
              right={
                unreadCount > 0
                  ? <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{unreadCount}</span><ChevronRight size={16} className="text-muted-foreground" /></div>
                  : undefined
              }
              onClick={openInbox}
            />
          </Section>

          {/* Perks */}
          <Section title="Perks">
            <Row
              icon={<Award size={18} />}
              label="My Rewards"
              sublabel={`${REWARDS_TOTAL} pts · earn 10 pts per ride`}
              onClick={() => setRewardsOpen(true)}
            />
            <Row
              icon={<Users size={18} />}
              label="Invite Friends"
              sublabel="Friend gets $10 off · you earn 200 pts"
              onClick={() => setInviteOpen(true)}
            />
          </Section>

          {/* Payment */}
          <Section title="Payment">
            <Row
              icon={<CreditCard size={18} />}
              label={defaultCard ? `${defaultCard.label} ···· ${defaultCard.last4}` : "No payment method"}
              sublabel={defaultCard ? "Default payment method" : "Add a card to ride"}
              onClick={() => setPaymentOpen(true)}
            />
            <Row
              icon={<Plus size={18} />}
              label="Add Payment Method"
              onClick={() => { setPaymentOpen(false); setAddCardOpen(true); }}
            />
          </Section>

          {/* Appearance */}
          <Section title="Appearance">
            <Row
              icon={theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
              label="Dark Mode"
              sublabel={theme === "dark" ? "Currently dark — tap to switch to light" : "Currently light — tap to switch to dark"}
              right={<Toggle on={theme === "dark"} onToggle={() => setTheme(theme === "dark" ? "light" : "dark")} label="Toggle theme" />}
            />
          </Section>

          {/* Safety */}
          <Section title="Safety">
            <Row
              icon={<Shield size={18} />}
              label="Emergency Contacts"
              sublabel={contacts.length > 0 ? `${contacts.length} contact${contacts.length > 1 ? "s" : ""} added` : "No contacts yet — add trusted people"}
              onClick={() => setContactsOpen(true)}
            />
            <Row
              icon={<Shield size={18} />}
              label="Share Trip Status"
              sublabel={shareTrip ? "Live location shared during rides" : "Contacts not notified during rides"}
              right={<Toggle on={shareTrip} onToggle={() => setShareTrip((v) => !v)} label="Toggle trip sharing" />}
            />
            <Row
              icon={<Shield size={18} />}
              label="RideCheck"
              sublabel={rideCheck ? "Check-ins enabled on long rides" : "Periodic check-ins during long rides"}
              right={<Toggle on={rideCheck} onToggle={() => setRideCheck((v) => !v)} label="Toggle RideCheck" />}
            />
          </Section>

          {/* About WeGo */}
          <Section title="About WeGo">
            <Row icon={<Building2 size={18} />} label="How WeGo Works" sublabel="The cooperative model explained" onClick={() => setHowItWorksOpen(true)} />
            <Row icon={<User size={18} />} label="Our Drivers" sublabel="Verified coop members, not gig workers" onClick={() => setOurDriversOpen(true)} />
          </Section>

          {/* Coop card */}
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-primary" />
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">WeGo Cooperative</p>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>WeGo is a driver-owned cooperative, not a corporation. When you ride:</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
                  <span className="text-foreground font-medium">Driver earns</span>
                  <span className="font-bold text-primary">88%</span>
                </div>
                <div className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
                  <span className="text-foreground font-medium">Cooperative fund</span>
                  <span className="font-bold text-muted-foreground">12%</span>
                </div>
              </div>
              <p>The 12% funds driver pensions, group insurance, and a shared AV fleet that drivers will own collectively by Year 6.</p>
              <p className="font-medium text-foreground">No surge pricing. No venture capital. No shareholders.</p>
            </div>
          </div>

          {/* Support */}
          <Section title="Support">
            <Row icon={<HelpCircle size={18} />} label="Help Center" sublabel="FAQs and ride support" onClick={() => setHelpOpen(true)} />
            <Row icon={<LogOut size={18} />} label="Sign Out" onClick={() => setSignOutOpen(true)} />
          </Section>

          <p className="text-center text-xs text-muted-foreground">WeGo Passenger App · v1.0.0</p>
        </div>
      </div>

      {/* ── EDIT PROFILE ─────────────────────────────────────────────────── */}
      {editProfileOpen && (
        <Modal title="Edit Profile" onClose={() => setEditProfileOpen(false)}>
          <div className="space-y-3">

            {/* Photo picker */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change profile photo"
                className="relative w-20 h-20 rounded-full overflow-hidden bg-primary flex items-center justify-center text-white text-3xl font-bold group"
              >
                {photo
                  ? <img src={photo} alt="Profile" className="w-full h-full object-cover" />
                  : draftName.charAt(0) || name.charAt(0)
                }
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera size={20} className="text-white" />
                </div>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-primary font-semibold flex items-center gap-1"
              >
                <Camera size={12} /> {photo ? "Change photo" : "Add photo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                title="Upload profile photo"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </div>

            <div>
              <label htmlFor="profile-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Name</label>
              <input id="profile-name" type="text" value={draftName} onChange={(e) => setDraftName(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label htmlFor="profile-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Email</label>
              <input id="profile-email" type="email" value={draftEmail} onChange={(e) => setDraftEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <button type="button" onClick={saveProfile} className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform">
              Save Changes
            </button>
          </div>
        </Modal>
      )}

      {/* ── INBOX ────────────────────────────────────────────────────────── */}
      {inboxOpen && (() => {
        const TAB_FILTER: Record<typeof inboxTab, (m: InboxMessage) => boolean> = {
          all: () => true,
          offers: (m) => m.type === "promo" || m.type === "reward",
          updates: (m) => m.type === "ride" || m.type === "safety",
        };
        const visible = messages.filter(TAB_FILTER[inboxTab]);
        const countFor = (tab: typeof inboxTab) => messages.filter((m) => !m.read && TAB_FILTER[tab](m)).length;

        return (
          <Modal title="Inbox" onClose={() => setInboxOpen(false)}>
            {/* Tabs */}
            <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
              {(["all", "offers", "updates"] as const).map((tab) => {
                const label = tab === "all" ? "All" : tab === "offers" ? "Offers" : "Updates";
                const badge = countFor(tab);
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setInboxTab(tab)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${inboxTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                  >
                    {label}
                    {badge > 0 && (
                      <span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Messages */}
            <div className="space-y-2">
              {visible.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No messages here.</p>
              )}
              {visible.map((msg) => (
                <div key={msg.id} className={`flex gap-3 border rounded-xl px-4 py-3 ${!msg.read ? "border-primary/30 bg-primary/5" : "bg-background border-border"}`}>
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {MSG_ICON[msg.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground leading-tight">{msg.title}</p>
                      {!msg.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{msg.body}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Modal>
        );
      })()}

      {/* ── REWARDS ──────────────────────────────────────────────────────── */}
      {rewardsOpen && (
        <Modal title="My Rewards" onClose={() => setRewardsOpen(false)}>
          <div className="space-y-4">
            {/* Balance */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Points Balance</p>
              <p className="text-5xl font-bold text-primary">{REWARDS_TOTAL}</p>
              <p className="text-xs text-muted-foreground mt-1">Earn 10 pts per ride · 5 pts per 5-star rating</p>
            </div>

            {redeemFeedback && (
              <div className="flex items-center gap-2 bg-primary/10 border border-primary/25 rounded-xl px-4 py-3">
                <Check size={14} className="text-primary flex-shrink-0" />
                <p className="text-sm font-semibold text-primary">{redeemFeedback}</p>
              </div>
            )}

            {/* Redeem */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Redeem</p>
              <div className="space-y-2">
                {REDEEM_OPTIONS.map((opt) => {
                  const canAfford = REWARDS_TOTAL >= opt.cost;
                  return (
                    <div key={opt.id} className="flex items-center justify-between bg-background border border-border rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.cost} pts</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => redeem(opt.label, opt.cost)}
                        disabled={!canAfford}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-semibold disabled:opacity-30 active:scale-95 transition-transform"
                      >
                        Redeem
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* History */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">History</p>
              <div className="space-y-1.5">
                {REWARDS_HISTORY.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{r.label}</p>
                      <p className="text-[10px] text-muted-foreground">{r.date}</p>
                    </div>
                    <span className="text-xs font-bold text-primary ml-3">+{r.pts} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── INVITE FRIENDS ───────────────────────────────────────────────── */}
      {inviteOpen && (
        <Modal title="Invite Friends" onClose={() => setInviteOpen(false)}>
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-center space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your referral code</p>
              <p className="text-3xl font-bold text-primary tracking-widest">{REFERRAL_CODE}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-foreground">$10</p>
                <p className="text-xs text-muted-foreground mt-0.5">friend's discount on first ride</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-primary">200 pts</p>
                <p className="text-xs text-muted-foreground mt-0.5">you earn when they ride</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground bg-background border border-border rounded-xl p-3">
              <p className="font-semibold text-foreground text-sm">How it works</p>
              <p>1. Share your code with a friend.</p>
              <p>2. They sign up and enter <span className="font-semibold text-foreground">{REFERRAL_CODE}</span> at checkout.</p>
              <p>3. They get $10 off their first WeGo ride.</p>
              <p>4. You earn 200 points once they complete that ride.</p>
            </div>

            <button
              type="button"
              onClick={copyCode}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Code</>}
            </button>
          </div>
        </Modal>
      )}

      {/* ── PAYMENT ──────────────────────────────────────────────────────── */}
      {paymentOpen && (
        <Modal title="Payment Methods" onClose={() => setPaymentOpen(false)}>
          <div className="space-y-2">
            {cards.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No payment methods saved.</p>}
            {cards.map((card) => (
              <div key={card.id} className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
                <CreditCard size={18} className="text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{card.label} ···· {card.last4}</p>
                  {card.isDefault && <p className="text-xs text-primary font-semibold">Default</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!card.isDefault && (
                    <button type="button" onClick={() => setDefault(card.id)} className="text-xs text-primary font-semibold">Set Default</button>
                  )}
                  <button type="button" onClick={() => removeCard(card.id)} aria-label="Remove card" className="text-muted-foreground hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => { setPaymentOpen(false); setAddCardOpen(true); }}
              className="w-full py-3 rounded-xl border border-dashed border-primary/40 text-primary font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
              <Plus size={16} /> Add Card
            </button>
          </div>
        </Modal>
      )}

      {/* ── ADD CARD ─────────────────────────────────────────────────────── */}
      {addCardOpen && (
        <Modal title="Add Payment Method" onClose={() => setAddCardOpen(false)}>
          <div className="space-y-3">
            <div>
              <label htmlFor="card-number" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Card Number</label>
              <input id="card-number" type="text" inputMode="numeric" placeholder="1234 5678 9012 3456" maxLength={19} value={newCardNum}
                onChange={(e) => { const r = e.target.value.replace(/\D/g, "").slice(0, 16); setNewCardNum(r.replace(/(.{4})/g, "$1 ").trim()); }}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-mono tracking-wider" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="card-expiry" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Expiry</label>
                <input id="card-expiry" type="text" placeholder="MM/YY" maxLength={5} value={newCardExpiry}
                  onChange={(e) => { const r = e.target.value.replace(/\D/g, "").slice(0, 4); setNewCardExpiry(r.length > 2 ? `${r.slice(0, 2)}/${r.slice(2)}` : r); }}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-mono" />
              </div>
              <div>
                <label htmlFor="card-cvv" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">CVV</label>
                <input id="card-cvv" type="text" inputMode="numeric" placeholder="···" maxLength={4} value={newCardCvv}
                  onChange={(e) => setNewCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary font-mono" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">Demo only — no real payment data is stored.</p>
            <button type="button" onClick={addCard} disabled={newCardNum.replace(/\s/g, "").length < 16}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-40">
              Add Card
            </button>
          </div>
        </Modal>
      )}

      {/* ── EMERGENCY CONTACTS ───────────────────────────────────────────── */}
      {contactsOpen && (
        <Modal title="Emergency Contacts" onClose={() => setContactsOpen(false)}>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">These contacts are notified if you trigger an emergency alert during a ride.</p>
            {contacts.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No contacts added yet.</p>}
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Phone size={14} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                </div>
                <button type="button" onClick={() => removeContact(c.id)} aria-label="Remove contact" className="text-muted-foreground hover:text-red-500">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <div className="bg-background border border-border rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Contact</p>
              <input type="text" placeholder="Full name" value={newContactName} onChange={(e) => setNewContactName(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
              <input type="tel" placeholder="Phone number" value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
              <button type="button" onClick={addContact} disabled={!newContactName.trim() || !newContactPhone.trim()}
                className="w-full py-2.5 rounded-lg bg-primary/10 border border-primary/25 text-primary font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-40">
                <Plus size={14} /> Add Contact
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── HOW WEGO WORKS ───────────────────────────────────────────────── */}
      {howItWorksOpen && (
        <Modal title="How WeGo Works" onClose={() => setHowItWorksOpen(false)}>
          <div className="space-y-4">
            <div className="space-y-3">
              {HOW_IT_WORKS_STEPS.map((step, i) => (
                <div key={i} className="flex gap-3 bg-background border border-border rounded-xl p-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Frequently Asked</p>
              {COOP_FAQS.map((faq, i) => (
                <div key={i} className="border-b border-border/50 last:border-0 pb-3 last:pb-0">
                  <button type="button" onClick={() => toggleFaq(`coop-${i}`)} className="w-full flex items-start justify-between gap-2 text-left">
                    <p className="text-sm font-medium text-foreground">{faq.q}</p>
                    {openFaq === `coop-${i}` ? <ChevronUp size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" /> : <ChevronDown size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />}
                  </button>
                  {openFaq === `coop-${i}` && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{faq.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* ── OUR DRIVERS ──────────────────────────────────────────────────── */}
      {ourDriversOpen && (
        <Modal title="Our Drivers" onClose={() => setOurDriversOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every WeGo driver is a verified cooperative member — not a gig worker. They own a seat in the platform and have a direct stake in its success.
            </p>

            <div className="space-y-2">
              {DRIVER_FACTS.map((fact, i) => (
                <div key={i} className="flex items-start gap-3 bg-background border border-border rounded-xl px-4 py-3">
                  <div className="mt-0.5 flex-shrink-0">{fact.icon}</div>
                  <p className="text-sm text-foreground">{fact.text}</p>
                </div>
              ))}
            </div>

            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Driver Earnings vs. Big Apps</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground font-medium">WeGo driver</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full w-[88%] bg-primary rounded-full" />
                    </div>
                    <span className="text-sm font-bold text-primary w-8 text-right">88%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Corp 1 / Corp 2 driver</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full w-[45%] bg-muted-foreground/40 rounded-full" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground w-8 text-right">~45%</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">WeGo drivers keep ~96% more of each fare compared to traditional platforms.</p>
            </div>

            <div className="bg-background border border-border rounded-xl p-4">
              <p className="text-sm font-semibold text-foreground mb-2">Cooperative Governance</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Each driver holds one seat with one vote. Platform fees, benefit allocations, and expansion decisions are all voted on democratically. No outside investors, no board override.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* ── HELP CENTER ──────────────────────────────────────────────────── */}
      {helpOpen && (
        <Modal title="Help Center" onClose={() => setHelpOpen(false)}>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Tap a question to expand the answer.</p>
            <div className="bg-background border border-border rounded-xl divide-y divide-border">
              {HELP_FAQS.map((faq, i) => (
                <div key={i} className="px-4 py-3">
                  <button type="button" onClick={() => toggleFaq(`help-${i}`)} className="w-full flex items-start justify-between gap-2 text-left">
                    <p className="text-sm font-medium text-foreground">{faq.q}</p>
                    {openFaq === `help-${i}` ? <ChevronUp size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" /> : <ChevronDown size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />}
                  </button>
                  {openFaq === `help-${i}` && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{faq.a}</p>}
                </div>
              ))}
            </div>
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-center space-y-2">
              <p className="text-sm font-semibold text-foreground">Still need help?</p>
              <p className="text-xs text-muted-foreground">Contact our support team — we typically respond within 24 hours.</p>
              <button type="button" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold active:scale-95 transition-transform">
                Contact Support
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── SIGN OUT ─────────────────────────────────────────────────────── */}
      {signOutOpen && (
        <Modal title="Sign Out" onClose={() => setSignOutOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Are you sure you want to sign out of your WeGo account?</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setSignOutOpen(false)}
                className="py-3 rounded-xl bg-muted/30 border border-border text-foreground font-semibold text-sm active:scale-95 transition-transform">
                Cancel
              </button>
              <button type="button" onClick={async () => { try { await logOut(); } catch {} }}
                className="py-3 rounded-xl bg-red-500 text-white font-semibold text-sm active:scale-95 transition-transform">
                Sign Out
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
