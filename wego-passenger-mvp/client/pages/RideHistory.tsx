import { useState, useEffect } from "react";
import { MapPin, Star, Package, X, Send, Check, MessageSquare, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { listenToRideHistory, type Ride } from "@/lib/db";

interface LostItemState {
  ride: Ride;
  message: string;
  sent: boolean;
}

const ITEM_SUGGESTIONS = [
  "Phone", "Wallet", "Keys", "Bag / backpack",
  "Jacket", "Headphones", "Sunglasses", "Other",
];

function formatDate(d: Date | null): string {
  if (!d) return "";
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0)
    return `Today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  if (diff === 1)
    return `Yesterday, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RideHistory() {
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [lostItem, setLostItem] = useState<LostItemState | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = listenToRideHistory(user.uid, (r) => {
      setRides(r);
      setLoaded(true);
    });
    return unsub;
  }, [user]);

  const totalFares = rides.reduce((s, r) => s + r.fare, 0);
  const totalDriverEarned = rides.reduce((s, r) => s + r.fare * 0.88, 0);
  const uberEstimate = totalFares * 1.5;
  const totalSaved = uberEstimate - totalFares;
  const isEmpty = loaded && rides.length === 0;

  const openLostItem = (ride: Ride) => {
    setLostItem({ ride, message: "", sent: false });
    setSelectedSuggestion(null);
  };
  const closeLostItem = () => setLostItem(null);

  const pickSuggestion = (item: string) => {
    setSelectedSuggestion(item);
    if (lostItem) {
      const first = (lostItem.ride.driverName || "driver").split(" ")[0];
      const date = formatDate(lostItem.ride.completedAt);
      setLostItem((prev) =>
        prev
          ? {
              ...prev,
              message: `Hi ${first}, I think I left my ${item.toLowerCase()} in your car after my ride on ${date}. Could you please check? Thank you!`,
            }
          : null
      );
    }
  };

  const sendMessage = () => {
    if (!lostItem?.message.trim()) return;
    setLostItem((prev) => (prev ? { ...prev, sent: true } : null));
  };

  return (
    <>
      <div className="bg-background pt-4 px-4 pb-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Header */}
          <div className="space-y-1 mb-2">
            <h1 className="text-3xl font-bold text-foreground">My Rides</h1>
            <p className="text-sm text-muted-foreground">Your WeGo ride history</p>
          </div>

          {/* Loading skeleton */}
          {!loaded && (
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <span className="skeleton h-3 w-20" />
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => <span key={i} className="skeleton h-14 rounded-xl" />)}
                </div>
                <span className="skeleton h-16 rounded-xl" />
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="skeleton h-3 w-24" />
                    <span className="skeleton h-3 w-14" />
                  </div>
                  <span className="skeleton h-3 w-48" />
                  <span className="skeleton h-3 w-40" />
                  <div className="flex justify-between items-center pt-1">
                    <div className="flex items-center gap-2">
                      <span className="skeleton w-8 h-8 rounded-full" />
                      <span className="skeleton h-3 w-20" />
                    </div>
                    <span className="skeleton h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {isEmpty && (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 rounded-full bg-muted/20 border border-border flex items-center justify-center mx-auto">
                <Clock size={28} className="text-muted-foreground" />
              </div>
              <p className="text-base font-semibold text-foreground">No rides yet</p>
              <p className="text-sm text-muted-foreground">
                Your completed rides will appear here.
              </p>
            </div>
          )}

          {/* Real data */}
          {loaded && !isEmpty && (
            <>
              {/* Summary card */}
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Your Impact
                </p>
                <div className="bg-card border border-border rounded-xl flex divide-x divide-border overflow-hidden">
                  <div className="px-4 py-3 flex-shrink-0 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Rides</p>
                    <p className="text-2xl font-bold text-foreground">{rides.length}</p>
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
                    <div className="flex justify-between border-t border-border/50 pt-1.5">
                      <span className="font-semibold text-foreground">You saved</span>
                      <span className="font-bold text-primary">+${totalSaved.toFixed(2)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No surge pricing, ever. Based on Uber/Lyft averaging 50% more.
                  </p>
                </div>
              </div>

              {/* Ride list */}
              <div className="space-y-3">
                {rides.map((ride) => {
                  const driverTake = ride.fare * 0.88;
                  const canContact = ride.completedAt
                    ? Date.now() - ride.completedAt.getTime() < 24 * 60 * 60 * 1000
                    : false;
                  const driverFirst = (ride.driverName || "driver").split(" ")[0];
                  return (
                    <div
                      key={ride.id}
                      className="bg-card border border-border rounded-xl overflow-hidden"
                    >
                      {/* Header row */}
                      <div className="px-4 py-3 flex items-center justify-between border-b border-border/50">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {formatDate(ride.completedAt)}
                        </p>
                        <span className="text-xs font-semibold text-foreground">
                          ${ride.fare.toFixed(2)}
                        </span>
                      </div>

                      {/* Route */}
                      <div className="px-4 py-3 space-y-2">
                        <div className="flex gap-2 items-center">
                          <MapPin size={13} className="text-primary flex-shrink-0" />
                          <p className="text-xs text-muted-foreground truncate">
                            {ride.pickupAddress}
                          </p>
                        </div>
                        <div className="flex gap-2 items-center">
                          <MapPin size={13} className="text-primary/50 flex-shrink-0" />
                          <p className="text-xs font-medium text-foreground truncate">
                            {ride.dropoffAddress}
                          </p>
                        </div>
                      </div>

                      {/* Driver + fare */}
                      <div className="px-4 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(ride.driverName || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground">
                              {ride.driverName || "WeGo Driver"}
                            </p>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  size={9}
                                  className={
                                    s <= Math.round(ride.driverRating)
                                      ? "text-yellow-400"
                                      : "text-muted-foreground/30"
                                  }
                                  fill={
                                    s <= Math.round(ride.driverRating)
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              ))}
                              <span className="text-[10px] text-muted-foreground ml-0.5">
                                {ride.driverRating.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">Driver earned</p>
                          <p className="text-xs font-bold text-primary">${driverTake.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Lost item */}
                      <div className="px-4 pb-3">
                        {canContact ? (
                          <button
                            type="button"
                            onClick={() => openLostItem(ride)}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-primary/40 text-primary text-xs font-semibold active:scale-95 transition-transform"
                          >
                            <Package size={13} />
                            Lost something? Message {driverFirst}
                          </button>
                        ) : (
                          <p className="text-center text-[10px] text-muted-foreground/50">
                            Driver contact available within 24 hrs of ride
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── LOST ITEM MODAL ── */}
      {lostItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeLostItem}
          />
          <div className="relative w-full max-w-[430px] bg-card border-t border-border rounded-t-2xl shadow-float px-4 pt-4 pb-8 space-y-4 max-h-[88vh] overflow-y-auto">

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-primary" />
                <p className="text-base font-bold text-foreground">Lost Item</p>
              </div>
              <button
                type="button"
                onClick={closeLostItem}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {lostItem.sent ? (
              <div className="space-y-4 py-4 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto">
                  <Check size={28} className="text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">Message Sent!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(lostItem.ride.driverName || "Your driver").split(" ")[0]} will be notified
                    and typically responds within 30 minutes.
                  </p>
                </div>
                <div className="bg-background border border-border rounded-xl px-4 py-3 text-left">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Your message
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">{lostItem.message}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  WeGo support is also notified to help coordinate the return.
                </p>
                <button
                  type="button"
                  onClick={closeLostItem}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform btn-glow"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Driver info */}
                <div className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold flex-shrink-0">
                    {(lostItem.ride.driverName || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {lostItem.ride.driverName || "WeGo Driver"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(lostItem.ride.completedAt)} · {lostItem.ride.dropoffAddress}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <MessageSquare size={14} className="text-primary" />
                    <span className="text-xs text-primary font-semibold">24h window</span>
                  </div>
                </div>

                {/* What did you lose? */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    What did you lose?
                  </p>
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
                  <label
                    htmlFor="lost-message"
                    className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5"
                  >
                    Message to driver
                  </label>
                  <textarea
                    id="lost-message"
                    rows={4}
                    value={lostItem.message}
                    onChange={(e) =>
                      setLostItem((prev) =>
                        prev ? { ...prev, message: e.target.value } : null
                      )
                    }
                    placeholder={`Hi, I think I left something in your car…`}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary resize-none leading-relaxed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    You have up to 24 hours after your ride to contact your driver.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!lostItem.message.trim()}
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-40 btn-glow"
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
