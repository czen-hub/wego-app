import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Star, Clock, Plus, Minus, X, ShoppingBag, Check, ChevronRight } from "lucide-react";

interface MenuItem { id: string; name: string; desc: string; price: number }
interface Restaurant {
  id: string; name: string; cuisine: string; emoji: string;
  rating: number; time: string; delivery: number; minOrder: number; open: boolean;
}

const RESTAURANTS: Restaurant[] = [
  { id: "r1", name: "The Mission Burrito Co.", cuisine: "Mexican",  emoji: "🌯", rating: 4.8, time: "25–35 min", delivery: 2.99, minOrder: 12, open: true },
  { id: "r2", name: "Tony's Pizza",            cuisine: "Italian",  emoji: "🍕", rating: 4.9, time: "30–45 min", delivery: 3.99, minOrder: 15, open: true },
  { id: "r3", name: "Burma Superstar",          cuisine: "Asian",    emoji: "🍜", rating: 4.7, time: "35–50 min", delivery: 2.99, minOrder: 18, open: true },
  { id: "r4", name: "Gracias Madre",            cuisine: "Vegan",    emoji: "🥑", rating: 4.6, time: "25–40 min", delivery: 2.99, minOrder: 15, open: true },
  { id: "r5", name: "Super Duper Burgers",      cuisine: "Burgers",  emoji: "🍔", rating: 4.5, time: "20–30 min", delivery: 1.99, minOrder: 10, open: false },
];

const MENUS: Record<string, MenuItem[]> = {
  r1: [
    { id: "b1", name: "Mission Burrito",     desc: "Carne asada, rice, beans, salsa",        price: 13.50 },
    { id: "b2", name: "Veggie Burrito",      desc: "Grilled veggies, black beans, guac",     price: 12.00 },
    { id: "b3", name: "Chips & Guacamole",   desc: "House-made guac, fresh chips",            price: 6.50  },
    { id: "b4", name: "Horchata",            desc: "Fresh rice milk, cinnamon",               price: 4.00  },
  ],
  r2: [
    { id: "p1", name: "Margherita Pizza",    desc: "San Marzano tomatoes, fresh mozzarella", price: 18.00 },
    { id: "p2", name: "Pepperoni Pizza",     desc: "House pepperoni, mozzarella",             price: 20.00 },
    { id: "p3", name: "Garlic Knots",        desc: "6 knots, marinara sauce",                 price: 7.00  },
    { id: "p4", name: "Caesar Salad",        desc: "Romaine, parmesan, house croutons",       price: 11.00 },
  ],
  r3: [
    { id: "a1", name: "Laphet Thoke",        desc: "Fermented tea leaf salad",                price: 14.00 },
    { id: "a2", name: "Rainbow Salad",       desc: "Cabbage, tomatoes, fried garlic",         price: 12.00 },
    { id: "a3", name: "Coconut Noodle Soup", desc: "Rich coconut curry broth, chicken",       price: 16.00 },
    { id: "a4", name: "Mango Chicken",       desc: "Sweet & sour mango sauce, jasmine rice",  price: 15.00 },
  ],
  r4: [
    { id: "v1", name: "Enchiladas Verdes",   desc: "Cashew cheese, tomatillo, pepitas",       price: 18.00 },
    { id: "v2", name: "Mushroom Tacos",      desc: "Maitake, avocado crema, pickled onion",   price: 16.00 },
    { id: "v3", name: "Cauliflower Ceviche", desc: "Citrus-marinated, tortilla chips",        price: 14.00 },
    { id: "v4", name: "Agua Fresca",         desc: "Seasonal fruit & lime",                   price: 5.00  },
  ],
  r5: [
    { id: "g1", name: "Classic Burger",      desc: "Angus beef, lettuce, tomato, sauce",     price: 11.00 },
    { id: "g2", name: "Veggie Burger",       desc: "House-made patty, avocado",              price: 12.00 },
    { id: "g3", name: "Fries",               desc: "Crispy shoestring fries",                price: 4.50  },
    { id: "g4", name: "Milkshake",           desc: "Vanilla, chocolate, or strawberry",      price: 6.00  },
  ],
};

const CATEGORIES = ["All", "Mexican", "Italian", "Asian", "Vegan", "Burgers"];

