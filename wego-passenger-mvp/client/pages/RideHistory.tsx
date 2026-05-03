import { useState } from "react";
import { MapPin, Star, ChevronRight, Package, X, Send, Check, MessageSquare } from "lucide-react";

interface RideRecord {
  id: string;
  date: string;
  hoursAgo: number; // for 24-hour window check
  from: string;
  to: string;
  fare: number;
  driverTake: number;
  coopFee: number;
  driverName: string;
  driverRating: number;
  yourRating: number;
  duration: string;
}

const RIDE_HISTORY: RideRecord[] = [
  {
    id: "r001",
    date: "Today, Apr 30",
    hoursAgo: 2,
    from: "Current Location",
    to: "456 Valencia St, San Francisco",
    fare: 38.00,
    driverTake: 33.44,
    coopFee: 4.56,
    driverName: "Marcus T.",
    driverRating: 4.94,
    yourRating: 5,
    duration: "18 min",
  },
  {
    id: "r002",
    date: "Apr 27",
    hoursAgo: 75,
    from: "SFO Terminal 2",
    to: "555 California St, San Francisco",
    fare: 52.00,
    driverTake: 45.76,
    coopFee: 6.24,
    driverName: "Priya S.",
    driverRating: 4.88,
    yourRating: 5,
    duration: "34 min",
  },
  {
    id: "r003",
    date: "Apr 23",
    hoursAgo: 170,
    from: "Chase Center",
    to: "1234 Mission St, San Francisco",
    fare: 24.00,
    driverTake: 21.12,
    coopFee: 2.88,
    driverName: "James W.",
    driverRating: 4.91,
    yourRating: 4,
    duration: "12 min",
  },
  {
    id: "r004",
    date: "Apr 19",
    hoursAgo: 264,
    from: "Union Square",
    to: "Berkeley Marina",
    fare: 61.00,
    driverTake: 53.68,
    coopFee: 7.32,
    driverName: "Aisha K.",
    driverRating: 5.00,
    yourRating: 5,
    duration: "42 min",
  },
  {
    id: "r005",
    date: "Apr 14",
    hoursAgo: 384,
    from: "Caltrain Station",
    to: "Google Campus, Mountain View",
    fare: 78.00,
    driverTake: 68.64,
    coopFee: 9.36,
    driverName: "Carlos M.",
    driverRating: 4.79,
    yourRating: 5,
    duration: "55 min",
  },
];

const totalFares = RIDE_HISTORY.reduce((s, r) => s + r.fare, 0);
const totalDriverEarned = RIDE_HISTORY.reduce((s, r) => s + r.driverTake, 0);
const SURGE_MULTIPLIER = 1.5;
const uberEstimate = totalFares * SURGE_MULTIPLIER;
const totalSaved = uberEstimate - totalFares;

const ITEM_SUGGESTIONS = ["Phone", "Wallet", "Keys", "Bag / backpack", "Jacket", "Headphones", "Sunglasses", "Other"];

interface LostItemState {
  ride: RideRecord;
  message: string;
  sent: boolean;
}

