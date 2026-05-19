import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
  GeoPoint,
  increment,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";

export type RideStatus = "pending" | "accepted" | "arrived" | "inProgress" | "completed" | "cancelled" | "reserved";
export type RideType = "ride" | "courier" | "food";

export interface Ride {
  id: string;
  status: RideStatus;
  type: RideType;
  passengerId: string;
  passengerName: string;
  driverId: string | null;
  driverName: string;
  driverRating: number;
  driverCar: string;
  driverPlate: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLocation: GeoPoint | null;
  dropoffLocation: GeoPoint | null;
  fare: number;
  driverTake: number;
  coopFee: number;
  estimatedMinutes: number;
  isAdvanced: boolean;
  stopCount: number;
  stopFeeTotal: number;
  pendingStop: { address: string; lat: number; lng: number; fareDelta: number } | null;
  stops: Array<{ address: string; lat: number; lng: number; fareDelta: number }>;
  scheduledDate: string | null;
  scheduledHour: number | null;
  scheduledMinute: number | null;
  pin: string | null;
  pinRequired: boolean;
  startedAt: Date | null;
  requestedAt: Date | null;
  acceptedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  riderRating: number;
  passengerRatingGiven: number;
  driverRatingGiven: number;
  disputed: boolean;
  disputeReason: string | null;
  disputedAt: Date | null;
  chargeBlocked: boolean;
  driverAlertSeenAt: Date | null;
}

export interface ChatMessage {
  id: string;
  rideId: string;
  senderId: string;
  senderType: "driver" | "passenger";
  text: string;
  createdAt: Date | null;
}

function toDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toDate();
  return null;
}

function rideFromDoc(id: string, data: Record<string, unknown>): Ride {
  return {
    id,
    status: (data.status as RideStatus) ?? "pending",
    type: (data.type as RideType) ?? "ride",
    passengerId: (data.passengerId as string) ?? "",
    passengerName: (data.passengerName as string) ?? "Passenger",
    driverId: (data.driverId as string | null) ?? null,
    driverName: (data.driverName as string) ?? "",
    driverRating: (data.driverRating as number) ?? 5.0,
    driverCar: (data.driverCar as string) ?? "",
    driverPlate: (data.driverPlate as string) ?? "",
    pickupAddress: (data.pickupAddress as string) ?? "",
    dropoffAddress: (data.dropoffAddress as string) ?? "",
    pickupLocation: (data.pickupLocation as GeoPoint | null) ?? null,
    dropoffLocation: (data.dropoffLocation as GeoPoint | null) ?? null,
    fare: (data.fare as number) ?? 0,
    driverTake: (data.driverTake as number) ?? 0,
    coopFee: (data.coopFee as number) ?? 0,
    estimatedMinutes: (data.estimatedMinutes as number) ?? 8,
    isAdvanced: (data.isAdvanced as boolean) ?? false,
    stopCount: (data.stopCount as number) ?? 0,
    stopFeeTotal: (data.stopFeeTotal as number) ?? 0,
    pendingStop: (data.pendingStop as { address: string; lat: number; lng: number; fareDelta: number } | null) ?? null,
    stops: (data.stops as Array<{ address: string; lat: number; lng: number; fareDelta: number }>) ?? [],
    scheduledDate: (data.scheduledDate as string | null) ?? null,
    scheduledHour: (data.scheduledHour as number | null) ?? null,
    scheduledMinute: (data.scheduledMinute as number | null) ?? null,
    pin: (data.pin as string | null) ?? null,
    pinRequired: (data.pinRequired as boolean) ?? false,
    startedAt: toDate(data.startedAt),
    requestedAt: toDate(data.requestedAt),
    acceptedAt: toDate(data.acceptedAt),
    completedAt: toDate(data.completedAt),
    cancelledAt: toDate(data.cancelledAt),
    riderRating: (data.riderRating as number) ?? 0,
    passengerRatingGiven: (data.passengerRatingGiven as number) ?? 0,
    driverRatingGiven: (data.driverRatingGiven as number) ?? 0,
    disputed: (data.disputed as boolean) ?? false,
    disputeReason: (data.disputeReason as string | null) ?? null,
    disputedAt: toDate(data.disputedAt),
    chargeBlocked: (data.chargeBlocked as boolean) ?? false,
    driverAlertSeenAt: toDate(data.driverAlertSeenAt),
  };
}

// ── Request a ride ─────────────────────────────────────────────────────────

