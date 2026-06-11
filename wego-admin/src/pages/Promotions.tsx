import { useEffect, useState } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs, query, orderBy, writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase";
import {
  Plane, Music, Target, Package, UtensilsCrossed, Car,
  Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, Tag, Megaphone, Send, Users, User,
} from "lucide-react";

interface Driver { id: string; name: string; email?: string; }

interface Opportunity {
  id: string;
  title: string;
  detail: string;
  bonus: string;
  tag: string;
  iconName: string;
  active: boolean;
}

const ICON_OPTIONS = [
  { name: "Plane",          Icon: Plane },
  { name: "Music",          Icon: Music },
  { name: "Target",         Icon: Target },
  { name: "Package",        Icon: Package },
  { name: "UtensilsCrossed",Icon: UtensilsCrossed },
  { name: "Car",            Icon: Car },
];

const ICON_MAP: Record<string, React.ElementType> = {
  Plane, Music, Target, Package, UtensilsCrossed, Car,
};

const EMPTY_FORM = { title: "", detail: "", bonus: "", tag: "", iconName: "Target", active: true };

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative rounded-full transition-colors duration-300 flex-shrink-0 h-[22px] w-10 ${on ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${on ? "translate-x-[20px]" : "translate-x-[3px]"}`} />
    </button>
  );
}

const EMPTY_MSG = { title: "", body: "", type: "earnings" as "earnings" | "coop" | "notification", targetAll: true, driverId: "" };

export default function Promotions() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Opportunity | null>(null);

  // Inbox notification state
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [msgForm, setMsgForm] = useState(EMPTY_MSG);
  const [msgSending, setMsgSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);

  useEffect(() => {
    getDocs(query(collection(db, "drivers"), orderBy("name", "asc")))
      .then((snap) => setDrivers(snap.docs.map((d) => ({ id: d.id, name: d.data().name ?? d.id, email: d.data().email }))));
  }, []);

  const sendNotification = async () => {
    if (!msgForm.title.trim() || !msgForm.body.trim()) return;
    setMsgSending(true);
    try {
      const payload = {
        title: msgForm.title.trim(),
        body: msgForm.body.trim(),
        type: msgForm.type,
        read: false,
        createdAt: serverTimestamp(),
      };
      if (msgForm.targetAll) {
        const batch = writeBatch(db);
        drivers.forEach((d) => {
          batch.set(doc(collection(db, "messages")), { ...payload, driverId: d.id });
        });
        await batch.commit();
      } else if (msgForm.driverId) {
        await addDoc(collection(db, "messages"), { ...payload, driverId: msgForm.driverId });
      }
      setMsgSent(true);
      setMsgForm(EMPTY_MSG);
      setTimeout(() => setMsgSent(false), 3000);
    } finally {
      setMsgSending(false);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "opportunities"), (snap) => {
      setOpps(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Opportunity))
          .sort((a, b) => Number(b.active) - Number(a.active))
      );
      setLoading(false);
    });
    return unsub;
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (opp: Opportunity) => {
    setEditing(opp);
    setForm({ title: opp.title, detail: opp.detail, bonus: opp.bonus, tag: opp.tag, iconName: opp.iconName, active: opp.active });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSave = async () => {
    if (!form.title.trim() || !form.bonus.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title:    form.title.trim(),
        detail:   form.detail.trim(),
        bonus:    form.bonus.trim(),
        tag:      form.tag.trim(),
        iconName: form.iconName,
        active:   form.active,
      };
      if (editing) {
        await updateDoc(doc(db, "opportunities", editing.id), payload);
      } else {
        await addDoc(collection(db, "opportunities"), { ...payload, createdAt: serverTimestamp() });
      }
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (opp: Opportunity) => {
    await updateDoc(doc(db, "opportunities", opp.id), { active: !opp.active });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, "opportunities", deleteTarget.id));
    setDeleteTarget(null);
  };

  const active   = opps.filter((o) => o.active);
  const inactive = opps.filter((o) => !o.active);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Promotions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {active.length} active · {inactive.length} inactive
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 active:scale-95 transition-all"
        >
          <Plus size={15} />
          New Promotion
        </button>
      </div>

      {/* ── SEND INBOX NOTIFICATION ── */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4 max-w-3xl">
        <div className="flex items-center gap-2">
          <Send size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Send Driver Inbox Notification</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Title <span className="text-destructive">*</span></label>
            <input
              type="text"
              placeholder="Weekend Bonus Active"
              value={msgForm.title}
              onChange={(e) => setMsgForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Type</label>
            <select
              aria-label="Message type"
              value={msgForm.type}
              onChange={(e) => setMsgForm((f) => ({ ...f, type: e.target.value as typeof f.type }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:border-primary"
            >
              <option value="earnings">Promotion (Earnings tab)</option>
              <option value="coop">Co-op Update (All tab)</option>
              <option value="notification">Alert (Alerts tab)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">Message <span className="text-destructive">*</span></label>
          <textarea
            placeholder="Earn extra $5 per ride this Saturday 6–9pm near SFO."
            rows={3}
            value={msgForm.body}
            onChange={(e) => setMsgForm((f) => ({ ...f, body: e.target.value }))}
            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              type="button"
              onClick={() => setMsgForm((f) => ({ ...f, targetAll: true }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${msgForm.targetAll ? "bg-primary text-white border-primary" : "bg-secondary text-muted-foreground border-border"}`}
            >
              <Users size={13} /> All Drivers ({drivers.length})
            </button>
            <button
              type="button"
              onClick={() => setMsgForm((f) => ({ ...f, targetAll: false }))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${!msgForm.targetAll ? "bg-primary text-white border-primary" : "bg-secondary text-muted-foreground border-border"}`}
            >
              <User size={13} /> Specific Driver
            </button>
            {!msgForm.targetAll && (
              <select
                aria-label="Select driver"
                value={msgForm.driverId}
                onChange={(e) => setMsgForm((f) => ({ ...f, driverId: e.target.value }))}
                className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Select driver…</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>
          <button
            type="button"
            onClick={sendNotification}
            disabled={msgSending || !msgForm.title.trim() || !msgForm.body.trim() || (!msgForm.targetAll && !msgForm.driverId)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {msgSending ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Send size={14} />}
            {msgSending ? "Sending…" : "Send"}
          </button>
        </div>

        {msgSent && (
          <p className="text-xs font-semibold text-green-600">✓ Notification sent to {msgForm.targetAll ? "all drivers" : "driver"} successfully.</p>
        )}
      </div>

      <div className="border-t border-border pt-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-foreground">Map Opportunities</h2>
          <p className="text-xs text-muted-foreground">Shown on driver home screen map drawer</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : opps.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
          <Megaphone size={32} className="opacity-30" />
          <p className="text-sm">No promotions yet. Create one to display on driver home screens.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 max-w-3xl">
          {opps.map((opp) => {
            const Icon = ICON_MAP[opp.iconName] ?? Target;
            return (
              <div
                key={opp.id}
                className={`bg-card border rounded-2xl p-4 flex items-start gap-4 transition-opacity ${opp.active ? "border-border" : "border-border opacity-50"}`}
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground">{opp.title}</p>
                    {opp.tag && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">{opp.tag}</span>
                    )}
                    {!opp.active && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>
                    )}
                  </div>
                  {opp.detail && <p className="text-xs text-muted-foreground mt-0.5">{opp.detail}</p>}
                  <p className="text-sm font-bold text-primary mt-1">{opp.bonus}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Toggle on={opp.active} onToggle={() => toggleActive(opp)} />
                  <button
                    type="button"
                    onClick={() => openEdit(opp)}
                    className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-primary/10 transition-colors"
                  >
                    <Pencil size={13} className="text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(opp)}
                    className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={13} className="text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">
                {editing ? "Edit Promotion" : "New Promotion"}
              </h2>
              <button type="button" onClick={closeModal} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Title <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  placeholder="Airport Rush Bonus"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Detail */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Description</label>
                <textarea
                  placeholder="Extra $5 per airport ride this weekend"
                  rows={2}
                  value={form.detail}
                  onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Bonus + Tag row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Bonus <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    placeholder="+$5"
                    value={form.bonus}
                    onChange={(e) => setForm((f) => ({ ...f, bonus: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Tag</label>
                  <input
                    type="text"
                    placeholder="Limited Time"
                    value={form.tag}
                    onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Icon picker */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Icon</label>
                <div className="flex gap-2">
                  {ICON_OPTIONS.map(({ name, Icon }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, iconName: name }))}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${form.iconName === name ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:bg-primary/10"}`}
                    >
                      <Icon size={17} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-semibold text-foreground">Active</p>
                  <p className="text-xs text-muted-foreground">Show on driver home screens immediately</p>
                </div>
                <Toggle on={form.active} onToggle={() => setForm((f) => ({ ...f, active: !f.active }))} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 pb-5">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.bonus.trim()}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving…" : editing ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-destructive" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Delete promotion?</p>
                <p className="text-xs text-muted-foreground mt-0.5">"{deleteTarget.title}" will be removed from all driver home screens.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