export default function RideHistory() {
  const [lostItem, setLostItem] = useState<LostItemState | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  const openLostItem = (ride: RideRecord) => {
    setLostItem({ ride, message: "", sent: false });
    setSelectedSuggestion(null);
  };

  const closeLostItem = () => setLostItem(null);

  const pickSuggestion = (item: string) => {
    setSelectedSuggestion(item);
    if (lostItem) {
      const base = `Hi ${lostItem.ride.driverName.split(" ")[0]}, I think I left my ${item.toLowerCase()} in your car after my ride on ${lostItem.ride.date}. Could you please check? Thank you!`;
      setLostItem((prev) => prev ? { ...prev, message: base } : null);
    }
  };

  const sendMessage = () => {
    if (!lostItem?.message.trim()) return;
    setLostItem((prev) => prev ? { ...prev, sent: true } : null);
  };

  return (
    <>
      <div className="bg-background pt-4 px-4 pb-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Header */}
          <div className="space-y-1 mb-2">
            <h1 className="text-3xl font-bold text-foreground">My Rides</h1>
            <p className="text-muted-foreground text-sm">Your WeGo ride history</p>
          </div>

          {/* Summary card */}
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Impact</p>

            {/* 3 stats — unified bar with dividers */}
            <div className="bg-card border border-border rounded-xl flex divide-x divide-border overflow-hidden">
              <div className="px-4 py-3 flex-shrink-0 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Rides</p>
                <p className="text-2xl font-bold text-foreground">{RIDE_HISTORY.length}</p>
              </div>
              <div className="px-4 py-3 flex-1 min-w-0 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Spent</p>
                <p className="text-2xl font-bold text-foreground">${totalFares.toFixed(0)}</p>
              </div>
              <div className="px-4 py-3 flex-1 min-w-0 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">To Drivers</p>
                <p className="text-2xl font-bold text-primary">${totalDriverEarned.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">88% of fares</p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-3 space-y-2">
              <p className="text-xs text-muted-foreground">Saved vs. Uber / Lyft</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uber / Lyft estimate</span>
                  <span className="line-through text-muted-foreground">${uberEstimate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground font-medium">WeGo (what you paid)</span>
                  <span className="font-semibold text-foreground">${totalFares.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1.5 mt-0.5">
                  <span className="font-semibold text-foreground">You saved</span>
                  <span className="font-bold text-primary">+${totalSaved.toFixed(2)}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">No surge pricing, ever. Based on Uber/Lyft averaging 50% more.</p>
            </div>
          </div>

          {/* Ride list */}
          <div className="space-y-3">
            {RIDE_HISTORY.map((ride) => {
              const canContact = ride.hoursAgo <= 24;
              return (
                <div key={ride.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  {/* Header row */}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground">{ride.date}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-foreground">${ride.fare.toFixed(2)}</span>
                      <ChevronRight size={12} className="text-muted-foreground" />
                    </div>
                  </div>

                  {/* Route */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      <MapPin size={13} className="text-primary flex-shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">{ride.from}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <MapPin size={13} className="text-primary/50 flex-shrink-0" />
                      <p className="text-xs font-medium text-foreground truncate">{ride.to}</p>
                    </div>
                  </div>

                  {/* Driver + breakdown */}
                  <div className="px-4 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {ride.driverName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{ride.driverName}</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={9}
                              className={s <= ride.yourRating ? "text-yellow-400" : "text-muted-foreground/30"}
                              fill={s <= ride.yourRating ? "currentColor" : "none"}
                            />
                          ))}
                          <span className="text-[10px] text-muted-foreground ml-0.5">{ride.duration}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">Driver earned</p>
                      <p className="text-xs font-bold text-primary">${ride.driverTake.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Lost item row */}
                  <div className="px-4 pb-3">
                    {canContact ? (
                      <button
                        type="button"
                        onClick={() => openLostItem(ride)}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-primary/40 text-primary text-xs font-semibold active:scale-95 transition-transform"
                      >
                        <Package size={13} />
                        Lost something? Message {ride.driverName.split(" ")[0]}
                      </button>
                    ) : (
                      <p className="text-center text-[10px] text-muted-foreground/50">
                        Driver messaging available within 24 hrs of ride
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* ── LOST ITEM MODAL ──────────────────────────────────────────────── */}
      {lostItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeLostItem} />
          <div className="relative w-full max-w-[430px] bg-card border-t border-border rounded-t-2xl shadow-2xl px-4 pt-4 pb-8 space-y-4 max-h-[88vh] overflow-y-auto">

            {/* Title */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-primary" />
                <p className="text-base font-bold text-foreground">Lost Item</p>
              </div>
              <button type="button" onClick={closeLostItem} aria-label="Close" className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {lostItem.sent ? (
              /* ── Sent confirmation ── */
              <div className="space-y-4 py-4 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto">
                  <Check size={28} className="text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">Message Sent!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {lostItem.ride.driverName.split(" ")[0]} will be notified and typically responds within 30 minutes.
                  </p>
                </div>
                <div className="bg-background border border-border rounded-xl px-4 py-3 text-left">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Your message</p>
                  <p className="text-sm text-foreground leading-relaxed">{lostItem.message}</p>
                </div>
                <p className="text-xs text-muted-foreground">WeGo support is also notified to help coordinate the return.</p>
                <button type="button" onClick={closeLostItem}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform">
                  Done
                </button>
              </div>
            ) : (
              /* ── Compose ── */
              <div className="space-y-4">
                {/* Driver info */}
                <div className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold flex-shrink-0">
                    {lostItem.ride.driverName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{lostItem.ride.driverName}</p>
                    <p className="text-xs text-muted-foreground">{lostItem.ride.date} · {lostItem.ride.to}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <MessageSquare size={14} className="text-primary" />
                    <span className="text-xs text-primary font-semibold">24h window</span>
                  </div>
                </div>

                {/* What did you lose? */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">What did you lose?</p>
                  <div className="flex flex-wrap gap-2">
                    {ITEM_SUGGESTIONS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => pickSuggestion(item)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors active:scale-95 ${
                          selectedSuggestion === item
                            ? "bg-primary text-white border-primary"
                            : "bg-background border-border text-foreground"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="lost-message" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">
                    Message to driver
                  </label>
                  <textarea
                    id="lost-message"
                    rows={4}
                    value={lostItem.message}
                    onChange={(e) => setLostItem((prev) => prev ? { ...prev, message: e.target.value } : null)}
                    placeholder={`Hi ${lostItem.ride.driverName.split(" ")[0]}, I think I left something in your car...`}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary resize-none leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">You have up to 24 hours after your ride to contact your driver.</p>
                </div>

                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!lostItem.message.trim()}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-40"
                >
                  <Send size={15} />
                  Send Message
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