export async function requestRide(opts: {
  passengerId: string;
  passengerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
  type?: RideType;
  pickupCoords?: [number, number] | null;
  dropoffCoords?: [number, number] | null;
  estimatedMinutes?: number;
  isAdvanced?: boolean;
  pinEnabled?: boolean;
}) {
  const coopFee = Math.round(opts.fare * 0.12 * 100) / 100;
  const driverTake = Math.round((opts.fare - coopFee) * 100) / 100;
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  return addDoc(collection(db, "rides"), {
    status: "pending",
    type: opts.type ?? "ride",
    passengerId: opts.passengerId,
    passengerName: opts.passengerName,
    driverId: null,
    driverName: "",
    driverRating: 5.0,
    driverCar: "",
    driverPlate: "",
    pickupAddress: opts.pickupAddress,
    dropoffAddress: opts.dropoffAddress,
    pickupLocation: opts.pickupCoords ? new GeoPoint(opts.pickupCoords[0], opts.pickupCoords[1]) : null,
    dropoffLocation: opts.dropoffCoords ? new GeoPoint(opts.dropoffCoords[0], opts.dropoffCoords[1]) : null,
    fare: opts.fare,
    driverTake,
    coopFee,
    estimatedMinutes: opts.estimatedMinutes ?? 8,
    isAdvanced: opts.isAdvanced ?? false,
    pin,
    pinRequired: opts.pinEnabled ?? false,
    stopCount: 0,
    stopFeeTotal: 0,
    riderRating: 0,
    passengerRatingGiven: 0,
    driverRatingGiven: 0,
    disputed: false,
    disputeReason: null,
    chargeBlocked: false,
    driverAlertSeenAt: null,
    requestedAt: serverTimestamp(),
    acceptedAt: null,
    completedAt: null,
    cancelledAt: null,
  });
}

// ── Dispute a ride ─────────────────────────────────────────────────────────

export async function disputeRide(rideId: string, reason: string): Promise<void> {
  try {
    await addDoc(collection(db, "disputes"), {
      rideId,
      reason,
      reportedAt: serverTimestamp(),
      reportedBy: "passenger",
      reviewStatus: "open",
    });
    await updateDoc(doc(db, "rides", rideId), {
      disputed: true,
      disputeReason: reason,
      disputedAt: serverTimestamp(),
      chargeBlocked: true,
      driverAlertSeenAt: null,
    });
  } catch (err) {
    console.error("disputeRide failed:", err);
    throw err;
  }
}

// ── Reserve a ride ─────────────────────────────────────────────────────────

export async function createReservedRide(opts: {
  passengerId: string;
  passengerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
  scheduledDate: string;
  scheduledHour: number;
  scheduledMinute: number;
  pickupCoords?: [number, number] | null;
  dropoffCoords?: [number, number] | null;
}) {
  const coopFee = Math.round(opts.fare * 0.12 * 100) / 100;
  const driverTake = Math.round((opts.fare - coopFee) * 100) / 100;
  const pin = String(Math.floor(1000 + Math.random() * 9000));
  return addDoc(collection(db, "rides"), {
    status: "reserved",
    type: "ride",
    passengerId: opts.passengerId,
    passengerName: opts.passengerName,
    driverId: null,
    driverName: "",
    driverRating: 5.0,
    driverCar: "",
    driverPlate: "",
    pickupAddress: opts.pickupAddress,
    dropoffAddress: opts.dropoffAddress,
    pickupLocation: opts.pickupCoords ? new GeoPoint(opts.pickupCoords[0], opts.pickupCoords[1]) : null,
    dropoffLocation: opts.dropoffCoords ? new GeoPoint(opts.dropoffCoords[0], opts.dropoffCoords[1]) : null,
    fare: opts.fare,
    driverTake,
    coopFee,
    estimatedMinutes: 8,
    isAdvanced: true,
    pin,
    pinRequired: false,
    stopCount: 0,
    stopFeeTotal: 0,
    riderRating: 0,
    passengerRatingGiven: 0,
    driverRatingGiven: 0,
    disputed: false,
    disputeReason: null,
    chargeBlocked: false,
    driverAlertSeenAt: null,
    scheduledDate: opts.scheduledDate,
    scheduledHour: opts.scheduledHour,
    scheduledMinute: opts.scheduledMinute,
    requestedAt: serverTimestamp(),
    acceptedAt: null,
    completedAt: null,
    cancelledAt: null,
  });
}

// ── Cancel a ride ──────────────────────────────────────────────────────────

