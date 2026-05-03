import { useState } from "react";
import { Link } from "react-router-dom";
import { Award, CheckCircle, XCircle, Shield, Settings } from "lucide-react";

interface InitiativeVote {
  id: string;
  title: string;
  description: string;
  deadline: string;
  voted?: boolean;
  voteChoice?: "approve" | "reject";
}

interface PendingVote {
  id: string;
  choice: "approve" | "reject";
}

export default function Governance() {
  const [initiatives, setInitiatives] = useState<InitiativeVote[]>([
    {
      id: "init-08",
      title: "Initiative #08: Year 6 AV Fleet Sourcing",
      description: "Approve allocation of $450K from hardware reserve to purchase 3 additional autonomous vehicles for Q4 2026 deployment.",
      deadline: "Closes in 5 days",
      voted: false,
    },
    {
      id: "init-09",
      title: "Initiative #09: Adjust Target Pension Floor for Inflation",
      description: "Update the minimum pension floor calculation to account for 3.2% annual inflation, ensuring purchasing power for retiring members.",
      deadline: "Closes in 8 days",
      voted: false,
    },
  ]);

  const [pendingVote, setPendingVote] = useState<PendingVote | null>(null);

  const confirmVote = () => {
    if (!pendingVote) return;
    setInitiatives(initiatives.map(init =>
      init.id === pendingVote.id ? { ...init, voted: true, voteChoice: pendingVote.choice } : init
    ));
    setPendingVote(null);
  };

  return (
    <div className="bg-background pt-4 px-4 pb-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Governance</h1>
          <p className="text-muted-foreground">Your voice in the cooperative</p>
        </div>

        {/* Digital ID Card - Premium Wallet Style */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Digital Member ID
          </p>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-blue-950 to-slate-950 border border-primary/30 p-6 space-y-6">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(45deg, transparent 30%, rgba(0, 71, 255, 0.1) 32%, rgba(0, 71, 255, 0.1) 34%, transparent 36%, transparent 64%, rgba(0, 71, 255, 0.1) 66%, rgba(0, 71, 255, 0.1) 68%, transparent 70%)",
                  backgroundSize: "80px 80px",
                }}
              />
            </div>

            {/* Content */}
            <div className="relative z-10 space-y-5">
              {/* Top Badge */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/15 border border-white/30 rounded-full">
                  <Shield size={14} className="text-white/80" />
                  <span className="text-xs font-semibold text-white">Active Seat: Verified</span>
                </div>
                <div className="text-primary text-opacity-60">
                  <Award size={20} />
                </div>
              </div>

              {/* Member Info */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-white/50 mb-1">Member Name</p>
                  <p className="text-2xl font-bold text-white">Tenzin C.</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 mb-1">Status</p>
                  <p className="text-lg font-semibold text-white/90">Founding Member #0042</p>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

              {/* Co-op Shares Stats */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-xs text-white/50 mb-2">Total Dues Paid</p>
                  <p className="text-xl font-bold text-white">$500</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 mb-2">Voting Power</p>
                  <p className="text-xl font-bold text-white">1 Share</p>
                  <p className="text-xs text-white/50">Equal Voice</p>
                </div>
              </div>
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
            {initiatives.map((initiative) => (
              <div
                key={initiative.id}
                className="glass-card p-5 border border-border hover:border-primary/30 transition-colors space-y-4 rounded-xl"
              >
                {/* Initiative Title */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-foreground text-sm leading-snug">
                    {initiative.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {initiative.description}
                  </p>
                </div>

                {/* Deadline */}
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{initiative.deadline}</span>
                </div>

                {/* Vote Status, Confirm Dialog, or Action Buttons */}
                {initiative.voted ? (
                  <div className="flex items-center gap-2 p-3 bg-card/50 rounded-lg border border-border/50">
                    {initiative.voteChoice === "approve" ? (
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
                ) : pendingVote?.id === initiative.id ? (
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
                        className={`py-2 px-4 rounded-lg font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${
                          pendingVote.choice === "approve"
                            ? "bg-primary text-white"
                            : "bg-destructive/10 border border-destructive/50 text-destructive"
                        }`}
                      >
                        <CheckCircle size={15} />
                        Confirm
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
            ))}
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
              <span className="text-secondary flex-shrink-0">•</span>
              <span>Complete transparency: all initiatives are publicly logged on-chain</span>
            </li>
          </ul>
        </div>

        {/* Settings */}
        <Link
          to="/settings"
          className="glass-card flex items-center justify-between p-4 border border-border rounded-xl hover:border-primary/30 transition-colors active:scale-95"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Settings size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Account Settings</p>
              <p className="text-xs text-muted-foreground">Notifications, vehicle, payout preferences</p>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="m9 18 6-6-6-6"/></svg>
        </Link>

        {/* Deactivation Protection */}
        <div className="glass-card p-4 border border-primary/20 rounded-xl space-y-3 bg-primary/5">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Deactivation Protection
            </p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Unlike Uber or Lyft, WeGo cannot remove you by algorithm alone. Every deactivation requires:
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
