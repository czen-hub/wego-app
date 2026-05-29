import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Zap, Cpu, Shield, Banknote, ArrowDownToLine, ChevronRight, X, CheckCircle, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { listenToCompletedRides, getBankAccount, requestWithdrawal, type Ride, type BankAccount } from "@/lib/db";

function calcStats(rs: Ride[]) {
  const gross = rs.reduce((s, r) => s + r.fare, 0);
  const coop  = rs.reduce((s, r) => s + r.coopFee, 0);
  const take  = rs.reduce((s, r) => s + r.driverTake, 0);
  return { gross, coop, take, count: rs.length };
}

export default function Earnings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [bankLoaded, setBankLoaded] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);
  const [withdrawError, setWithdrawError] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = listenToCompletedRides(user.uid, (r) => {
      setRides(r);
      setLoaded(true);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getBankAccount(user.uid).then((acct) => {
      setBankAccount(acct);
      setBankLoaded(true);
    });
  }, [user]);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);
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

  // Build last-7-days chart data
  const chartData = useMemo(() => {
    const days: { label: string; take: number; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayRides = rides.filter(r => r.completedAt && r.completedAt >= d && r.completedAt < next);
      const take = dayRides.reduce((s, r) => s + r.driverTake, 0);
      days.push({
        label: i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }),
        take: parseFloat(take.toFixed(2)),
        isToday: i === 0,
      });
    }
    return days;
  }, [rides]);

  return (
    <div className="bg-background pt-4 px-4 pb-6">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="space-y-1 mb-2">
          <h1 className="text-3xl font-bold text-foreground">Transparency Ledger</h1>
          <p className="text-muted-foreground text-sm">Your earnings with full breakdown</p>
        </div>

        {/* Payout card */}
        {bankLoaded && (
          bankAccount ? (
            <div className="p-4 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote size={16} className="text-primary" />
                  <p className="text-sm font-semibold text-foreground">Weekly Payout</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/settings", { state: { openModal: "payout" } })}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {bankAccount.bankName} ****{bankAccount.accountNumberLast4}
                  <ChevronRight size={12} />
                </button>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">This week's net earnings</p>
                  <p className="text-2xl font-bold text-primary">${loaded ? week.take.toFixed(2) : "—"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setWithdrawDone(false); setWithdrawModalOpen(true); }}
                  disabled={!loaded || week.take <= 0}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl active:scale-95 transition-transform disabled:opacity-40 flex-shrink-0 btn-glow"
                >
                  <ArrowDownToLine size={15} />
                  Request Payout
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">Payouts process every Monday. Requesting early will be reviewed within 1–2 business days.</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/settings", { state: { openModal: "payout" } })}
              className="w-full p-4 border border-dashed border-primary/40 rounded-xl bg-primary/5 flex items-center gap-3 active:scale-[0.99] transition-transform"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <Banknote size={18} className="text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold text-foreground">Add Bank Account</p>
                <p className="text-xs text-muted-foreground mt-0.5">Link your bank to receive weekly payouts</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
            </button>
          )
        )}

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
            <div className="p-4 border border-primary/20 rounded-xl space-y-3 bg-primary/5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">This Week · Live</p>
              <div>
                <p className="text-3xl font-bold text-primary leading-tight">${week.take.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Net take-home earnings</p>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/30">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Rides</p>
                  <p className="text-lg font-bold text-foreground">{week.count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Gross</p>
                  <p className="text-lg font-bold text-foreground">${week.gross.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">WeGo Fee</p>
                  <p className="text-lg font-bold text-destructive">-${week.coop.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => navigate("/history")}
                  className="text-[11px] font-semibold text-primary active:opacity-70"
                >
                  View full history →
                </button>
              </div>
            </div>

            {/* Weekly earnings bar chart */}
            <div className="p-4 border border-border rounded-xl space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Daily Earnings — Last 7 Days</p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide domain={[0, "auto"]} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.75rem",
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Take-home"]}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <Bar dataKey="take" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.isToday ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.35)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-muted-foreground text-center">Today's bar is highlighted</p>
            </div>

            {/* WeGo Advantage */}
            <div className="p-4 border border-border rounded-xl">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">WeGo vs Corp This Week</p>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Corp (~48% cut)</p>
                  <p className="text-base font-semibold text-muted-foreground line-through decoration-red-400">${standardPayout.toFixed(2)}</p>
                </div>
                <div className="h-6 w-px bg-border flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">WeGo (88%)</p>
                  <p className="text-base font-semibold text-foreground">${week.take.toFixed(2)}</p>
                </div>
                <div className="h-6 w-px bg-border flex-shrink-0" />
                <div className="text-right">
                  <p className="text-[10px] text-primary mb-0.5">You kept extra</p>
                  <p className="text-base font-bold text-primary">+${wegoAdvantage.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Where Your 12% Goes */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Where Your 12% Goes</p>
              <div className="border border-border rounded-xl divide-y divide-border/50">
                {[
                  { icon: <TrendingUp size={14} className="text-primary" />, label: "Hardware Reserve Fund", sub: "AV fleet acquisition", val: hardwareReserve },
                  { icon: <Cpu size={14} className="text-primary" />,        label: "Platform Ops",           sub: "App & infrastructure",  val: platformOps },
                  { icon: <Shield size={14} className="text-primary" />,     label: "Group Insurance",        sub: "Member coverage",        val: insurance },
                ].map(({ icon, label, sub, val }) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-shrink-0">{icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{sub}</p>
                    </div>
                    <p className="text-xs font-semibold text-primary flex-shrink-0">${val.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center px-1">
                <p className="text-xs text-muted-foreground">Total WeGo fee this week</p>
                <p className="text-xs font-semibold text-foreground">${week.coop.toFixed(2)}</p>
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
                <Clock size={13} />
                View all past trips
              </button>
            )}
          </div>
        )}

        {/* ── ALL-TIME summary (shown when no week rides but has history) ── */}
        {noWeek && hasAllTime && (
          <div className="p-4 border border-primary/20 rounded-xl space-y-3 bg-primary/5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">All-Time Earnings</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Rides</p>
                <p className="text-lg font-bold text-foreground">{all.count}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Total Earned</p>
                <p className="text-lg font-bold text-primary">${all.take.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">WeGo Fee</p>
                <p className="text-base font-semibold text-muted-foreground">-${all.coop.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/30">
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Corp would have paid</p>
                <p className="text-base font-semibold text-muted-foreground line-through decoration-red-400">${(all.gross * 0.52).toFixed(2)}</p>
              </div>
              <div className="h-6 w-px bg-border flex-shrink-0" />
              <div className="text-right">
                <p className="text-[10px] text-primary mb-0.5">Extra kept with WeGo</p>
                <p className="text-base font-bold text-primary">+${(all.take - all.gross * 0.52).toFixed(2)}</p>
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

      {/* Withdrawal confirm modal */}
      {withdrawModalOpen && bankAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-5">
            {withdrawDone ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <CheckCircle size={32} className="text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Payout Requested</h2>
                <p className="text-sm text-muted-foreground">Your request for <span className="text-primary font-semibold">${week.take.toFixed(2)}</span> has been submitted. Funds will arrive in <span className="font-medium text-foreground">{bankAccount.bankName} ****{bankAccount.accountNumberLast4}</span> within 1–2 business days.</p>
                <button type="button" onClick={() => setWithdrawModalOpen(false)}
                  className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-transform btn-glow mt-1">
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-foreground">Request Payout</h2>
                  <button type="button" aria-label="Close" onClick={() => setWithdrawModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                    <X size={15} className="text-muted-foreground" />
                  </button>
                </div>
                <div className="bg-background border border-border rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-bold text-primary">${week.take.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">To account</span>
                    <span className="font-medium text-foreground">{bankAccount.bankName} ****{bankAccount.accountNumberLast4}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Account type</span>
                    <span className="font-medium text-foreground">{bankAccount.accountType === "checking" ? "Checking" : "Savings"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Processing time</span>
                    <span className="font-medium text-foreground">1–2 business days</span>
                  </div>
                </div>
                {withdrawError && (
                  <p className="text-xs text-destructive text-center">Request failed. Please try again.</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setWithdrawModalOpen(false)}
                    className="py-3 rounded-xl bg-muted/30 border border-border text-foreground font-semibold text-sm active:scale-95 transition-transform">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={withdrawing}
                    onClick={async () => {
                      if (!user) return;
                      setWithdrawing(true);
                      setWithdrawError(false);
                      try {
                        await requestWithdrawal(user.uid, week.take);
                        setWithdrawDone(true);
                      } catch {
                        setWithdrawError(true);
                      } finally {
                        setWithdrawing(false);
                      }
                    }}
                    className="py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-transform btn-glow disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {withdrawing
                      ? <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Processing…</>
                      : "Confirm"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
