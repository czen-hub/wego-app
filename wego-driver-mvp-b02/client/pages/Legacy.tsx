import { Wallet, TrendingUp, CheckCircle, Shield, Info } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const TARGET_YEARS = 20;

function yearsFromDate(since: Date | null): number {
  if (!since) return 0;
  return Math.max(0, Math.floor((Date.now() - since.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
}

const VESTING_TIERS = [
  { label: "3–5 yrs",  pct: 25,  low: 200,  high: 400,  note: "Cooperative in early growth" },
  { label: "5–10 yrs", pct: 50,  low: 400,  high: 800,  note: "Expanding member base" },
  { label: "10–15 yrs",pct: 75,  low: 800,  high: 1500, note: "100K+ active drivers" },
  { label: "15–19 yrs",pct: 90,  low: 1300, high: 2000, note: "National scale reached" },
  { label: "20 yrs",   pct: 100, low: 1500, high: 2500, note: "Full reserve maturity target" },
];

function getCurrentVesting(years: number) {
  if (years >= 20) return VESTING_TIERS[4];
  if (years >= 15) return VESTING_TIERS[3];
  if (years >= 10) return VESTING_TIERS[2];
  if (years >= 5)  return VESTING_TIERS[1];
  if (years >= 3)  return VESTING_TIERS[0];
  return null;
}

export default function Legacy() {
  const { profile } = useAuth();
  const YEARS_OF_SERVICE = yearsFromDate(profile?.memberSince ?? null);
  const currentReserve = 2847500;
  const targetReserve  = 5000000;
  const reservePercentage = (currentReserve / targetReserve) * 100;
  const currentVesting = getCurrentVesting(YEARS_OF_SERVICE);

  return (
    <div className="bg-background pt-4 px-4 pb-6">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="space-y-1 mb-4">
          <h1 className="text-3xl font-bold text-foreground">Legacy</h1>
          <p className="text-muted-foreground">Your path to long-term retirement security</p>
        </div>

        {/* Transparency note */}
        <div className="flex items-start gap-2.5 bg-card border border-border rounded-xl px-4 py-3">
          <Info size={15} className="text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            All retirement projections below are <span className="text-foreground font-semibold">estimated ranges</span> based on cooperative growth. Actual payouts depend on reserve performance and active membership. No fixed pension is guaranteed at this stage — what is guaranteed is that your reserve allocation is yours and grows with the platform.
          </p>
        </div>

        {/* Your Status */}
        <div className="glass-card p-4 space-y-4 border border-border rounded-xl">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Status</p>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-foreground">Years of Service</p>
              <p className="text-sm font-bold text-primary">{YEARS_OF_SERVICE} / {TARGET_YEARS}</p>
            </div>
            <div className="w-full h-5 bg-card/50 rounded-full overflow-hidden border border-border/50">
              <div className="h-full bg-primary transition-all duration-300 rounded-full w-[15%]" />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">{TARGET_YEARS - YEARS_OF_SERVICE} years to full benefit</p>
              {currentVesting && (
                <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                  {currentVesting.pct}% Vested
                </span>
              )}
            </div>
          </div>

          <div className="bg-card/50 p-3 rounded-lg border border-border/50 space-y-1">
            <p className="text-xs text-muted-foreground">Monthly Active Driver Plan</p>
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold text-foreground">$75/month</p>
              <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">Active</span>
            </div>
          </div>
        </div>

        {/* Vesting Schedule */}
        <div className="glass-card p-4 border border-border rounded-xl space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Projected Retirement Income by Service Tier
          </p>
          <div className="space-y-2">
            {VESTING_TIERS.map((tier) => {
              const isActive = currentVesting?.pct === tier.pct;
              const isPast   = currentVesting && tier.pct < currentVesting.pct;
              return (
                <div
                  key={tier.pct}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    isActive ? "bg-primary/10 border-primary/30" : isPast ? "bg-primary/5 border-primary/10" : "bg-card/30 border-border/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <CheckCircle size={14} className="text-primary flex-shrink-0" />
                      ) : (
                        <div className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 ${isPast ? "bg-primary/40 border-primary/40" : "border-border"}`} />
                      )}
                      <span className={`text-xs font-medium ${isActive ? "text-primary" : isPast ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                        {tier.label} {isActive && <span className="text-primary/60">← You are here</span>}
                      </span>
                    </div>
                    <span className={`text-xs font-bold ${isActive ? "text-primary" : isPast ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                      {tier.pct}% · ${tier.low.toLocaleString()}–${tier.high.toLocaleString()}/mo
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 mt-1 pl-5">{tier.note}</p>
                </div>
              );
            })}
          </div>

          {currentVesting && (
            <div className="bg-card/30 p-3 rounded-lg border border-border/30">
              <p className="text-xs text-muted-foreground">Estimated supplemental income at current vesting</p>
              <p className="text-lg font-bold text-primary">
                ${currentVesting.low.toLocaleString()}–${currentVesting.high.toLocaleString()}/month
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Grows as the cooperative grows — your reserve stays yours</p>
            </div>
          )}
        </div>

        {/* Projection Card — honest range */}
        <div className="glass-card p-5 border border-primary/20 rounded-xl space-y-3 bg-primary/5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Target at 20 Years — Full Scale
              </p>
              <p className="text-3xl font-bold text-primary">$1,500–$2,500 <span className="text-lg text-muted-foreground">/month</span></p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/20 border border-primary/40 rounded-full">
              <TrendingUp size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary">Projected</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Estimated supplemental monthly income for 20-year members when the cooperative reaches national scale (~500K drivers). The higher end assumes strong reserve performance and full vesting.
          </p>

          <div className="border-t border-border/30 pt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Year 20 Milestone Targets</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Equity Lump Sum (target)</span>
                <span className="text-sm font-bold text-primary">$15,000–$20,000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Platform Fee After Year 20</span>
                <span className="text-sm font-bold text-primary">0% (proposed)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Member Benefit Transfer</span>
                <span className="text-sm font-bold text-primary">Under design</span>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Dues Breakdown */}
        <div className="glass-card p-4 border border-border rounded-xl space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Where Your $75/Month Goes
          </p>
          <div className="space-y-2">
            {[
              { label: "Retirement Reserve",   amount: "$25", bar: "bg-primary" },
              { label: "Insurance Fund",        amount: "$20", bar: "bg-primary" },
              { label: "App Infrastructure",    amount: "$15", bar: "bg-primary" },
              { label: "Operations Reserve",    amount: "$10", bar: "bg-muted-foreground" },
              { label: "Member Surplus Pool",   amount: "$5",  bar: "bg-primary" },
            ].map(({ label, amount, bar }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${bar}`} />
                <span className="text-xs text-muted-foreground flex-1">{label}</span>
                <span className="text-xs font-bold text-primary">{amount}/mo</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">
            Insurance actual cost ~$100/driver — the remaining ~$80 is funded from WeGo's 12% platform fee revenue.
          </p>
        </div>

        {/* Insurance Coverage */}
        <div className="glass-card p-4 border border-primary/20 rounded-xl space-y-3 bg-primary/5">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Your Insurance Coverage
            </p>
          </div>
          <div className="space-y-2">
            {[
              { period: "Period 1", desc: "App on, waiting for a ride",      note: "Basic liability — Uber often skips this" },
              { period: "Period 2", desc: "Ride accepted, heading to pickup", note: "$1M liability" },
              { period: "Period 3", desc: "Passenger in vehicle",             note: "$1M liability" },
            ].map(({ period, desc, note }) => (
              <div key={period} className="flex items-start gap-3 p-2.5 bg-card/30 rounded-lg border border-border/30">
                <CheckCircle size={14} className="text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground">{period}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </div>
                  <span className="text-xs text-primary/70">{note}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Collision/comprehensive requires a personal rideshare endorsement (~$10–20/mo).
          </p>
        </div>

        {/* Hardware Reserve Fund */}
        <div className="glass-card p-5 border border-border rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Fleet Reserve Fund
            </p>
          </div>

          <div>
            <p className="text-lg font-bold text-primary">${(currentReserve / 1000000).toFixed(2)}M</p>
            <p className="text-xs text-muted-foreground">Current pooled capital</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Target for Phase 2 Fleet</p>
              <p className="text-sm font-semibold text-primary">${(targetReserve / 1000000).toFixed(1)}M</p>
            </div>
            <div className="w-full h-5 bg-card/50 rounded-full overflow-hidden border border-border/50">
              <div className="h-full bg-primary transition-all duration-500 rounded-full w-[57%]" />
            </div>
            <p className="text-xs text-muted-foreground text-right">{reservePercentage.toFixed(1)}% funded</p>
          </div>

          <div className="bg-card/50 p-3 rounded-lg border border-border/50 space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Fleet Roadmap</p>
            <div className="space-y-1.5">
              {[
                { phase: "Phase 1 (Now)",       desc: "Driver-owned rideshare cooperative",         active: true },
                { phase: "Phase 2 (2027–2028)", desc: "Reserve growth + EV/commercial partnerships", active: false },
                { phase: "Phase 3 (2029+)",     desc: "Fleet operations, charging, AV dispatch",     active: false },
              ].map(({ phase, desc, active }) => (
                <div key={phase} className="flex items-start gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${active ? "bg-primary" : "bg-border"}`} />
                  <div>
                    <p className={`text-xs font-semibold ${active ? "text-primary" : "text-muted-foreground/60"}`}>{phase}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Impact Summary */}
        <div className="glass-card p-4 border border-border rounded-xl">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Your Impact</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card/50 p-3 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Contributed to Reserve</p>
              <p className="text-lg font-bold text-primary">$2,250</p>
            </div>
            <div className="bg-card/50 p-3 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Fleet Reserve Share</p>
              <p className="text-lg font-bold text-primary">$412</p>
            </div>
          </div>
        </div>

        {/* Loyalty Ladder */}
        <div className="glass-card p-4 border border-border rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Loyalty Ladder — Annual Renewal
            </p>
            <Wallet size={14} className="text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Your annual renewal fee drops every year — reward for staying in the cooperative.</p>
          <div className="space-y-1.5">
            {[
              { year: "Year 1", fee: "$500", current: YEARS_OF_SERVICE === 1 },
              { year: "Year 2", fee: "$400", current: YEARS_OF_SERVICE === 2 },
              { year: "Year 3", fee: "$300", current: YEARS_OF_SERVICE === 3 },
              { year: "Year 4", fee: "$200", current: YEARS_OF_SERVICE === 4 },
              { year: "Year 5", fee: "$100", current: YEARS_OF_SERVICE === 5 },
              { year: "Year 6", fee: "$50",  current: YEARS_OF_SERVICE === 6 },
              { year: "Year 7+",fee: "$25/yr",current: YEARS_OF_SERVICE >= 7 },
            ].map(({ year, fee, current }) => (
              <div
                key={year}
                className={`flex justify-between items-center px-3 py-1.5 rounded-lg ${current ? "bg-primary/15 border border-primary/30" : "bg-card/20"}`}
              >
                <span className={`text-xs ${current ? "text-foreground font-semibold" : "text-muted-foreground/60"}`}>
                  {year} {current && "← You are here"}
                </span>
                <span className={`text-xs font-bold ${current ? "text-primary" : "text-muted-foreground/50"}`}>{fee}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">Total over 20 years: $1,575 in annual renewals.</p>
        </div>

      </div>
    </div>
  );
}
