import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Zap, Cpu, Shield, History } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { listenToCompletedRides, type Ride } from "@/lib/db";

function calcStats(rs: Ride[]) {
  const gross = rs.reduce((s, r) => s + r.fare + (r.stopFeeTotal ?? 0), 0);
  const coop  = rs.reduce((s, r) => s + r.coopFee, 0);
  const take  = rs.reduce((s, r) => s + r.driverTake + (r.stopFeeTotal ?? 0), 0);
  return { gross, coop, take, count: rs.length };
}

export default function Earnings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = listenToCompletedRides(user.uid, (r) => {
      setRides(r);
      setLoaded(true);
    });
    return unsub;
  }, [user]);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekRides = rides.filter(r => r.completedAt && r.completedAt >= weekAgo);

  const week = calcStats(weekRides);
  const all  = calcStats(rides);

  const standardPayout  = week.gross * 0.52;
  const wegoAdvantage   = week.take - standardPayout;
  const hardwareReserve = week.coop * 0.5;
  const platformOps     = week.coop * 0.30;
  const insurance       = week.coop * 0.20;

  const noWeek    = loaded && week.count === 0;
  const hasWeek   = loaded && week.count > 0;
  const hasAllTime = loaded && all.count > 0;

  return (
    <div className="bg-background pt-4 px-4 pb-6">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">Transparency Ledger</h1>
            <p className="text-muted-foreground text-sm">Your earnings with full breakdown</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/history")}
            className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border rounded-xl text-xs font-semibold text-foreground active:scale-95 transition-transform whitespace-nowrap"
          >
            <History size={13} className="text-primary" />
            History
          </button>
        </div>

        {/* Loading shimmer */}
        {!loaded && (
          <div className="p-6 border border-primary/20 rounded-xl bg-primary/5 animate-pulse space-y-3">
            <div className="h-3 w-24 bg-muted/40 rounded" />
            <div className="h-14 w-40 bg-muted/40 rounded" />
          </div>
        )}

        {/* ── THIS WEEK hero ── */}
        {hasWeek && (
          <>
            <div className="p-6 border border-primary/20 rounded-xl space-y-3 bg-primary/5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">This Week · Live</p>
              <div className="space-y-1">
                <p className="text-6xl font-bold text-primary leading-tight">${week.take.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Your net take-home earnings</p>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/30">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Rides</p>
                  <p className="text-2xl font-bold text-foreground">{week.count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Gross</p>
                  <p className="text-2xl font-bold text-foreground">${week.gross.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">WeGo Fee</p>
                  <p className="text-lg font-bold text-destructive">-${week.coop.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* WeGo Advantage */}
            <div className="p-5 border border-primary/20 rounded-xl space-y-4 bg-primary/5">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">The WeGo Advantage — This Week</p>
              <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Corp 1 / Corp 2 (~48% cut)</p>
                  <p className="text-xl font-bold text-muted-foreground line-through decoration-red-400">${standardPayout.toFixed(2)}</p>
                </div>
                <div className="h-8 w-px bg-border flex-shrink-0" />
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-0.5">You kept extra</p>
                  <p className="text-xl font-bold text-primary">+${wegoAdvantage.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Where Your 12% Goes */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Where Your 12% Goes</p>
              <div className="p-5 space-y-3 border border-border rounded-xl">
                <div className="flex items-start gap-3 pb-3 border-b border-border/50">
                  <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <TrendingUp size={18} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Hardware Reserve Fund</p>
                    <p className="text-xs text-muted-foreground">Autonomous vehicle fleet acquisition</p>
                    <p className="text-lg font-bold text-primary mt-1">${hardwareReserve.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 pb-3 border-b border-border/50">
                  <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <Cpu size={18} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Platform Ops & Engineering</p>
                    <p className="text-xs text-muted-foreground">App development and infrastructure</p>
                    <p className="text-lg font-bold text-primary mt-1">${platformOps.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <Shield size={18} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Group Insurance Subsidies</p>
                    <p className="text-xs text-muted-foreground">Member health & liability coverage</p>
                    <p className="text-lg font-bold text-primary mt-1">${insurance.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              <div className="bg-card/30 p-3 rounded-lg border border-border/50 flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Total WeGo fee this week:</p>
                <p className="text-sm font-bold text-foreground">${week.coop.toFixed(2)}</p>
              </div>
            </div>
          </>
        )}

        {/* ── NO WEEK RIDES — show empty + all-time if available ── */}
        {noWeek && (
          <div className="p-6 border border-border rounded-xl text-center space-y-2">
            <p className="text-lg font-semibold text-foreground">No rides this week yet</p>
            <p className="text-sm text-muted-foreground">Go online to start earning — your weekly totals appear here in real time.</p>
            {hasAllTime && (
              <button
                type="button"
                onClick={() => navigate("/history")}
                className="mt-2 flex items-center gap-1.5 mx-auto px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl text-sm font-semibold text-primary active:scale-95 transition-transform"
              >
                <History size={13} />
                View all past trips
              </button>
            )}
          </div>
        )}

        {/* ── ALL-TIME summary (shown when no week rides but has history) ── */}
        {noWeek && hasAllTime && (
          <div className="p-5 border border-primary/20 rounded-xl space-y-3 bg-primary/5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">All-Time Earnings</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Rides</p>
                <p className="text-2xl font-bold text-foreground">{all.count}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
                <p className="text-xl font-bold text-primary">${all.take.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">WeGo Fee Paid</p>
                <p className="text-lg font-bold text-muted-foreground">-${all.coop.toFixed(2)}</p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-4 mt-2">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Corp 1 / Corp 2 would have paid</p>
                <p className="text-xl font-bold text-muted-foreground line-through decoration-red-400">${(all.gross * 0.52).toFixed(2)}</p>
              </div>
              <div className="h-8 w-px bg-border flex-shrink-0" />
              <div className="text-right">
                <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-0.5">Extra kept with WeGo</p>
                <p className="text-xl font-bold text-primary">+${(all.take - all.gross * 0.52).toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Transparency note — always shown */}
        <div className="p-4 border border-border rounded-xl">
          <div className="flex items-start gap-2">
            <Zap size={16} className="text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Complete Transparency</p>
              <p className="text-xs text-muted-foreground">
                Every dollar is tracked and allocated according to member-voted policies. No algorithmic skimming, no hidden fees.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
