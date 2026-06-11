import LiveMap from "@/components/LiveMap";

export default function LiveFleet() {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-8 py-5 border-b border-border flex-shrink-0">
        <h1 className="text-2xl font-bold text-foreground">Live Fleet</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Real-time driver locations and active rides</p>
      </div>
      <div className="flex-1 min-h-0">
        <LiveMap mapClassName="h-full" hideCard />
      </div>
    </div>
  );
}
