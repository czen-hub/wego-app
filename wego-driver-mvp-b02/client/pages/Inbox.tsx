import { useState, useEffect } from "react";
import { Bell, Star, AlertCircle, Info, ChevronRight, Check, Tag } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { listenToMessages, markMessageRead as markMsgRead, type Message as DbMessage } from "@/lib/db";

type MessageType = "wego" | "rider" | "alert" | "system" | "promo";
type Tab = "all" | "messages" | "alerts" | "promotions";

interface Message {
  id: string;
  type: MessageType;
  from: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  read: boolean;
}

const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    type: "alert",
    from: "WeGo Operations",
    subject: "High demand zone: SoMa district",
    preview: "High ride activity in SoMa. Head there now to get more requests.",
    body: "High ride demand has been detected in the SoMa district (Mission St / 3rd St area). Drivers heading there now are seeing more ride requests. This typically lasts 30–60 minutes. Note: WeGo does not apply surge pricing — your rate stays the same, but you will get more rides.",
    time: "2m ago",
    read: false,
  },
  {
    id: "2",
    type: "rider",
    from: "Rider — Trip #4821",
    subject: "5-star rating from Sarah M.",
    preview: "Sarah left you a 5-star rating. \"Smooth ride, very professional!\"",
    body: "Sarah M. rated your trip 5 stars and left a comment:\n\n\"Smooth ride, very professional! Car was clean and the driver knew exactly where to go. Will definitely request again.\"",
    time: "18m ago",
    read: false,
  },
  {
    id: "3",
    type: "promo",
    from: "WeGo Bonuses",
    subject: "Airport bonus active — +$8/trip at SFO",
    preview: "Head to SFO Terminal 2 pickup zone to earn an extra $8 per completed trip.",
    body: "The SFO Airport Bonus is active until 10 PM tonight.\n\nEarn an extra $8 per completed trip when you pick up from SFO Terminal 2. This bonus applies automatically — no code needed.\n\nBonus trips completed today: 0 / no limit.",
    time: "35m ago",
    read: false,
  },
  {
    id: "4",
    type: "wego",
    from: "WeGo Cooperative",
    subject: "April member vote — Deadline Friday",
    preview: "Two resolutions are open for member vote. Your voice matters.",
    body: "Two governance resolutions are open for member vote and close this Friday at 11:59 PM.\n\nResolution 23-A: Increase Hardware Reserve Fund allocation from 50% to 55% of coop fee.\n\nResolution 23-B: Add dental coverage option to the group insurance program.\n\nLog into the Governance tab to cast your vote. All active members are eligible.",
    time: "2h ago",
    read: false,
  },
  {
    id: "5",
    type: "promo",
    from: "WeGo Bonuses",
    subject: "Complete 5 more rides for a $25 weekly bonus",
    preview: "You're 10/15 rides toward your weekly bonus. Keep going!",
    body: "You're making great progress on your weekly bonus!\n\nWeekly Ride Goal: 10 / 15 completed\nBonus when you hit 15: $25.00\n\nAt your current pace you'll hit the goal by tonight. The weekly period resets every Monday at midnight.",
    time: "3h ago",
    read: true,
  },
  {
    id: "6",
    type: "wego",
    from: "WeGo Cooperative",
    subject: "April earnings statement is ready",
    preview: "Your April 2026 earnings summary has been generated.",
    body: "Your April 2026 earnings statement is now available.\n\nTotal Gross: $10,420.00\nWeGo Fee (12%): $1,250.40\nYour Net Take-Home: $9,169.60\nTotal Rides: 259\n\nThis statement has been filed for your tax records.",
    time: "Yesterday",
    read: true,
  },
  {
    id: "7",
    type: "system",
    from: "WeGo Platform",
    subject: "App updated to v2.4.1",
    preview: "Improved GPS accuracy and faster ride matching in this update.",
    body: "WeGo Driver App v2.4.1 is now live.\n\nWhat's new:\n• Improved GPS lock speed by 40%\n• Faster ride matching algorithm\n• Earnings dashboard loads 2× faster\n• Fixed rare crash on trip completion screen",
    time: "2 days ago",
    read: true,
  },
  {
    id: "8",
    type: "rider",
    from: "Rider — Trip #4809",
    subject: "4-star rating from James K.",
    preview: "James left you a 4-star rating.",
    body: "James K. rated your trip 4 stars. No written comment was left.\n\nTip: Riders who don't leave comments sometimes appreciate a simple greeting or confirming the destination at pickup.",
    time: "3 days ago",
    read: true,
  },
];

const DB_TYPE_MAP: Record<DbMessage["type"], MessageType> = {
  notification: "alert",
  system: "system",
  coop: "wego",
  earnings: "promo",
};

