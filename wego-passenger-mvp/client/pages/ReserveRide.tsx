import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, Clock, Check, Calendar, ChevronRight } from "lucide-react";

const WEGO_FEE_PCT = 0.12;
const BASE_FARE = 38.00;
const ADVANCE_FEE = 8.00; // 100% to driver
const TOTAL_FARE = BASE_FARE + ADVANCE_FEE;
const DRIVER_TAKE = BASE_FARE * (1 - WEGO_FEE_PCT) + ADVANCE_FEE;
const COOP_FEE = BASE_FARE * WEGO_FEE_PCT;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function generateDates() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      dayLabel: i === 0 ? "Today" : i === 1 ? "Tomorrow" : DAY_NAMES[d.getDay()],
      dateLabel: `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`,
      value: d.toISOString().split("T")[0],
    };
  });
}

function generateTimes() {
  const slots: string[] = [];
  for (let h = 5; h < 24; h++) {
    for (const m of [0, 30]) {
      const hour = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      slots.push(`${hour}:${m === 0 ? "00" : "30"} ${ampm}`);
    }
  }
  return slots;
}

const DATES = generateDates();
const TIMES = generateTimes();

const QUICK_DESTINATIONS = [
  { label: "SFO Airport", sublabel: "San Francisco Intl", emoji: "✈️" },
  { label: "Downtown SF", sublabel: "Market & 5th St", emoji: "🏙️" },
  { label: "Oakland", sublabel: "Jack London Square", emoji: "🌉" },
  { label: "Google Campus", sublabel: "Mountain View", emoji: "🏢" },
];

