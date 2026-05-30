import { useState, useEffect, useRef } from "react";
import { Bell, Star, AlertCircle, Info, ChevronRight, ChevronLeft, Check, Tag, Send, MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { listenToMessages, markMessageRead as markMsgRead, markAllMessagesRead, sendRideMessage, type Message as DbMessage } from "@/lib/db";

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
  rawTime: Date | null;
  read: boolean;
  rideId?: string;
}

// A "thread" groups all messages from the same rideId (passenger lost-item conversations).
// Non-ride messages are single-item pseudo-threads.
interface Thread {
  threadId: string;        // rideId for passenger threads, msg.id for singles
  type: MessageType;
  from: string;
  subject: string;
  preview: string;         // most recent message body
  time: string;
  hasUnread: boolean;
  messageCount: number;
  messages: Message[];     // newest first
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
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / 86400000);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function fromDb(m: DbMessage): Message {
  const isPassengerMsg = m.type === "notification" && m.rideId;
  return {
    id: m.id,
    type: isPassengerMsg ? "rider" : (DB_TYPE_MAP[m.type] ?? "wego"),
    from: m.fromName || DB_FROM_MAP[m.type] || "WeGo",
    subject: m.title,
    preview: m.body.length > 80 ? m.body.slice(0, 80) + "…" : m.body,
    body: m.body,
    time: timeAgo(m.createdAt),
    rawTime: m.createdAt,
    read: m.read,
    rideId: m.rideId,
  };
}

// Group messages with the same rideId into conversation threads.
function buildThreads(messages: Message[]): Thread[] {
  const rideGroups = new Map<string, Message[]>();
  const singles: Message[] = [];

  for (const msg of messages) {
    if (msg.type === "rider" && msg.rideId) {
      const group = rideGroups.get(msg.rideId) ?? [];
      group.push(msg);
      rideGroups.set(msg.rideId, group);
    } else {
      singles.push(msg);
    }
  }

  const threads: Thread[] = [];

  // Passenger conversation threads (grouped by rideId)
  for (const [rideId, msgs] of rideGroups) {
    const sorted = [...msgs].sort((a, b) => (b.rawTime?.getTime() ?? 0) - (a.rawTime?.getTime() ?? 0));
    const newest = sorted[0];
    threads.push({
      threadId: rideId,
      type: "rider",
      from: newest.from,
      subject: `Message from ${newest.from}`,
      preview: newest.body,
      time: newest.time,
      hasUnread: sorted.some((m) => !m.read),
      messageCount: sorted.length,
      messages: sorted,
    });
  }

  // Individual non-passenger messages
  for (const msg of singles) {
    threads.push({
      threadId: msg.id,
      type: msg.type,
      from: msg.from,
      subject: msg.subject,
      preview: msg.preview,
      time: msg.time,
      hasUnread: !msg.read,
      messageCount: 1,
      messages: [msg],
    });
  }

  // Sort threads newest first
  threads.sort((a, b) => {
    const ta = a.messages[0]?.rawTime?.getTime() ?? 0;
    const tb = b.messages[0]?.rawTime?.getTime() ?? 0;
    return tb - ta;
  });

  return threads;
}

const TAB_FILTERS: Record<Tab, (t: Thread) => boolean> = {
  all: () => true,
  messages: (t) => t.type === "rider" || t.type === "wego" || t.type === "system",
  alerts: (t) => t.type === "alert",
  promotions: (t) => t.type === "promo",
};

