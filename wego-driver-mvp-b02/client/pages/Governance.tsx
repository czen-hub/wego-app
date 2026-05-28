import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Award, CheckCircle, XCircle, Shield, Menu, Star, Gem, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { listenToGovernanceVotes, submitGovernanceVote } from "@/lib/db";

type Tier = "silver" | "gold" | "platinum";

function getTier(rides: number): Tier {
  if (rides >= 200) return "platinum";
  if (rides >= 50)  return "gold";
  return "silver";
}

const TIER_CONFIG = {
  silver: {
    label: "Silver Member",
    Icon: Star,
    cardGradient: "from-slate-600 via-slate-700 to-slate-900",
    badgeBg: "bg-white/10 border-white/25",
    badgeText: "text-slate-200",
    iconColor: "text-slate-300",
    progressColor: "bg-slate-400",
    progressTrack: "bg-white/10",
    nextAt: 50,
    nextLabel: "Gold",
  },
  gold: {
    label: "Gold Member",
    Icon: Award,
    cardGradient: "from-amber-700 via-amber-800 to-stone-900",
    badgeBg: "bg-amber-400/20 border-amber-400/40",
    badgeText: "text-amber-300",
    iconColor: "text-amber-300",
    progressColor: "bg-amber-400",
    progressTrack: "bg-white/10",
    nextAt: 200,
    nextLabel: "Platinum",
  },
  platinum: {
    label: "Platinum Member",
    Icon: Gem,
    cardGradient: "from-violet-700 via-purple-800 to-slate-900",
    badgeBg: "bg-violet-400/20 border-violet-400/40",
    badgeText: "text-violet-200",
    iconColor: "text-violet-300",
    progressColor: "bg-violet-400",
    progressTrack: "bg-white/10",
    nextAt: null,
    nextLabel: null,
  },
} as const;

interface Initiative {
  id: string;
  title: string;
  description: string;
  deadline: string;
}

const INITIATIVES: Initiative[] = [
  {
    id: "init-08",
    title: "Initiative #08: Year 6 AV Fleet Sourcing",
    description: "Approve allocation of $450K from hardware reserve to purchase 3 additional autonomous vehicles for Q4 2026 deployment.",
    deadline: "Closes in 5 days",
  },
  {
    id: "init-09",
    title: "Initiative #09: Adjust Target Pension Floor for Inflation",
    description: "Update the minimum pension floor calculation to account for 3.2% annual inflation, ensuring purchasing power for retiring members.",
    deadline: "Closes in 8 days",
  },
];

interface PendingVote {
  id: string;
  choice: "approve" | "reject";
}

