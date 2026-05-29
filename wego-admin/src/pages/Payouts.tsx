import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/firebase";
import type { WithdrawalRequest } from "@/types";
import { CheckCircle, XCircle, Clock } from "lucide-react";

function tsToDate(ts: Timestamp | null | undefined): Date | null {
  if (!ts) return null;
  return ts instanceof Timestamp ? ts.toDate() : new Date((ts as { seconds: number }).seconds * 1000);
}

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-500/15 text-amber-700",
  paid:     "bg-green-500/15 text-green-700",
  rejected: "bg-red-500/15 text-red-700",
};

export default function Payouts() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "rejected">("pending");

  useEffect(() => {
    getDocs(query(collection(db, "withdrawalRequests"), orderBy("requestedAt", "desc")))
      .then((snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WithdrawalRequest)));
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const markPaid = async (id: string) => {
    setProcessing(id);
    try {
      await updateDoc(doc(db, "withdrawalRequests", id), {
        status: "paid",
        paidAt: new Date(),
      });
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "paid" } : r));
    } finally {
      setProcessing(null);
    }
  };

  const markRejected = async (id: string) => {
    setProcessing(id);
    try {
      await updateDoc(doc(db, "withdrawalRequests", id), { status: "rejected" });
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "rejected" } : r));
    } finally {
      setProcessing(null);
    }
  };

  const filtered   = filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const pendingAmt = requests.filter((r) => r.status === "pending").reduce((s, r) => s + (r.amount ?? 0), 0);
  const paidAmt    = requests.filter((r) => r.status === "paid").reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payouts</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          ${pendingAmt.toFixed(2)} pending · ${paidAmt.toFixed(2)} paid total
        </p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4 text-sm text-amber-800 leading-relaxed">
        <strong>Manual payout process:</strong> After confirming a driver's bank account in their driver profile, transfer the amount via your bank or Venmo, then click "Mark as Paid" to record it.
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["pending", "paid", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
              filter === s ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? `All (${requests.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${requests.filter(r => r.status === s).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <p className="text-sm text-muted-foreground">No {filter !== "all" ? filter : ""} payout requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const date = tsToDate(req.requestedAt);
            return (
              <div key={req.id} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 font-bold">
                      $
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{req.driverName || req.driverId}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[req.status] ?? "bg-muted text-muted-foreground"}`}>
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Requested {date?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? "—"}
                        {req.status === "paid" && tsToDate(req.paidAt) && (
                          <> · Paid {tsToDate(req.paidAt)!.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-foreground">${req.amount?.toFixed(2)}</p>
                  </div>
                </div>

                {req.status === "pending" && (
                  <div className="flex gap-2 mt-4 justify-end">
                    <button
                      onClick={() => markRejected(req.id)}
                      disabled={processing === req.id}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {processing === req.id ? <span className="w-3.5 h-3.5 rounded-full border-2 border-red-500 border-t-transparent animate-spin" /> : <XCircle size={15} />}
                      Reject
                    </button>
                    <button
                      onClick={() => markPaid(req.id)}
                      disabled={processing === req.id}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-700 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {processing === req.id ? <span className="w-3.5 h-3.5 rounded-full border-2 border-green-600 border-t-transparent animate-spin" /> : <CheckCircle size={15} />}
                      Mark as Paid
                    </button>
                  </div>
                )}

                {req.status === "paid" && (
                  <div className="flex items-center gap-2 mt-4 text-green-600 text-xs font-medium">
                    <CheckCircle size={13} />
                    Paid out manually
                  </div>
                )}

                {req.status === "rejected" && (
                  <div className="flex items-center gap-2 mt-4 text-red-600 text-xs font-medium">
                    <XCircle size={13} />
                    Request rejected
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
