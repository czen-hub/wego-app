import { useState, useEffect } from "react";
import { Bell, Star, AlertCircle, Info, ChevronRight, ChevronLeft, Check, Tag } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { listenToMessages, markMessageRead as markMsgRead, markAllMessagesRead, type Message as DbMessage } from "@/lib/db";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Message | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");

  useEffect(() => {
    if (!user) return;
    const unsub = listenToMessages(user.uid, (dbMsgs) => {
      setMessages(dbMsgs.map(fromDb));
      setLoaded(true);
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

  const markAllRead = () => {
    const unreadIds = messages.filter((m) => !m.read).map((m) => m.id);
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
    if (unreadIds.length) markAllMessagesRead(unreadIds).catch(() => {});
  };

  if (selected) {
    return (
      <div className="pt-4 px-4 pb-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Back to Inbox"
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-foreground" />
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
          {!loaded ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-full bg-card border border-border rounded-xl flex items-start gap-3 p-4 animate-pulse">
                  <div className="w-9 h-9 rounded-lg bg-muted/40 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 w-24 bg-muted/40 rounded" />
                    <div className="h-3 w-48 bg-muted/40 rounded" />
                    <div className="h-2.5 w-36 bg-muted/40 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <Bell size={32} className="mx-auto text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">
                {activeTab === "all" ? "No messages yet" : `No ${activeTab} yet`}
              </p>
              <p className="text-xs text-muted-foreground">
                WeGo will send alerts, ride ratings, and co-op updates here.
              </p>
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
