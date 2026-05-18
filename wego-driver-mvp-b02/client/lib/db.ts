import {
  collection,
  doc,
  updateDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  Timestamp,
  GeoPoint,
  increment,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Types ──────────────────────────────────────────────────────────────────

export type RideStatus = "pending" | "accepted" | "arrived" | "inProgress" | "completed" | "cancelled";
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
  stopCount: number;
  stopFeeTotal: number;
  scheduledDate: string | null;
  scheduledHour: number | null;
  scheduledMinute: number | null;
  isAdvanced: boolean;
  requestedAt: Date | null;
  acceptedAt: Date | null;
  completedAt: Date | null;
  riderRating: number;
  driverRatingGiven: number;
}

export interface ChatMessage {
  id: string;
  rideId: string;
  senderId: string;
  senderType: "driver" | "passenger";
  text: string;
  createdAt: Date | null;
}

export interface Message {
  id: string;
  title: string;
  body: string;
  type: "notification" | "system" | "coop" | "earnings";
  read: boolean;
  createdAt: Date | null;
}

export interface EarningsEntry {
  id: string;
  driverId: string;
  rideId: string;
  amount: number;
  coopFee: number;
  gross: number;
  type: RideType;
  completedAt: Date | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
    estimatedMinutes: (data.estimatedMinutes as number) ?? 10,
    stopCount: (data.stopCount as number) ?? 0,
    stopFeeTotal: (data.stopFeeTotal as number) ?? 0,
    scheduledDate: (data.scheduledDate as string | null) ?? null,
    scheduledHour: (data.scheduledHour as number | null) ?? null,
    scheduledMinute: (data.scheduledMinute as number | null) ?? null,
    isAdvanced: (data.isAdvanced as boolean) ?? false,
    requestedAt: toDate(data.requestedAt),
    acceptedAt: toDate(data.acceptedAt),
    completedAt: toDate(data.completedAt),
    riderRating: (data.riderRating as number) ?? 4.87,
    driverRatingGiven: (data.driverRatingGiven as number) ?? 0,
  };
}

// ── Driver presence ────────────────────────────────────────────────────────

export function setDriverOnline(driverId: string, online: boolean) {
  return setDoc(doc(db, "drivers", driverId), {
    isOnline: online,
    lastSeen: serverTimestamp(),
  }, { merge: true });
}

export function updateDriverLocation(driverId: string, lat: number, lng: number) {
  return setDoc(doc(db, "drivers", driverId), {
    location: new GeoPoint(lat, lng),
    lastSeen: serverTimestamp(),
  }, { merge: true });
}

// ── Ride listeners ─────────────────────────────────────────────────────────

export function listenForPendingRides(
  callback: (rides: Ride[]) => void
): () => void {
  const q = query(
    collection(db, "rides"),
    where("status", "==", "pending"),
    where("driverId", "==", null)
  );
  return onSnapshot(q, (snap) => {
    let rides = snap.docs.map((d) => rideFromDoc(d.id, d.data() as Record<string, unknown>));
    // Filter out rides older than 30 minutes in memory to prevent ghost pings from past test sessions
    const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
    rides = rides.filter(r => (r.requestedAt?.getTime() ?? 0) > thirtyMinsAgo);
    rides.sort((a, b) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0));
    rides = rides.slice(0, 5);
    callback(rides);
  }, (err) => console.error("Error in listenForPendingRides:", err));
}

export function listenToDriverRide(
  driverId: string,
  callback: (ride: Ride | null) => void
): () => void {
  const q = query(
    collection(db, "rides"),
    where("driverId", "==", driverId),
    where("status", "in", ["accepted", "arrived", "inProgress"]),
    limit(1)
  );
  return onSnapshot(q, (snap) => {
    if (snap.empty) {
      callback(null);
    } else {
      const d = snap.docs[0];
      callback(rideFromDoc(d.id, d.data() as Record<string, unknown>));
    }
  });
}

export async function acceptRide(rideId: string, driverId: string, driverMetadata: { name: string; rating: number; car: string; plate: string; }) {
  const rideRef = doc(db, "rides", rideId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(rideRef);
    if (!snap.exists()) throw new Error("Ride no longer exists.");
    const data = snap.data();
    if (data.status !== "pending" || data.driverId !== null) {
      throw new Error("Ride already accepted by another driver.");
    }
    tx.update(rideRef, {
      driverId,
      driverName: driverMetadata.name,
      driverRating: driverMetadata.rating,
      driverCar: driverMetadata.car,
      driverPlate: driverMetadata.plate,
      status: "accepted",
      acceptedAt: serverTimestamp(),
    });
  });
}