const typeIcon = (type: MessageType) => {
  switch (type) {
    case "alert":   return <AlertCircle size={16} className="text-foreground" />;
    case "rider":   return <MessageCircle size={16} className="text-primary" />;
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
  const [selected, setSelected] = useState<Thread | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [replyText, setReplyText] = useState("");
  const [replySent, setReplySent] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = listenToMessages(user.uid, (dbMsgs) => {
      setMessages(dbMsgs.map(fromDb));
      setLoaded(true);
    });
    return unsub;
  }, [user]);

  // If the selected thread is a passenger thread, keep it live as messages arrive
  useEffect(() => {
    if (!selected || selected.type !== "rider") return;
    const updated = buildThreads(messages).find((t) => t.threadId === selected.threadId);
    if (updated) setSelected(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const threads = buildThreads(messages);
  const unreadCount = threads.filter((t) => t.hasUnread).length;

  const tabs: { id: Tab; label: string }[] = [
    { id: "all",        label: "All" },
    { id: "messages",   label: "Messages" },
    { id: "alerts",     label: "Alerts" },
    { id: "promotions", label: "Promotions" },
  ];

  const filtered = threads.filter(TAB_FILTERS[activeTab]);

  const openThread = (thread: Thread) => {
    // Mark all unread messages in this thread as read
    const unreadIds = thread.messages.filter((m) => !m.read).map((m) => m.id);
    if (unreadIds.length) {
      markAllMessagesRead(unreadIds).catch(() => {});
      setMessages((prev) => prev.map((m) => unreadIds.includes(m.id) ? { ...m, read: true } : m));
    }
    setSelected({ ...thread, hasUnread: false, messages: thread.messages.map((m) => ({ ...m, read: true })) });
    setReplyText("");
    setReplySent(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selected?.threadId || !user) return;
    await sendRideMessage(selected.threadId, user.uid, "driver", replyText.trim());
    setReplyText("");
    setReplySent(true);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const markAllRead = () => {
    const unreadIds = messages.filter((m) => !m.read).map((m) => m.id);
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
    if (unreadIds.length) markAllMessagesRead(unreadIds).catch(() => {});
  };

  // ── Thread detail view ──────────────────────────────────────────────────────
  if (selected) {
    const isPassengerThread = selected.type === "rider";
    const chronological = [...selected.messages].sort(
      (a, b) => (a.rawTime?.getTime() ?? 0) - (b.rawTime?.getTime() ?? 0)
    );

    return (
      <div className="pt-4 px-4 pb-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Back to Inbox"
            className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft size={20} className="text-foreground" />
          </button>

          {/* Thread header */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border border-border flex-shrink-0 ${typeBg(selected.type, true)}`}>
              {typeIcon(selected.type)}
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{selected.from}</p>
              {isPassengerThread && (
                <p className="text-xs text-muted-foreground">
                  {selected.messageCount} message{selected.messageCount !== 1 ? "s" : ""} · Lost item inquiry
                </p>
              )}
            </div>
          </div>

          {/* Message bubbles for passenger threads, single body for others */}
          {isPassengerThread ? (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3 min-h-48 max-h-[60vh] overflow-y-auto">
              {chronological.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-1">
                  <div className="max-w-[80%] self-start bg-secondary rounded-2xl rounded-tl-sm px-4 py-2.5">
                    <p className="text-sm text-foreground leading-relaxed">{msg.body}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground pl-1">{msg.time}</p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-semibold text-foreground mb-1">{selected.subject}</p>
              <p className="text-xs text-muted-foreground mb-4">{selected.time}</p>
              <div className="border-t border-border pt-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{selected.messages[0]?.body}</p>
              </div>
            </div>
          )}

          {/* Reply box — only for passenger threads */}
          {isPassengerThread && (
            <div className="space-y-2">
              {replySent ? (
                <p className="text-sm text-primary font-medium text-center py-2">Reply sent to passenger</p>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) sendReply(); }}
                    placeholder="Reply to passenger…"
                    className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    aria-label="Send reply"
                    onClick={sendReply}
                    disabled={!replyText.trim()}
                    className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform flex-shrink-0"
                  >
                    <Send size={16} className="text-primary-foreground" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Thread list ─────────────────────────────────────────────────────────────
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

        {/* Tabs */}
        <div className="flex gap-2 px-4 mb-4 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const count = threads.filter(TAB_FILTERS[tab.id]).filter((t) => t.hasUnread).length;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none ${
                    activeTab === tab.id ? "bg-white/30 text-primary-foreground" : "bg-primary text-primary-foreground"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Thread list */}
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
            filtered.map((thread) => (
              <button
                key={thread.threadId}
                type="button"
                onClick={() => openThread(thread)}
                className={`w-full text-left bg-card border rounded-xl flex items-start gap-3 p-4 transition-all duration-200 hover:border-primary/40 active:scale-[0.99] ${
                  thread.hasUnread ? "border-primary/25" : "border-border opacity-75"
                }`}
              >
                <div className={`p-2 rounded-lg border border-border flex-shrink-0 mt-0.5 ${typeBg(thread.type, !thread.hasUnread)}`}>
                  {typeIcon(thread.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs truncate ${thread.hasUnread ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                      {thread.from}
                    </p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{thread.time}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className={`text-sm leading-snug ${thread.hasUnread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {thread.subject}
                    </p>
                    {thread.messageCount > 1 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                        {thread.messageCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{thread.preview}</p>
                </div>
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  {thread.hasUnread && <div className="w-2 h-2 rounded-full bg-primary" />}
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
