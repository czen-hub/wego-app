import { MapPin } from "lucide-react";

const MapPlaceholder = () => {
  return (
    <div className="relative w-full h-64 bg-zinc-900 rounded-2xl overflow-hidden border border-border flex items-center justify-center flex-col gap-3">
      {/* Decorative grid pattern */}
      <div className="absolute inset-0 opacity-30">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(0deg, transparent 24%, rgba(251,191,36,0.06) 25%, rgba(251,191,36,0.06) 26%, transparent 27%, transparent 74%, rgba(251,191,36,0.06) 75%, rgba(251,191,36,0.06) 76%, transparent 77%), linear-gradient(90deg, transparent 24%, rgba(251,191,36,0.06) 25%, rgba(251,191,36,0.06) 26%, transparent 27%, transparent 74%, rgba(251,191,36,0.06) 75%, rgba(251,191,36,0.06) 76%, transparent 77%)",
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Location marker */}
      <div className="relative z-10">
        <div className="flex flex-col items-center gap-2">
          <MapPin size={32} className="text-primary animate-bounce" />
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Your Location</p>
            <p className="text-xs text-muted-foreground">San Francisco, CA</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapPlaceholder;