export async function updateRideStatus(rideId: string, status: RideStatus) {
  const updates: Record<string, any> = { status };
  if (status === "inProgress") updates.startedAt = serverTimestamp();
  if (status === "completed") updates.completedAt = serverTimestamp();
  await updateDoc(doc(db, "rides", rideId), updates);
}

export async function startRide(rideId: string) {
  await updateRideStatus(rideId, "inProgress");
}

export async function completeRide(rideId: string) {
  await updateRideStatus(rideId, "completed");
}

export async function submitRating(rideId: string, rating: number, raterType: "passenger" | "driver"): Promise<void> {
  const field = raterType === "driver" ? "driverRatingGiven" : "passengerRatingGiven";
  try {
    await updateDoc(doc(db, "rides", rideId), { [field]: rating });
  } catch (err) {
    console.error("submitRating failed:", err);
  }
}

// ── Messages ───────────────────────────────────────────────────────────────

export function listenToMessages(
  driverId: string,
  callback: (messages: Message[]) => void
): () => void {
  const q = query(
    collection(db, "messages"),
    where("userId", "==", driverId)
  );
  return onSnapshot(q, (snap) => {
    let msgs = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        title: (data.title as string) ?? "",
        body: (data.body as string) ?? "",
        type: (data.type as Message["type"]) ?? "notification",
        read: (data.read as boolean) ?? false,
        createdAt: toDate(data.createdAt),
      };
    });
    msgs.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    msgs = msgs.slice(0, 20);
    callback(msgs);
  }, (err) => console.error("Error in listenToMessages:", err));
}

export function markMessageRead(messageId: string) {
  return updateDoc(doc(db, "messages", messageId), { read: true });
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
    let msgs = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        rideId: data.rideId,
        senderId: data.senderId,
        senderType: data.senderType,
        text: data.text,
        createdAt: toDate(data.createdAt)
      } as ChatMessage;
    });
    // Sort ascending so latest is at the bottom
    msgs.sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
    callback(msgs);
  }, (err) => console.error("Error in listenToRideMessages:", err));
}

// ── Earnings ───────────────────────────────────────────────────────────────

export function listenToWeeklyEarnings(
  driverId: string,
  callback: (entries: EarningsEntry[]) => void
): () => void {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const q = query(
    collection(db, "earnings"),
    where("driverId", "==", driverId)
  );
  return onSnapshot(q, (snap) => {
    let entries = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        driverId: (data.driverId as string) ?? "",
        rideId: (data.rideId as string) ?? "",
        amount: (data.amount as number) ?? 0,
        coopFee: (data.coopFee as number) ?? 0,
        gross: (data.gross as number) ?? 0,
        type: (data.type as RideType) ?? "ride",
        completedAt: toDate(data.completedAt),
      };
    });
    
    entries = entries.filter(e => e.completedAt && e.completedAt >= weekAgo);
    entries.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
    
    callback(entries);
  }, (err) => {
    console.error("Error in listenToWeeklyEarnings:", err);
    callback([]); // Call with empty so UI finishes loading state
  });
}

export function listenToCompletedRides(
  driverId: string,
  callback: (rides: Ride[]) => void
): () => void {
  const q = query(
    collection(db, "rides"),
    where("driverId", "==", driverId),
    where("status", "==", "completed")
  );
  return onSnapshot(q, (snap) => {
    let rides = snap.docs.map((d) => rideFromDoc(d.id, d.data() as Record<string, unknown>));
    rides.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
    rides = rides.slice(0, 50);
    callback(rides);
  }, (err) => console.error("Error in listenToCompletedRides:", err));
}

export function listenToReservedRides(
  callback: (rides: Ride[]) => void
): () => void {
  const q = query(
    collection(db, "rides"),
    where("status", "==", "reserved"),
    where("driverId", "==", null)
  );
  return onSnapshot(q, (snap) => {
    const rides = snap.docs.map((d) => rideFromDoc(d.id, d.data() as Record<string, unknown>));
    rides.sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""));
    callback(rides);
  }, (err) => {
    console.error("listenToReservedRides:", err);
    callback([]);
  });
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

// ── Ride request (passenger side, used for testing) ────────────────────────

export async function requestRide(opts: {
  passengerId: string;
  passengerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
  type?: RideType;
}) {
  const coopFee = opts.fare * 0.12;
  const driverTake = opts.fare - coopFee;
  return addDoc(collection(db, "rides"), {
    status: "pending",
    type: opts.type ?? "ride",
    passengerId: opts.passengerId,
    passengerName: opts.passengerName,
    driverId: null,
    pickupAddress: opts.pickupAddress,
    dropoffAddress: opts.dropoffAddress,
    fare: opts.fare,
    driverTake,
    coopFee,
    estimatedMinutes: 8,
    requestedAt: serverTimestamp(),
    acceptedAt: null,
    completedAt: null,
    riderRating: 4.87,
  });
}
