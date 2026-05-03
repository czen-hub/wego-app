import { TrendingUp, Zap, Cpu, Shield } from "lucide-react";

export default function Earnings() {
  const grossEarnings = 3024;
  const coopFee = 362.88;
  const yourTake = 2661.12;
  const totalRides = 67;

  const standardAppCutoff = 0.48;
  const standardPayout = grossEarnings * (1 - standardAppCutoff);
  const wegoAdvantage = yourTake - standardPayout;

  const hardwareReserve = coopFee * 0.5;
  const platformOps = coopFee * 0.30;
  const insurance = coopFee * 0.20;

  return (
    <div className="bg-background pt-4 px-4 pb-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="space-y-1 mb-2">
          <h1 className="text-3xl font-bold text-foreground">Transparency Ledger</h1>
          <p className="text-muted-foreground">Your earnings with full breakdown</p>
        </div>

        {/* Your Take - HERO Section */}
        <div className="glass-card p-6 border border-primary/20 rounded-xl space-y-3 bg-primary/5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            This Week (Guaranteed)
          </p>
          <div className="space-y-1">
            <p className="text-6xl font-bold text-primary leading-tight">
              ${yourTake.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">Your net take-home earnings</p>
          </div>

          {/* Supporting Metrics */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/30">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Rides</p>
              <p className="text-2xl font-bold text-foreground">{totalRides}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gross Earnings</p>
              <p className="text-2xl font-bold text-foreground">${grossEarnings.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">WeGo Fee (12%)</p>
              <p className="text-lg font-bold text-destructive">-${coopFee.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* The WeGo Advantage */}
        <div className="glass-card p-5 border border-primary/20 rounded-xl space-y-4 bg-primary/5">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">The WeGo Advantage — This Week</p>

          {/* Comparison + advantage in one row */}
          <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Uber / Lyft (~48% cut)</p>
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Where Your 12% Goes
          </p>
          <div className="glass-card p-5 space-y-3 border border-border rounded-xl">
            {/* Hardware Reserve Fund */}
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

            {/* Platform Operations */}
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

            {/* Group Insurance */}
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

          {/* Total verification */}
          <div className="bg-card/30 p-3 rounded-lg border border-border/50 flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Total (12% of $3,024):</p>
            <p className="text-sm font-bold text-foreground">${coopFee.toFixed(2)}</p>
          </div>
        </div>

        {/* Transparency Note */}
        <div className="glass-card p-4 border border-border rounded-xl">
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
