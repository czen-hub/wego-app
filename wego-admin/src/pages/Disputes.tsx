import { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/firebase";
import type { Ride } from "@/types";
import { AlertTriangle, CheckCircle } from "lucide-react";

function tsToDate(ts: Timestamp | null): Date | null {
  if (!ts) return null;
  return ts instanceof Timestamp ? ts.toDate() : new Date((ts as { seconds: number }).seconds * 1000);
}

export default function Disputes() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = async () => {
    const [disputedSnap, blockedSnap] = await Promise.all([
      getDocs(query(collection(db, "rides"), where("disputed", "==", true))),
      getDocs(query(collection(db, "rides"), where("chargeBlocked", "==", true))),
    ]);
    const all = new Map<string, Ride>();
    [...disputedSnap.docs, ...blockedSnap.docs].forEach((d) => {
      all.set(d.id, { id: d.id, ...d.data() } as Ride);
    });
    setRides([...all.values()].sort((a, b) => {
      const da = tsToDate(a.requestedAt)?.getTime() ?? 0;
      const db2 = tsToDate(b.requestedAt)?.getTime() ?? 0;
      return db2 - da;
    }));
    setLoading(false);
  };

  useEffect(() => { load().catch(console.error); }, []);

  const resolveDispute = async (rideId: string) => {
    setResolving(rideId);
    try {
      await updateDoc(doc(db, "rides", rideId), {
        disputed: false,
        chargeBlocked: false,
        disputeResolvedAt: new Date(),
      });
      setRides((prev) => prev.filter((r) => r.id !== rideId));
    } catch (e) {
      console.error(e);
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Disputes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Rides flagged as disputed or charge-blocked
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : rides.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center space-y-3">
          <CheckCircle size={40} className="text-green-500 mx-auto" />
          <p className="text-foreground font-semibold">No open disputes</p>
          <p className="text-sm text-muted-foreground">All clear — no rides are currently flagged.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rides.map((ride) => {
            const date = tsToDate(ride.requestedAt);
            return (
              <div key={ride.id} className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertTriangle size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">{ride.passengerName || "Unknown passenger"}</p>
                        {ride.disputed && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600">Disputed</span>
                        )}
                        {ride.chargeBlocked && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">Charge Blocked</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Driver: <span className="text-foreground">{ride.driverName || "Unassigned"}</span>
                        {date && <span> · {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-foreground">${ride.fare?.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{ride.status}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-secondary/40 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Pickup</p>
                    <p className="text-foreground text-xs leading-snug">{ride.pickupAddress || "—"}</p>
                  </div>
                  <div className="bg-secondary/40 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Dropoff</p>
                    <p className="text-foreground text-xs leading-snug">{ride.dropoffAddress || "—"}</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => resolveDispute(ride.id)}
                    disabled={resolving === ride.id}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-700 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {resolving === ride.id ? (
                      <span className="w-4 h-4 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
                    ) : (
                      <CheckCircle size={15} />
                    )}
                    Mark Resolved
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
