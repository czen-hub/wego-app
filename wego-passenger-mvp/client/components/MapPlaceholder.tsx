import { MapPin } from "lucide-react";

const MapPlaceholder = () => {
  return (
    <div className="relative w-full h-64 bg-gradient-to-br from-blue-950 to-slate-900 rounded-2xl overflow-hidden border border-border flex items-center justify-center flex-col gap-3">
      {/* Decorative grid pattern */}
      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(0deg, transparent 24%, rgba(0, 71, 255, 0.05) 25%, rgba(0, 71, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(0, 71, 255, 0.05) 75%, rgba(0, 71, 255, 0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 71, 255, 0.05) 25%, rgba(0, 71, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(0, 71, 255, 0.05) 75%, rgba(0, 71, 255, 0.05) 76%, transparent 77%, transparent)",
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