export default function Governance() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const rides = profile?.totalRides ?? 0;
  const tier  = getTier(rides);
  const cfg   = TIER_CONFIG[tier];
  const { Icon } = cfg;
  const toNext = cfg.nextAt !== null ? cfg.nextAt - rides : null;
  const pct    = cfg.nextAt !== null
    ? Math.min(100, Math.round((rides / cfg.nextAt) * 100))
    : 100;

  const [savedVotes, setSavedVotes] = useState<Record<string, "approve" | "reject">>({});
  const [pendingVote, setPendingVote] = useState<PendingVote | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    return listenToGovernanceVotes(user.uid, setSavedVotes);
  }, [user]);

  const confirmVote = async () => {
    if (!pendingVote || !user || submitting) return;
    setSubmitting(true);
    try {
      await submitGovernanceVote(user.uid, pendingVote.id, pendingVote.choice);
    } catch {
      // vote will sync from Firestore listener anyway
    } finally {
      setSubmitting(false);
      setPendingVote(null);
    }
  };

  return (
    <div className="bg-background pt-4 px-4 pb-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">Governance</h1>
            <p className="text-muted-foreground">Your voice in the cooperative</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/settings")}
            aria-label="Account Settings"
            className="mt-1 p-2.5 rounded-xl bg-card border border-border text-foreground active:scale-95 transition-transform"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Digital ID Card */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Digital Member ID
          </p>
          <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${cfg.cardGradient} border border-white/10 p-5 space-y-4`}>
            <div className="card-shine absolute inset-0 opacity-10" />

            <div className="relative z-10 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/25 border border-white/50 rounded-full">
                  <Shield size={13} className="text-white" />
                  <span className="text-xs font-bold text-white">Verified</span>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${cfg.badgeBg}`}>
                  <Icon size={13} className={cfg.iconColor} />
                  <span className={`text-xs font-bold ${cfg.badgeText}`}>{cfg.label}</span>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-white/90 mb-0.5">Member Name</p>
                  <p className="text-xl font-bold text-white leading-tight">{profile?.name || "Member"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/90 mb-0.5">Status</p>
                  <p className="text-sm font-semibold text-white">{profile?.membershipStatus === "founding" ? "Founding Member" : "Member"}</p>
                </div>
              </div>

              <div className="h-px bg-white/10" />

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-sm text-white/90 mb-0.5">Dues Paid</p>
                  <p className="text-base font-bold text-white">$500</p>
                </div>
                <div>
                  <p className="text-sm text-white/90 mb-0.5">Rides</p>
                  <p className="text-base font-bold text-white">{rides}</p>
                </div>
                <div>
                  <p className="text-sm text-white/90 mb-0.5">Voting</p>
                  <p className="text-base font-bold text-white">1 Share</p>
                </div>
              </div>

              {toNext !== null ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-white/65">
                    <span>{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
                    <span>{toNext} rides to {cfg.nextLabel}</span>
                  </div>
                  <div className={`h-1 rounded-full ${cfg.progressTrack}`}>
                    {/* eslint-disable-next-line react/forbid-component-props */}
                    <div className={`h-full rounded-full ${cfg.progressColor} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Sparkles size={11} className={cfg.iconColor} />
                  <span className={`text-[10px] font-semibold ${cfg.badgeText}`}>Maximum tier reached</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Board Initiatives */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Active Voting
            </p>
            <p className="text-xs text-muted-foreground mt-1">Cast your vote to shape cooperative policy</p>
          </div>

          <div className="space-y-3">
            {INITIATIVES.map((initiative) => {
              const voted = initiative.id in savedVotes;
              const voteChoice = savedVotes[initiative.id];
              const isPending = pendingVote?.id === initiative.id;

              return (
                <div
                  key={initiative.id}
                  className="glass-card p-5 border border-border hover:border-primary/30 transition-colors space-y-4 rounded-xl"
                >
                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground text-sm leading-snug">
                      {initiative.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {initiative.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-muted-foreground">{initiative.deadline}</span>
                  </div>

                  {voted ? (
                    <div className="flex items-center gap-2 p-3 bg-card/50 rounded-lg border border-border/50">
                      {voteChoice === "approve" ? (
                        <>
                          <CheckCircle size={18} className="text-primary" />
                          <span className="text-sm font-medium text-primary">You voted to Approve</span>
                        </>
                      ) : (
                        <>
                          <XCircle size={18} className="text-destructive" />
                          <span className="text-sm font-medium text-destructive">You voted to Reject</span>
                        </>
                      )}
                    </div>
                  ) : isPending ? (
                    <div className="space-y-3 p-3 bg-card/50 rounded-lg border border-border/50">
                      <p className="text-xs text-muted-foreground">
                        Confirm your vote —{" "}
                        <span className={pendingVote.choice === "approve" ? "text-primary font-semibold" : "text-destructive font-semibold"}>
                          {pendingVote.choice === "approve" ? "Approve" : "Reject"}
                        </span>
                        . This vote is binding and cannot be changed.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPendingVote(null)}
                          className="py-2 px-4 rounded-lg border border-border text-muted-foreground hover:text-foreground font-semibold text-sm transition-all active:scale-95"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={confirmVote}
                          disabled={submitting}
                          className={`py-2 px-4 rounded-lg font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 ${
                            pendingVote.choice === "approve"
                              ? "bg-primary text-white"
                              : "bg-destructive/10 border border-destructive/50 text-destructive"
                          }`}
                        >
                          <CheckCircle size={15} />
                          {submitting ? "Saving…" : "Confirm"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingVote({ id: initiative.id, choice: "approve" })}
                        className="py-2.5 px-4 rounded-lg bg-primary text-white font-semibold text-sm hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <CheckCircle size={16} />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingVote({ id: initiative.id, choice: "reject" })}
                        className="py-2.5 px-4 rounded-lg border-2 border-destructive/30 text-destructive hover:border-destructive/60 hover:bg-destructive/5 font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary Info */}
        <div className="glass-card p-4 border border-border rounded-xl">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            About Your Voting Power
          </p>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary flex-shrink-0">•</span>
              <span>As a founding member, you have equal voting power (1 share = 1 voice)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary flex-shrink-0">•</span>
              <span>All votes are binding on cooperative policy decisions</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary flex-shrink-0">•</span>
              <span>Complete transparency: all initiatives are logged on the cooperative ledger</span>
            </li>
          </ul>
        </div>

        {/* Deactivation Protection */}
        <div className="glass-card p-4 border border-primary/20 rounded-xl space-y-3 bg-primary/5">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Deactivation Protection
            </p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Unlike Corp, WeGo cannot remove you by algorithm alone. Every deactivation requires:
          </p>
          <ul className="space-y-2">
            {[
              "Documented human review of the specific incident",
              "Written notice with the stated reason",
              "30-day appeal right to the member-elected board committee",
              "Management cannot override a board appeal decision",
            ].map((item) => (
              <li key={item} className="flex gap-2 text-xs">
                <CheckCircle size={13} className="text-primary flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