export default function FoodDelivery() {
  const navigate = useNavigate();
  const [category, setCategory] = useState("All");
  const [activeRestaurant, setActiveRestaurant] = useState<Restaurant | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const filtered = RESTAURANTS.filter((r) => category === "All" || r.cuisine === category);

  const changeQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const next = { ...prev, [itemId]: (prev[itemId] ?? 0) + delta };
      if (next[itemId] <= 0) delete next[itemId];
      return next;
    });
  };

  const cartItems = activeRestaurant
    ? MENUS[activeRestaurant.id].filter((item) => cart[item.id] > 0)
    : [];

  const subtotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const menu = activeRestaurant ? MENUS[activeRestaurant.id] : [];
    const item = menu.find((m) => m.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  const openRestaurant = (r: Restaurant) => {
    setActiveRestaurant(r);
    setCart({});
  };

  const closeRestaurant = () => {
    setActiveRestaurant(null);
    setCart({});
  };

  const placeOrder = () => setOrderPlaced(true);

  if (orderPlaced && activeRestaurant) {
    return (
      <div className="min-h-full bg-background flex flex-col items-center justify-center px-4 py-10 space-y-5">
        <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Check size={36} className="text-primary" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Order Placed!</h1>
          <p className="text-muted-foreground text-sm">{activeRestaurant.name}</p>
        </div>
        <div className="w-full bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order Summary</p>
          {cartItems.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-foreground">{cart[item.id]}× {item.name}</span>
              <span className="text-muted-foreground">${(item.price * cart[item.id]).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-border/50 pt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery fee</span>
              <span className="text-foreground">${activeRestaurant.delivery.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-foreground">Total</span>
              <span className="text-foreground">${(subtotal + activeRestaurant.delivery).toFixed(2)}</span>
            </div>
          </div>
          <div className="bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground">Estimated delivery: <span className="font-semibold text-foreground">{activeRestaurant.time}</span></p>
          </div>
        </div>
        <div className="w-full space-y-2">
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <p className="text-sm text-foreground font-medium">Restaurant is preparing your order...</p>
          </div>
        </div>
        <button type="button" onClick={() => navigate("/")}
          className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform">
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-background pt-4 px-4 pb-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Header */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate("/")}
              className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0">
              <ChevronLeft size={18} className="text-foreground" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Food Delivery</h1>
              <p className="text-xs text-muted-foreground">Driver earns 88% of every delivery</p>
            </div>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors flex-shrink-0 ${category === cat ? "bg-primary text-white border-primary" : "bg-card border-border text-foreground"}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Restaurant list */}
          <div className="space-y-3">
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => r.open && openRestaurant(r)}
                className={`w-full bg-card border border-border rounded-xl overflow-hidden text-left transition-all active:scale-[0.99] ${r.open ? "hover:border-primary/40 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
              >
                <div className="h-20 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-5xl">
                  {r.emoji}
                </div>
                <div className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-foreground">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.cuisine}</p>
                    </div>
                    {!r.open && <span className="text-[10px] font-semibold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full flex-shrink-0">Closed</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Star size={10} fill="currentColor" className="text-yellow-400" />
                      <span className="font-semibold text-foreground">{r.rating}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={10} />
                      <span>{r.time}</span>
                    </div>
                    <span>${r.delivery.toFixed(2)} delivery</span>
                    <span>Min ${r.minOrder}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── RESTAURANT MENU SHEET ──────────────────────────────────────── */}
      {activeRestaurant && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeRestaurant} />
          <div className="relative w-full max-w-[430px] bg-card border-t border-border rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">

            {/* Restaurant header */}
            <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-border flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{activeRestaurant.emoji}</span>
                <div>
                  <p className="text-base font-bold text-foreground">{activeRestaurant.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Star size={9} fill="currentColor" className="text-yellow-400" />{activeRestaurant.rating}</span>
                    <span>{activeRestaurant.time}</span>
                  </div>
                </div>
              </div>
              <button type="button" onClick={closeRestaurant} aria-label="Close" className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Menu items */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {MENUS[activeRestaurant.id].map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-background border border-border rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.desc}</p>
                    <p className="text-sm font-bold text-primary mt-1">${item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(cart[item.id] ?? 0) > 0 ? (
                      <>
                        <button type="button" onClick={() => changeQty(item.id, -1)} aria-label="Remove one"
                          className="w-7 h-7 rounded-full bg-muted/30 border border-border flex items-center justify-center">
                          <Minus size={12} className="text-foreground" />
                        </button>
                        <span className="text-sm font-bold text-foreground w-4 text-center">{cart[item.id]}</span>
                      </>
                    ) : null}
                    <button type="button" onClick={() => changeQty(item.id, 1)} aria-label="Add one"
                      className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                      <Plus size={12} className="text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart bar */}
            {cartCount > 0 && (
              <div className="px-4 pb-6 pt-3 border-t border-border flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(true)}
                  className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-base flex items-center justify-between px-5 active:scale-95 transition-transform"
                >
                  <span className="w-6 h-6 rounded-full bg-white/20 text-sm font-bold flex items-center justify-center">{cartCount}</span>
                  <span>View Order</span>
                  <span>${subtotal.toFixed(2)}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CHECKOUT SHEET ────────────────────────────────────────────── */}
      {checkoutOpen && activeRestaurant && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCheckoutOpen(false)} />
          <div className="relative w-full max-w-[430px] bg-card border-t border-border rounded-t-2xl shadow-2xl px-4 pt-4 pb-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-primary" />
                <p className="text-base font-bold text-foreground">Your Order</p>
              </div>
              <button type="button" onClick={() => setCheckoutOpen(false)} aria-label="Close" className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-2">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between bg-background border border-border rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-primary w-5">{cart[item.id]}×</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} each</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-foreground">${(item.price * cart[item.id]).toFixed(2)}</p>
                </div>
              ))}
            </div>

            <div className="bg-background border border-border rounded-xl p-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery fee</span><span>${activeRestaurant.delivery.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-foreground border-t border-border/50 pt-1.5 mt-1">
                <span>Total</span><span>${(subtotal + activeRestaurant.delivery).toFixed(2)}</span>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/15 rounded-xl px-3 py-2 text-xs text-muted-foreground">
              Driver earns 88% of the delivery fee — <span className="font-semibold text-primary">${(activeRestaurant.delivery * 0.88).toFixed(2)}</span> goes directly to them.
            </div>

            <button
              type="button"
              onClick={placeOrder}
              className="w-full py-4 rounded-2xl bg-primary text-white font-bold text-lg active:scale-95 transition-transform shadow-lg shadow-primary/30"
            >
              Place Order — ${(subtotal + activeRestaurant.delivery).toFixed(2)}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