export default function ReserveRide() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(DATES[0].value);
  const [selectedTime, setSelectedTime] = useState("8:00 AM");
  const [pickup, setPickup] = useState("Current Location");
  const [destination, setDestination] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [bookingRef] = useState(() => `WG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
  const [cancelInfoOpen, setCancelInfoOpen] = useState(false);

  const selectedDateObj = DATES.find((d) => d.value === selectedDate)!;

  const handleConfirm = () => {
    if (!destination.trim()) return;
    setConfirmed(true);
  };

  if (confirmed) {
    return (
      <div className="min-h-full bg-background flex flex-col items-center justify-center px-4 py-10 space-y-5">
        <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Check size={36} className="text-primary" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Ride Reserved!</h1>
          <p className="text-muted-foreground text-sm">Your driver will be notified in advance</p>
        </div>

        <div className="w-full bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Booking Confirmation</p>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-bold text-primary font-mono tracking-wider">{bookingRef}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span className="font-semibold text-foreground">{selectedDateObj.dayLabel}, {selectedDateObj.dateLabel}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pickup time</span>
              <span className="font-semibold text-foreground">{selectedTime}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pickup</span>
              <span className="font-semibold text-foreground text-right max-w-[55%] truncate">{pickup}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Destination</span>
              <span className="font-semibold text-foreground text-right max-w-[55%] truncate">{destination}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border/50 pt-2">
              <span className="text-muted-foreground">Base fare</span>
              <span className="font-semibold text-foreground">${BASE_FARE.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Advance booking fee</span>
              <span className="font-semibold text-foreground">${ADVANCE_FEE.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border/50 pt-2">
              <span className="text-muted-foreground font-semibold">Total</span>
              <span className="font-bold text-foreground">${TOTAL_FARE.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="w-full bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 space-y-1 text-xs text-muted-foreground">
          <p>• A WeGo driver will be matched 1 hour before your pickup.</p>
          <p>• You'll receive a notification with driver details.</p>
          <p className="flex items-center gap-1 flex-wrap">
            <span>• Free cancellation up to 1 hour before pickup.</span>
            <button type="button" onClick={() => setCancelInfoOpen((v) => !v)}
              className="text-primary font-semibold underline underline-offset-2 leading-none">
              {cancelInfoOpen ? "Hide" : "Learn more"}
            </button>
          </p>
          {cancelInfoOpen && (
            <div className="mt-2 pt-2 border-t border-primary/15 space-y-1">
              <p className="font-semibold text-foreground mb-1">Cancellation fees after 1hr window:</p>
              <p>• Driver nearby (&lt;5 mi) — <span className="text-foreground font-medium">$5.00</span></p>
              <p>• Driver 5–10 mi en route — <span className="text-foreground font-medium">$9.00</span></p>
              <p>• Driver 10+ mi en route — <span className="text-foreground font-medium">$14.00</span></p>
              <p>• Driver arrived — distance fee <span className="text-foreground font-medium">+ $3.00</span> waiting <span className="text-muted-foreground/70">(covers 8 min free · $0.50/min after)</span></p>
              <p className="text-muted-foreground/70 pt-1">100% goes to the driver. WeGo keeps none of it.</p>
            </div>
          )}
        </div>

        <button type="button" onClick={() => navigate("/")}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform">
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3 flex-shrink-0">
        <button type="button" onClick={() => navigate("/")} aria-label="Back to home"
          className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0">
          <ChevronLeft size={18} className="text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reserve a Ride</h1>
          <p className="text-xs text-muted-foreground">Schedule up to 7 days in advance</p>
        </div>
      </div>

      <div className="flex-1 px-4 pb-6 space-y-5 pt-2 overflow-y-auto">

        {/* Date selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Calendar size={13} className="text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pickup Date</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {DATES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setSelectedDate(d.value)}
                className={`flex-shrink-0 flex flex-col items-center px-4 py-3 rounded-xl border transition-colors active:scale-95 min-w-[72px] ${selectedDate === d.value ? "bg-primary border-primary text-white" : "bg-card border-border text-foreground"}`}
              >
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${selectedDate === d.value ? "text-white/70" : "text-muted-foreground"}`}>{d.dayLabel}</span>
                <span className="text-sm font-bold mt-0.5">{d.dateLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Clock size={13} className="text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pickup Time</p>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">Selected: {selectedTime}</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 py-3 scrollbar-hide">
              {TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSelectedTime(t)}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors active:scale-95 ${selectedTime === t ? "bg-primary border-primary text-white" : "bg-background border-border text-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Destination */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <MapPin size={13} className="text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destination</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex gap-3 items-start">
              <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <div className="w-px h-8 bg-border" />
                <div className="w-3 h-3 rounded-full border-2 border-foreground" />
              </div>
              <div className="space-y-3 flex-1 min-w-0">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pickup</p>
                  <input
                    type="text"
                    placeholder="Current Location"
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Dropoff</p>
                  <input
                    type="text"
                    placeholder="Where to?"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            {/* Quick picks */}
            {!destination && (
              <div className="space-y-1.5 border-t border-border/50 pt-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Quick picks</p>
                {QUICK_DESTINATIONS.map((dest) => (
                  <button
                    key={dest.label}
                    type="button"
                    onClick={() => setDestination(dest.label)}
                    className="w-full flex items-center gap-3 py-2 text-left active:scale-[0.99] transition-all"
                  >
                    <span className="text-base">{dest.emoji}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{dest.label}</p>
                      <p className="text-xs text-muted-foreground">{dest.sublabel}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fare preview */}
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estimated Fare</p>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-bold text-foreground">${TOTAL_FARE.toFixed(2)}</p>
            <p className="text-xs text-primary font-semibold">No surge — ever</p>
          </div>
          <div className="space-y-1 pt-1 border-t border-border/40">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Base fare</span>
              <span>${BASE_FARE.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Advance booking fee <span className="text-primary font-semibold">(100% to driver)</span></span>
              <span>${ADVANCE_FEE.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/30">
              <span>Driver earns <span className="font-bold text-primary">${DRIVER_TAKE.toFixed(2)}</span></span>
              <span>WeGo coop <span className="text-muted-foreground">${COOP_FEE.toFixed(2)}</span></span>
            </div>
          </div>
        </div>

        {/* Summary card */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Booking Summary</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-semibold text-foreground">{selectedDateObj.dayLabel}, {selectedDateObj.dateLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="font-semibold text-foreground">{selectedTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">To</span>
              <span className="font-semibold text-foreground truncate max-w-[55%] text-right">{destination || "—"}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!destination.trim()}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform shadow-lg shadow-primary/30 disabled:opacity-40"
        >
          Book for {selectedDateObj.dayLabel} at {selectedTime}
        </button>
        <p className="text-xs text-center text-muted-foreground">Free cancellation up to 1 hour before pickup</p>
      </div>
    </div>
  );
}
