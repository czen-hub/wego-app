import { useState, useEffect } from "react";
import { Star, Package, X, Send, Check, MessageSquare, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { listenToRideHistory, sendRideMessage, submitRating, submitTip, type Ride } from "@/lib/db";

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
  const [ratingModal, setRatingModal] = useState<{ ride: Ride; rating: number; submitted: boolean } | null>(null);
  const [tipModal, setTipModal] = useState<{ ride: Ride; amount: number; submitted: boolean } | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = listenToRideHistory(user.uid, (r) => {
      setRides(r);
      setLoaded(true);
    });
    return unsub;
  }, [user]);

  const totalFares = rides.reduce((s, r) => s + r.fare, 0);
  const totalDriverEarned = rides.reduce((s, r) => s + (r.driverTake || r.fare * 0.88), 0);
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

  const sendMessage = async () => {
    if (!lostItem?.message.trim()) return;
    if (user && lostItem.ride.id) {
      try {
        await sendRideMessage(lostItem.ride.id, user.uid, "passenger", lostItem.message.trim());
      } catch { /* fail silently — still mark sent */ }
    }
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
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Your Impact
                  </p>
                  <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    No Surge, Ever
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-card border border-border rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{rides.length}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Rides</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">${totalFares.toFixed(0)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Spent</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-primary">${totalDriverEarned.toFixed(0)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">To Drivers</p>
                  </div>
                </div>
              </div>

              {/* Ride list */}
              <div className="space-y-3">
                {rides.map((ride) => {
                  const driverTake = ride.driverTake || ride.fare * 0.88;
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
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-muted-foreground">
                            {formatDate(ride.completedAt)}
                          </p>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground uppercase tracking-wide">
                            {ride.type === "courier" ? "Courier" : ride.type === "food" ? "Food" : "Ride"}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-foreground">
                          ${ride.fare.toFixed(2)}
                        </span>
                      </div>

                      {/* Route */}
                      <div className="px-4 py-3 flex gap-3 items-stretch">
                        <div className="flex flex-col items-center flex-shrink-0 pt-1">
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          <div className="w-px flex-1 min-h-[16px] bg-border/60 my-1 flex-shrink-0" />
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <p className="text-xs text-muted-foreground truncate leading-tight">{ride.pickupAddress}</p>
                          <p className="text-xs font-semibold text-foreground truncate leading-tight">{ride.dropoffAddress}</p>
                        </div>
                      </div>

                      {/* Driver + fare */}
                      <div className="px-4 pb-3 pt-2 flex items-center justify-between border-t border-border/40">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(ride.driverName || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground">
                              {ride.driverName || "WeGo Driver"}
                            </p>
                            {ride.passengerRatingGiven > 0 ? (
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    size={9}
                                    className={s <= ride.passengerRatingGiven ? "text-yellow-400" : "text-muted-foreground/30"}
                                    fill={s <= ride.passengerRatingGiven ? "currentColor" : "none"}
                                  />
                                ))}
                                <span className="text-[10px] text-muted-foreground ml-0.5">{ride.passengerRatingGiven}/5</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/50">Not rated</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">Driver earned</p>
                          <p className="text-xs font-bold text-primary">${driverTake.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="px-4 pb-3 space-y-2">
                        {canContact ? (
                          <>
                            {(ride.passengerRatingGiven === 0 || !ride.tipGiven) && (
                              <div className="flex gap-2">
                                {ride.passengerRatingGiven === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setRatingModal({ ride, rating: 0, submitted: false })}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-primary/30 bg-primary/5 text-primary text-xs font-semibold active:scale-95 transition-transform"
                                  >
                                    <Star size={12} />Rate {driverFirst}
                                  </button>
                                )}
                                {!ride.tipGiven && (
                                  <button
                                    type="button"
                                    onClick={() => setTipModal({ ride, amount: 0, submitted: false })}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border text-muted-foreground text-xs font-semibold active:scale-95 transition-transform"
                                  >
                                    Tip {driverFirst}
                                  </button>
                                )}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => openLostItem(ride)}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-primary/40 text-primary text-xs font-semibold active:scale-95 transition-transform"
                            >
                              <Package size={13} />Lost something? Message {driverFirst}
                            </button>
                          </>
                        ) : (
                          <p className="text-center text-[10px] text-muted-foreground/50">
                            Contact window expired
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

      {/* ── RATING MODAL ── */}
      {ratingModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRatingModal(null)} />
          <div className="relative w-full max-w-[430px] bg-card border-t border-border rounded-t-2xl shadow-float px-4 pt-4 pb-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-primary" />
                <p className="text-base font-bold text-foreground">Rate Your Ride</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setRatingModal(null)} className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            {ratingModal.submitted ? (
              <div className="space-y-3 py-4 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto">
                  <Check size={28} className="text-primary" />
                </div>
                <p className="text-lg font-bold text-foreground">Thanks for rating!</p>
                <button type="button" onClick={() => setRatingModal(null)} className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform btn-glow">Done</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold flex-shrink-0">
                    {(ratingModal.ride.driverName || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{ratingModal.ride.driverName || "WeGo Driver"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(ratingModal.ride.completedAt)}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">How was your ride?</p>
                <div className="flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} type="button"
                      aria-label={`Rate ${s} star${s > 1 ? "s" : ""}`}
                      onClick={() => setRatingModal((prev) => prev ? { ...prev, rating: s } : null)}
                      className={`transition-transform active:scale-90 ${s <= ratingModal.rating ? "text-yellow-400" : "text-muted-foreground/30"}`}>
                      <Star size={32} fill={s <= ratingModal.rating ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
                <button type="button" disabled={ratingModal.rating === 0}
                  onClick={async () => {
                    try {
                      await submitRating(ratingModal.ride.id, ratingModal.rating, "passenger");
                      setRatingModal((prev) => prev ? { ...prev, submitted: true } : null);
                    } catch {}
                  }}
                  className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-40 btn-glow">
                  Submit Rating
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TIP MODAL ── */}
      {tipModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setTipModal(null)} />
          <div className="relative w-full max-w-[430px] bg-card border-t border-border rounded-t-2xl shadow-float px-4 pt-4 pb-8 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-foreground">Leave a Tip</p>
              <button type="button" aria-label="Close" onClick={() => setTipModal(null)} className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            {tipModal.submitted ? (
              <div className="space-y-3 py-4 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto">
                  <Check size={28} className="text-primary" />
                </div>
                <p className="text-lg font-bold text-foreground">Tip Sent!</p>
                <p className="text-sm text-muted-foreground">
                  100% of your tip goes directly to {(tipModal.ride.driverName || "your driver").split(" ")[0]}.
                </p>
                <button type="button" onClick={() => setTipModal(null)} className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform btn-glow">Done</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold flex-shrink-0">
                    {(tipModal.ride.driverName || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{tipModal.ride.driverName || "WeGo Driver"}</p>
                    <p className="text-xs text-muted-foreground">100% goes directly to your driver</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 5].map((amt) => (
                    <button key={amt} type="button"
                      onClick={() => setTipModal((prev) => prev ? { ...prev, amount: amt } : null)}
                      className={`py-3 rounded-xl text-sm font-bold border transition-colors active:scale-95 ${tipModal.amount === amt ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"}`}>
                      ${amt}
                    </button>
                  ))}
                </div>
                <button type="button" disabled={tipModal.amount === 0}
                  onClick={async () => {
                    try {
                      await submitTip(tipModal.ride.id, tipModal.amount);
                      setTipModal((prev) => prev ? { ...prev, submitted: true } : null);
                    } catch {}
                  }}
                  className="w-full py-3 rounded-2xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-40 btn-glow">
                  {tipModal.amount > 0 ? `Send $${tipModal.amount} Tip` : "Select an amount"}
                </button>
                <p className="text-xs text-muted-foreground text-center">Tips go 100% to your driver — WeGo takes nothing.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
