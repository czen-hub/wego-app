import { Wallet, TrendingUp, CheckCircle, Shield } from "lucide-react";

const YEARS_OF_SERVICE: number = 3;
const TARGET_YEARS = 20;

const VESTING_TIERS = [
  { label: "3–5 yrs", pct: 25, amount: 625 },
  { label: "5–10 yrs", pct: 50, amount: 1250 },
  { label: "10–15 yrs", pct: 75, amount: 1875 },
  { label: "15–19 yrs", pct: 90, amount: 2250 },
  { label: "20 yrs", pct: 100, amount: 2500 },
];

function getCurrentVesting(years: number) {
  if (years >= 20) return VESTING_TIERS[4];
  if (years >= 15) return VESTING_TIERS[3];
  if (years >= 10) return VESTING_TIERS[2];
  if (years >= 5) return VESTING_TIERS[1];
  if (years >= 3) return VESTING_TIERS[0];
  return null;
}

export default function Legacy() {
  const currentReserve = 2847500;
  const targetReserve = 5000000;
  const reservePercentage = (currentReserve / targetReserve) * 100;
  const currentVesting = getCurrentVesting(YEARS_OF_SERVICE);

  return (
    <div className="bg-background pt-4 px-4 pb-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="space-y-1 mb-4">
          <h1 className="text-3xl font-bold text-foreground">Legacy</h1>
          <p className="text-muted-foreground">Your path to a 20-year pension</p>
        </div>

        {/* Your Status */}
        <div className="glass-card p-4 space-y-4 border border-border rounded-xl">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Your Status
          </p>

          {/* Years of Service */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-foreground">Years of Service</p>
              <p className="text-sm font-bold text-primary">{YEARS_OF_SERVICE} / {TARGET_YEARS}</p>
            </div>
            <div className="w-full h-5 bg-card/50 rounded-full overflow-hidden border border-border/50">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${(YEARS_OF_SERVICE / TARGET_YEARS) * 100}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">{TARGET_YEARS - YEARS_OF_SERVICE} years to full pension</p>
              {currentVesting && (
                <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                  {currentVesting.pct}% Vested
                </span>
              )}
            </div>
          </div>

          {/* Membership Status */}
          <div className="bg-card/50 p-3 rounded-lg border border-border/50 space-y-1">
            <p className="text-xs text-muted-foreground">Monthly Dues & Insurance</p>
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold text-foreground">$75/month</p>
              <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">Active</span>
            </div>
          </div>
        </div>

        {/* Vesting Schedule */}
        <div className="glass-card p-4 border border-border rounded-xl space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Vesting Schedule
          </p>
          <div className="space-y-2">
            {VESTING_TIERS.map((tier) => {
              const isActive = currentVesting?.pct === tier.pct;
              const isPast = currentVesting && tier.pct < currentVesting.pct;
              return (
                <div
                  key={tier.pct}
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                    isActive
                      ? "bg-primary/10 border-primary/30"
                      : isPast
                      ? "bg-primary/5 border-primary/10"
                      : "bg-card/30 border-border/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <CheckCircle size={14} className="text-primary flex-shrink-0" />
                    ) : (
                      <div className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 ${isPast ? "bg-primary/40 border-primary/40" : "border-border"}`} />
                    )}
                    <span className={`text-xs font-medium ${isActive ? "text-primary" : isPast ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                      {tier.label}
                    </span>
                    {isActive && (
                      <span className="text-xs text-primary/60">← You are here</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold ${isActive ? "text-primary" : isPast ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                      {tier.pct}% · ${tier.amount.toLocaleString()}/mo
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {currentVesting && (
            <div className="bg-card/30 p-3 rounded-lg border border-border/30">
              <p className="text-xs text-muted-foreground">If you left today you'd receive</p>
              <p className="text-lg font-bold text-primary">${currentVesting.amount.toLocaleString()}/month for life</p>
            </div>
          )}
        </div>

        {/* Pension Projection Card */}
        <div className="glass-card p-5 border border-primary/20 rounded-xl space-y-3 bg-primary/5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Pension Projection at Year 20
              </p>
              <p className="text-3xl font-bold text-primary">$2,500 <span className="text-lg text-muted-foreground">/month</span></p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/20 border border-primary/40 rounded-full">
              <CheckCircle size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary">On Track</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Estimated lifetime distribution starting at Year 20 of service.
          </p>

          {/* Year 20 Milestone Extras */}
          <div className="border-t border-border/30 pt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Year 20 Milestone Extras</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Equity Lump Sum Payout</span>
                <span className="text-sm font-bold text-primary">$20,000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Platform Fee After Year 20</span>
                <span className="text-sm font-bold text-primary">0% Forever</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Family Transfer (Year 25+)</span>
                <span className="text-sm font-bold text-primary">Eligible</span>
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
              { label: "Retirement Trust", amount: "$25", color: "text-primary", bar: "bg-primary" },
              { label: "Insurance Fund", amount: "$20", color: "text-primary", bar: "bg-primary" },
              { label: "App Infrastructure", amount: "$15", color: "text-primary", bar: "bg-primary" },
              { label: "Operations Reserve", amount: "$10", color: "text-muted-foreground", bar: "bg-muted-foreground" },
              { label: "Profit Dividend Pool", amount: "$5", color: "text-primary", bar: "bg-primary" },
            ].map(({ label, amount, color, bar }) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${bar}`} />
                <span className="text-xs text-muted-foreground flex-1">{label}</span>
                <span className={`text-xs font-bold ${color}`}>{amount}/mo</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">
            Insurance actual cost ~$100/driver — the remaining ~$80 is funded from WeGo's 12% tech fee revenue.
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
              { period: "Period 1", desc: "App on, waiting for a ride", note: "Uber doesn't cover this" },
              { period: "Period 2", desc: "Ride accepted, heading to pickup", note: "$1M liability" },
              { period: "Period 3", desc: "Passenger in vehicle", note: "$1M liability" },
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
              Hardware Reserve Fund
            </p>
          </div>

          <div>
            <p className="text-lg font-bold text-primary">${(currentReserve / 1000000).toFixed(2)}M</p>
            <p className="text-xs text-muted-foreground">Current pooled capital</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Target for First AV Purchase</p>
              <p className="text-sm font-semibold text-primary">${(targetReserve / 1000000).toFixed(1)}M</p>
            </div>
            <div className="w-full h-5 bg-card/50 rounded-full overflow-hidden border border-border/50">
              <div
                className="h-full bg-primary transition-all duration-500 rounded-full"
                style={{ width: `${reservePercentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">{reservePercentage.toFixed(1)}% funded</p>
          </div>

          <div className="bg-card/50 p-3 rounded-lg border border-border/50">
            <p className="text-xs text-muted-foreground mb-2">Next Milestone</p>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">2 AVs Scheduled for Purchase</p>
              <p className="text-xs text-primary">Target: Q2 2026 ($2.1M allocation)</p>
            </div>
          </div>
        </div>

        {/* Impact Summary */}
        <div className="glass-card p-4 border border-border rounded-xl">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Your Impact
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card/50 p-3 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Contributed to Reserve</p>
              <p className="text-lg font-bold text-primary">$2,250</p>
            </div>
            <div className="bg-card/50 p-3 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Shared AV Returns</p>
              <p className="text-lg font-bold text-primary">$412</p>
            </div>
          </div>
        </div>

        {/* Loyalty Ladder */}
        <div className="glass-card p-4 border border-border rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Loyalty Ladder — Annual Fee
            </p>
            <Wallet size={14} className="text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Your annual registration fee drops every year as a reward for tenure.</p>
          <div className="space-y-1.5">
            {[
              { year: "Year 1", fee: "$500", current: YEARS_OF_SERVICE === 1 },
              { year: "Year 2", fee: "$400", current: YEARS_OF_SERVICE === 2 },
              { year: "Year 3", fee: "$300", current: YEARS_OF_SERVICE === 3 },
              { year: "Year 4", fee: "$200", current: YEARS_OF_SERVICE === 4 },
              { year: "Year 5", fee: "$100", current: YEARS_OF_SERVICE === 5 },
              { year: "Year 6", fee: "$50", current: YEARS_OF_SERVICE === 6 },
              { year: "Year 7+", fee: "$25/yr", current: YEARS_OF_SERVICE >= 7 },
            ].map(({ year, fee, current }) => (
              <div
                key={year}
                className={`flex justify-between items-center px-3 py-1.5 rounded-lg ${
                  current ? "bg-primary/15 border border-primary/30" : "bg-card/20"
                }`}
              >
                <span className={`text-xs ${current ? "text-foreground font-semibold" : "text-muted-foreground/60"}`}>
                  {year} {current && "← You are here"}
                </span>
                <span className={`text-xs font-bold ${current ? "text-primary" : "text-muted-foreground/50"}`}>{fee}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">Total over 20 years: $1,575 in annual fees.</p>
        </div>
      </div>
    </div>
  );
}