const DB_FROM_MAP: Record<DbMessage["type"], string> = {
  notification: "WeGo Operations",
  system: "WeGo Platform",
  coop: "WeGo Cooperative",
  earnings: "WeGo Earnings",
};

function timeAgo(date: Date | null): string {
  if (!date) return "Recently";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / 86400000);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function fromDb(m: DbMessage): Message {
  return {
    id: m.id,
    type: DB_TYPE_MAP[m.type] ?? "wego",
    from: DB_FROM_MAP[m.type] ?? "WeGo",
    subject: m.title,
    preview: m.body.length > 80 ? m.body.slice(0, 80) + "…" : m.body,
    body: m.body,
    time: timeAgo(m.createdAt),
    read: m.read,
  };
}

const TAB_FILTERS: Record<Tab, (m: Message) => boolean> = {
  all: () => true,
  messages: (m) => m.type === "rider" || m.type === "wego" || m.type === "system",
  alerts: (m) => m.type === "alert",
  promotions: (m) => m.type === "promo",
};

const typeIcon = (type: MessageType) => {
  switch (type) {
    case "alert":   return <AlertCircle size={16} className="text-foreground" />;
    case "rider":   return <Star size={16} className="text-primary" />;
    case "promo":   return <Tag size={16} className="text-primary" />;
    case "wego":    return <Bell size={16} className="text-primary" />;
    case "system":  return <Info size={16} className="text-muted-foreground" />;
  }
};

const typeBg = (type: MessageType, read: boolean) => {
  if (read) return "bg-card";
  switch (type) {
    case "alert":  return "bg-muted/20";
    case "rider":  return "bg-primary/10";
    case "promo":  return "bg-primary/10";
    case "wego":   return "bg-primary/10";
    case "system": return "bg-muted/20";
  }
};

export default function Inbox() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [selected, setSelected] = useState<Message | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");

  // Replace mock messages with real Firebase messages when available
  useEffect(() => {
    if (!user) return;
    const unsub = listenToMessages(user.uid, (dbMsgs) => {
      if (dbMsgs.length > 0) setMessages(dbMsgs.map(fromDb));
    });
    return unsub;
  }, [user]);

  const unreadCount = messages.filter((m) => !m.read).length;

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "messages", label: "Messages" },
    { id: "alerts", label: "Alerts" },
    { id: "promotions", label: "Promotions" },
  ];

  const filtered = messages.filter(TAB_FILTERS[activeTab]);

  const openMessage = (msg: Message) => {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, read: true } : m)));
    if (!msg.read) markMsgRead(msg.id).catch(() => {});
    setSelected({ ...msg, read: true });
  };

  const markAllRead = () => setMessages((prev) => prev.map((m) => ({ ...m, read: true })));

  if (selected) {
    return (
      <div className="pt-4 px-4 pb-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
          >
            ← Back to Inbox
          </button>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg border border-border flex-shrink-0 ${typeBg(selected.type, selected.read)}`}>
                {typeIcon(selected.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{selected.from}</p>
                <h2 className="text-base font-semibold text-foreground leading-snug mt-0.5">{selected.subject}</h2>
                <p className="text-xs text-muted-foreground mt-1">{selected.time}</p>
              </div>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{selected.body}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 pb-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Inbox</h1>
            <p className="text-muted-foreground text-sm">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs text-primary hover:opacity-80 transition-opacity"
            >
              <Check size={13} />
              Mark all read
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 px-4 mb-4 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const count = messages.filter(TAB_FILTERS[tab.id]).filter((m) => !m.read).length;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-primary text-white"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none ${
                    activeTab === tab.id ? "bg-white/30 text-white" : "bg-primary text-white"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Message list */}
        <div className="px-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No messages in this category</p>
            </div>
          ) : (
            filtered.map((msg) => (
              <button
                key={msg.id}
                type="button"
                onClick={() => openMessage(msg)}
                className={`w-full text-left bg-card border rounded-xl flex items-start gap-3 p-4 transition-all duration-200 hover:border-primary/40 active:scale-[0.99] ${
                  msg.read ? "border-border opacity-75" : "border-primary/25"
                }`}
              >
                <div className={`p-2 rounded-lg border border-border flex-shrink-0 mt-0.5 ${typeBg(msg.type, msg.read)}`}>
                  {typeIcon(msg.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs truncate ${msg.read ? "text-muted-foreground" : "text-foreground font-semibold"}`}>
                      {msg.from}
                    </p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{msg.time}</span>
                  </div>
                  <p className={`text-sm mt-0.5 leading-snug ${msg.read ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                    {msg.subject}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{msg.preview}</p>
                </div>
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  {!msg.read && <div className="w-2 h-2 rounded-full bg-primary" />}
                  <ChevronRight size={14} className="text-muted-foreground" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
