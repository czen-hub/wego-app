import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export type RideStatus = "pending" | "accepted" | "inProgress" | "completed" | "cancelled";
export type RideType = "ride" | "courier" | "food";

export interface Ride {
  id: string;
  status: RideStatus;
  type: RideType;
  passengerId: string;
  driverId: string | null;
  driverName: string;
  driverRating: number;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
  estimatedMinutes: number;
  requestedAt: Date | null;
  acceptedAt: Date | null;
  completedAt: Date | null;
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
    driverId: (data.driverId as string | null) ?? null,
    driverName: (data.driverName as string) ?? "",
    driverRating: (data.driverRating as number) ?? 5.0,
    pickupAddress: (data.pickupAddress as string) ?? "",
    dropoffAddress: (data.dropoffAddress as string) ?? "",
    fare: (data.fare as number) ?? 0,
    estimatedMinutes: (data.estimatedMinutes as number) ?? 10,
    requestedAt: toDate(data.requestedAt),
    acceptedAt: toDate(data.acceptedAt),
    completedAt: toDate(data.completedAt),
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
}) {
  const coopFee = opts.fare * 0.12;
  const driverTake = opts.fare - coopFee;
  return addDoc(collection(db, "rides"), {
    status: "pending",
    type: opts.type ?? "ride",
    passengerId: opts.passengerId,
    passengerName: opts.passengerName,
    driverId: null,
    driverName: "",
    driverRating: 5.0,
    pickupAddress: opts.pickupAddress,
    dropoffAddress: opts.dropoffAddress,
    fare: opts.fare,
    driverTake,
    coopFee,
    estimatedMinutes: 8,
    requestedAt: serverTimestamp(),
    acceptedAt: null,
    completedAt: null,
  });
}

// ── Cancel a ride ──────────────────────────────────────────────────────────

export async function cancelRide(rideId: string) {
  await updateDoc(doc(db, "rides", rideId), {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
  });
}

// ── Listen to active ride ──────────────────────────────────────────────────

export function listenToPassengerRide(
  passengerId: string,
  callback: (ride: Ride | null) => void
): () => void {
  const q = query(
    collection(db, "rides"),
    where("passengerId", "==", passengerId),
    where("status", "in", ["pending", "accepted", "inProgress"]),
    orderBy("requestedAt", "desc"),
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

// ── Ride history ───────────────────────────────────────────────────────────

export function listenToRideHistory(
  passengerId: string,
  callback: (rides: Ride[]) => void
): () => void {
  const q = query(
    collection(db, "rides"),
    where("passengerId", "==", passengerId),
    where("status", "==", "completed"),
    orderBy("completedAt", "desc"),
    limit(20)
  );
  return onSnapshot(q, (snap) => {
    const rides = snap.docs.map((d) => rideFromDoc(d.id, d.data() as Record<string, unknown>));
    callback(rides);
  });
}

// ── Fare estimate ──────────────────────────────────────────────────────────

export function estimateFare(distanceMiles: number, type: RideType = "ride"): number {
  const base = type === "food" ? 3.0 : 2.5;
  const perMile = type === "ride" ? 1.85 : 1.65;
  return Math.max(base + distanceMiles * perMile, 7);
}