export async function cancelRide(rideId: string): Promise<void> {
  try {
    await updateDoc(doc(db, "rides", rideId), {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("cancelRide failed:", err);
    throw err;
  }
}

// ── Submit rating ──────────────────────────────────────────────────────────

export async function submitRating(rideId: string, rating: number, raterType: "passenger" | "driver"): Promise<void> {
  const field = raterType === "passenger" ? "passengerRatingGiven" : "driverRatingGiven";
  await updateDoc(doc(db, "rides", rideId), { [field]: rating });
}

// ── Listen to active ride ──────────────────────────────────────────────────

export function listenToPassengerRide(
  passengerId: string,
  callback: (ride: Ride | null) => void
): () => void {
  const q = query(
    collection(db, "rides"),
    where("passengerId", "==", passengerId)
  );
  return onSnapshot(q, (snap) => {
    let rides = snap.docs.map((d) => rideFromDoc(d.id, d.data() as Record<string, unknown>));
    rides = rides.filter(r => ["pending", "accepted", "arrived", "inProgress", "reserved"].includes(r.status));
    rides.sort((a, b) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0));
    callback(rides.length === 0 ? null : rides[0]);
  }, (err) => console.error("listenToPassengerRide:", err));
}

// ── Ride history ───────────────────────────────────────────────────────────

export function listenToRideHistory(
  passengerId: string,
  callback: (rides: Ride[]) => void
): () => void {
  const q = query(
    collection(db, "rides"),
    where("passengerId", "==", passengerId)
  );
  return onSnapshot(q, (snap) => {
    let rides = snap.docs.map((d) => rideFromDoc(d.id, d.data() as Record<string, unknown>));
    rides = rides.filter(r => r.status === "completed");
    rides.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
    callback(rides.slice(0, 20));
  }, (err) => console.error("listenToRideHistory:", err));
}

// ── Ride Chat ──────────────────────────────────────────────────────────────

export async function sendRideMessage(rideId: string, senderId: string, senderType: "driver" | "passenger", text: string) {
  await addDoc(collection(db, "ride_chats"), {
    rideId,
    senderId,
    senderType,
    text,
    createdAt: serverTimestamp(),
  });
}

export function listenToRideMessages(rideId: string, callback: (messages: ChatMessage[]) => void) {
  const q = query(
    collection(db, "ride_chats"),
    where("rideId", "==", rideId)
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        rideId: data.rideId,
        senderId: data.senderId,
        senderType: data.senderType,
        text: data.text,
        createdAt: toDate(data.createdAt),
      } as ChatMessage;
    });
    msgs.sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
    callback(msgs);
  }, (err) => console.error("listenToRideMessages:", err));
}

export async function logStop(rideId: string, feeAmount: number): Promise<void> {
  try {
    await updateDoc(doc(db, "rides", rideId), {
      stopCount: increment(1),
      stopFeeTotal: increment(feeAmount),
    });
  } catch (err) {
    console.error("logStop failed:", err);
  }
}

export async function logStopWithDetails(rideId: string, opts: {
  feeAmount: number;
  address: string;
  lat: number;
  lng: number;
}): Promise<void> {
  await updateDoc(doc(db, "rides", rideId), {
    stopCount: increment(1),
    stopFeeTotal: increment(opts.feeAmount),
    pendingStop: { address: opts.address, lat: opts.lat, lng: opts.lng, fareDelta: opts.feeAmount },
    stops: arrayUnion({ address: opts.address, lat: opts.lat, lng: opts.lng, fareDelta: opts.feeAmount }),
  });
}

export async function updateStopDetails(rideId: string, opts: {
  oldFeeAmount: number;
  newFeeAmount: number;
  address: string;
  lat: number;
  lng: number;
}): Promise<void> {
  const snap = await getDoc(doc(db, "rides", rideId));
  type StopEntry = { address: string; lat: number; lng: number; fareDelta: number };
  const existing: StopEntry[] = (snap.data()?.stops ?? []) as StopEntry[];
  const newEntry = { address: opts.address, lat: opts.lat, lng: opts.lng, fareDelta: opts.newFeeAmount };
  const updatedStops = existing.length > 0
    ? [...existing.slice(0, -1), newEntry]
    : [newEntry];
  await updateDoc(doc(db, "rides", rideId), {
    stops: updatedStops,
    stopFeeTotal: increment(opts.newFeeAmount - opts.oldFeeAmount),
    pendingStop: newEntry,
  });
}

// ── Swap stop ↔ dropoff ────────────────────────────────────────────────────

export async function swapStopAndDropoff(rideId: string, opts: {
  newDropoffAddress: string;
  newDropoffLat: number;
  newDropoffLng: number;
  newStopAddress: string;
  newStopLat: number;
  newStopLng: number;
  fareDelta: number;
}): Promise<void> {
  const snap = await getDoc(doc(db, "rides", rideId));
  type StopEntry = { address: string; lat: number; lng: number; fareDelta: number };
  const existing: StopEntry[] = (snap.data()?.stops ?? []) as StopEntry[];
  const newStopEntry = { address: opts.newStopAddress, lat: opts.newStopLat, lng: opts.newStopLng, fareDelta: opts.fareDelta };
  const updatedStops = existing.length > 0
    ? [...existing.slice(0, -1), newStopEntry]
    : [newStopEntry];
  await updateDoc(doc(db, "rides", rideId), {
    dropoffAddress: opts.newDropoffAddress,
    dropoffLocation: new GeoPoint(opts.newDropoffLat, opts.newDropoffLng),
    pendingStop: newStopEntry,
    stops: updatedStops,
  });
}

// ── Fare estimate ──────────────────────────────────────────────────────────

export function estimateFare(distanceMiles: number, type: RideType = "ride"): number {
  const base = type === "food" ? 3.0 : 2.5;
  const perMile = type === "ride" ? 1.85 : 1.65;
  return Math.max(base + distanceMiles * perMile, 7);
}
