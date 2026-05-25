import { useState, useEffect, useRef } from "react";
import { Wallet, TrendingUp, CheckCircle, Shield, Info } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { listenToFleetReserve, listenToCompletedRides } from "@/lib/db";

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
  const { user, profile } = useAuth();
  const [currentReserve, setCurrentReserve] = useState(0);
  const [driverFleetShare, setDriverFleetShare] = useState(0);
  const YEARS_OF_SERVICE = yearsFromDate(profile?.memberSince ?? null);
  const targetReserve = 5000000;

  // months of $75 dues paid → $25/mo goes to retirement reserve
  const monthsOfService = profile?.memberSince
    ? Math.floor((Date.now() - profile.memberSince.getTime()) / (30.44 * 24 * 60 * 60 * 1000))
    : 0;
  const retirementReserveContrib = monthsOfService * 25;

  useEffect(() => {
    return listenToFleetReserve(setCurrentReserve);
  }, []);

  useEffect(() => {
    if (!user) return;
    return listenToCompletedRides(user.uid, (rides) => {
      const total = rides.reduce((sum, r) => sum + r.coopFee * 0.5, 0);
      setDriverFleetShare(Math.round(total * 100) / 100);
    });
  }, [user]);
  const reservePercentage = (currentReserve / targetReserve) * 100;
  const currentVesting = getCurrentVesting(YEARS_OF_SERVICE);

  const serviceBarRef = useRef<HTMLDivElement>(null);
  const reserveBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (serviceBarRef.current)
      serviceBarRef.current.style.width = `${Math.min(100, (YEARS_OF_SERVICE / TARGET_YEARS) * 100)}%`;
  }, [YEARS_OF_SERVICE]);

  useEffect(() => {
    if (reserveBarRef.current)
      reserveBarRef.current.style.width = `${Math.min(100, reservePercentage)}%`;
  }, [reservePercentage]);

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
          <Info size={15} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            All retirement projections below are <span className="text-foreground font-semibold">estimated ranges</span> based on cooperative growth. Actual payouts depend on reserve performance and active membership. No fixed pension is guaranteed at this stage — what is guaranteed is that your reserve allocation is yours and grows with the platform.
          </p>
        </div>

        {/* Your Status */}
        <div className="p-4 space-y-4 border border-border rounded-xl bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Status</p>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-foreground">Years of Service</p>
              <p className="text-sm font-bold text-primary">{YEARS_OF_SERVICE} / {TARGET_YEARS}</p>
            </div>
            <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
              <div ref={serviceBarRef} className="h-full bg-primary transition-all duration-300 rounded-full" />
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

          <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-1">
            <p className="text-xs text-muted-foreground">Monthly Active Driver Plan</p>
            <div className="flex justify-between items-center">
              <p className="text-sm font-semibold text-foreground">$75/month</p>
              <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">Active</span>
            </div>
          </div>
        </div>

        {/* Vesting Schedule */}
        <div className="p-4 border border-border rounded-xl bg-card space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Projected Retirement Income by Service Tier
          </p>
          <div className="space-y-1.5">
            {VESTING_TIERS.map((tier) => {
              const isActive = currentVesting?.pct === tier.pct;
              const isPast   = currentVesting && tier.pct < currentVesting.pct;
              return (
                <div
                  key={tier.pct}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    isActive ? "bg-primary/10 border-primary/25" : "border-border/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <CheckCircle size={14} className="text-primary flex-shrink-0" />
                      ) : (
                        <div className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 ${isPast ? "bg-border border-border" : "border-border/50"}`} />
                      )}
                      <span className={`text-xs font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {tier.label}                      </span>
                    </div>
                    <span className={`text-xs font-bold ${isActive ? "text-primary" : isPast ? "text-muted-foreground" : "text-muted-foreground"}`}>
                      {tier.pct}% · ${tier.low.toLocaleString()}–${tier.high.toLocaleString()}/mo
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 pl-5">{tier.note}</p>
                </div>
              );
            })}
          </div>

          {currentVesting && (
            <div className="p-3 rounded-lg border border-border bg-muted/10">
              <p className="text-xs text-muted-foreground">Estimated supplemental income at current vesting</p>
              <p className="text-lg font-bold text-primary">
                ${currentVesting.low.toLocaleString()}–${currentVesting.high.toLocaleString()}/month
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Grows as the cooperative grows — your reserve stays yours</p>
            </div>
          )}
        </div>

        {/* Projection Card */}
        <div className="p-5 border border-border rounded-xl bg-card space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              20-Year Target
            </p>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/25 rounded-full whitespace-nowrap flex-shrink-0">
              <TrendingUp size={12} className="text-primary" />
              <span className="text-xs font-semibold text-primary">Projected</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-primary">$1,500–$2,500 <span className="text-lg text-muted-foreground">/month</span></p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Estimated supplemental monthly income for 20-year members when the cooperative reaches national scale (~500K drivers). The higher end assumes strong reserve performance and full vesting.
          </p>

          <div className="border-t border-border/30 pt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Year 20 Milestone Targets</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Equity Lump Sum (target)</span>
                <span className="text-sm font-bold text-foreground">$15,000–$20,000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Platform Fee After Year 20</span>
                <span className="text-sm font-bold text-foreground">0% (proposed)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Member Benefit Transfer</span>
                <span className="text-sm font-bold text-foreground">Under design</span>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Dues Breakdown */}
        <div className="p-4 border border-border rounded-xl bg-card space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Where Your $75/Month Goes
          </p>
          <div className="space-y-2">
            {[
              { label: "Retirement Reserve",  amount: "$25" },
              { label: "Insurance Fund",       amount: "$20" },
              { label: "App Infrastructure",   amount: "$15" },
              { label: "Operations Reserve",   amount: "$10" },
              { label: "Member Surplus Pool",  amount: "$5"  },
            ].map(({ label, amount }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-primary" />
                <span className="text-xs text-muted-foreground flex-1">{label}</span>
                <span className="text-xs font-bold text-foreground">{amount}/mo</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">
            Insurance actual cost ~$100/driver — the remaining ~$80 is funded from WeGo's 12% platform fee revenue.
          </p>
        </div>

        {/* Insurance Coverage */}
        <div className="p-4 border border-border rounded-xl bg-card space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Your Insurance Coverage
            </p>
          </div>
          <div className="space-y-2">
            {[
              { period: "Period 1", desc: "App on, waiting for a ride",      note: "Basic liability — Corp often skips this" },
              { period: "Period 2", desc: "Ride accepted, heading to pickup", note: "$1M liability" },
              { period: "Period 3", desc: "Passenger in vehicle",             note: "$1M liability" },
            ].map(({ period, desc, note }) => (
              <div key={period} className="flex items-start gap-3 p-2.5 bg-muted/10 rounded-lg border border-border/50">
                <CheckCircle size={14} className="text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground">{period}</span>
                    <span className="text-xs text-muted-foreground">{desc}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{note}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Collision/comprehensive requires a personal rideshare endorsement (~$10–20/mo).
          </p>
        </div>

        {/* Fleet Reserve Fund */}
        <div className="p-5 border border-border rounded-xl bg-card space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Fleet Reserve Fund
            </p>
          </div>

          <div>
            <p className="text-lg font-bold text-foreground">${(currentReserve / 1000000).toFixed(2)}M</p>
            <p className="text-xs text-muted-foreground">Current pooled capital</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Target for Phase 2 Fleet</p>
              <p className="text-sm font-semibold text-foreground">${(targetReserve / 1000000).toFixed(1)}M</p>
            </div>
            <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
              <div ref={reserveBarRef} className="h-full bg-primary transition-all duration-500 rounded-full" />
            </div>
            <p className="text-xs text-muted-foreground text-right">{reservePercentage.toFixed(1)}% funded</p>
          </div>

          <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Fleet Roadmap</p>
            <div className="space-y-1.5">
              {[
                { phase: "Phase 1 (Now)",       desc: "Driver-owned rideshare cooperative",          active: true },
                { phase: "Phase 2 (2027–2028)", desc: "Reserve growth + EV/commercial partnerships", active: false },
                { phase: "Phase 3 (2029+)",     desc: "Fleet operations, charging, AV dispatch",     active: false },
              ].map(({ phase, desc, active }) => (
                <div key={phase} className="flex items-start gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${active ? "bg-primary" : "bg-border"}`} />
                  <div>
                    <p className={`text-xs font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>{phase}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Impact Summary */}
        <div className="p-4 border border-border rounded-xl bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Your Impact</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/10 p-3 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Reserve Fund</p>
              <p className="text-lg font-bold text-foreground">${retirementReserveContrib.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">$25/mo × {monthsOfService}mo</p>
            </div>
            <div className="bg-muted/10 p-3 rounded-lg border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Fleet Share</p>
              <p className="text-lg font-bold text-foreground">${driverFleetShare.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">From your ride fees</p>
            </div>
          </div>
        </div>

        {/* Loyalty Ladder */}
        <div className="p-4 border border-border rounded-xl bg-card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Loyalty Ladder — Annual Renewal
            </p>
            <Wallet size={14} className="text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">Your annual renewal fee drops every year — reward for staying in the cooperative.</p>
          <div className="space-y-1.5">
            {[
              { year: "Year 1",  fee: "$500",    current: YEARS_OF_SERVICE === 0 },
              { year: "Year 2",  fee: "$400",    current: YEARS_OF_SERVICE === 1 },
              { year: "Year 3",  fee: "$300",    current: YEARS_OF_SERVICE === 2 },
              { year: "Year 4",  fee: "$200",    current: YEARS_OF_SERVICE === 3 },
              { year: "Year 5",  fee: "$100",    current: YEARS_OF_SERVICE === 4 },
              { year: "Year 6",  fee: "$50",     current: YEARS_OF_SERVICE === 5 },
              { year: "Year 7+", fee: "$25/yr",  current: YEARS_OF_SERVICE >= 6 },
            ].map(({ year, fee, current }) => (
              <div
                key={year}
                className={`flex justify-between items-center px-3 py-1.5 rounded-lg ${current ? "bg-primary/10 border border-primary/25" : ""}`}
              >
                <span className={`text-xs ${current ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                  {year}                </span>
                <span className={`text-xs font-bold ${current ? "text-primary" : "text-muted-foreground"}`}>{fee}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">Total over 20 years: $1,575 in annual renewals.</p>
        </div>

      </div>
    </div>
  );
}
