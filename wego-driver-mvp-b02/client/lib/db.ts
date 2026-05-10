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
} from "firebase/firestore";
import { db } from "./firebase";

// ── Types ──────────────────────────────────────────────────────────────────

export type RideStatus = "pending" | "accepted" | "inProgress" | "completed" | "cancelled";
export type RideType = "ride" | "courier" | "food";

export interface Ride {
  id: string;
  status: RideStatus;
  type: RideType;
  passengerId: string;
  passengerName: string;
  driverId: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLocation: GeoPoint | null;
  dropoffLocation: GeoPoint | null;
  fare: number;
  driverTake: number;
  coopFee: number;
  estimatedMinutes: number;
  requestedAt: Date | null;
  acceptedAt: Date | null;
  completedAt: Date | null;
  riderRating: number;
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
    pickupAddress: (data.pickupAddress as string) ?? "",
    dropoffAddress: (data.dropoffAddress as string) ?? "",
    pickupLocation: (data.pickupLocation as GeoPoint | null) ?? null,
    dropoffLocation: (data.dropoffLocation as GeoPoint | null) ?? null,
    fare: (data.fare as number) ?? 0,
    driverTake: (data.driverTake as number) ?? 0,
    coopFee: (data.coopFee as number) ?? 0,
    estimatedMinutes: (data.estimatedMinutes as number) ?? 10,
    requestedAt: toDate(data.requestedAt),
    acceptedAt: toDate(data.acceptedAt),
    completedAt: toDate(data.completedAt),
    riderRating: (data.riderRating as number) ?? 4.87,
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
    where("driverId", "==", null),
    orderBy("requestedAt", "desc"),
    limit(5)
  );
  return onSnapshot(q, (snap) => {
    const rides = snap.docs.map((d) => rideFromDoc(d.id, d.data() as Record<string, unknown>));
    callback(rides);
  });
}

export function listenToDriverRide(
  driverId: string,
  callback: (ride: Ride | null) => void
): () => void {
  const q = query(
    collection(db, "rides"),
    where("driverId", "==", driverId),
    where("status", "in", ["accepted", "inProgress"]),
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

export async function acceptRide(rideId: string, driverId: string) {
  await updateDoc(doc(db, "rides", rideId), {
    driverId,
    status: "accepted",
    acceptedAt: serverTimestamp(),
  });
}

export async function startRide(rideId: string) {
  await updateDoc(doc(db, "rides", rideId), {
    status: "inProgress",
    startedAt: serverTimestamp(),
  });
}

export async function completeRide(rideId: string) {
  await updateDoc(doc(db, "rides", rideId), {
    status: "completed",
    completedAt: serverTimestamp(),
  });
}

// ── Messages ───────────────────────────────────────────────────────────────

export function listenToMessages(
  driverId: string,
  callback: (messages: Message[]) => void
): () => void {
  const q = query(
    collection(db, "messages"),
    where("userId", "==", driverId),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => {
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
    callback(msgs);
  });
}

export function markMessageRead(messageId: string) {
  return updateDoc(doc(db, "messages", messageId), { read: true });
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
    where("driverId", "==", driverId),
    where("completedAt", ">=", Timestamp.fromDate(weekAgo)),
    orderBy("completedAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map((d) => {
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
    callback(entries);
  });
}

export function listenToCompletedRides(
  driverId: string,
  callback: (rides: Ride[]) => void
): () => void {
  const q = query(
    collection(db, "rides"),
    where("driverId", "==", driverId),
    where("status", "==", "completed"),
    orderBy("completedAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const rides = snap.docs.map((d) => rideFromDoc(d.id, d.data() as Record<string, unknown>));
    callback(rides);
  });
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
