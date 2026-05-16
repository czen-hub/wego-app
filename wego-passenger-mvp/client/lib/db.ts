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
  fare: number;
  estimatedMinutes: number;
  requestedAt: Date | null;
  acceptedAt: Date | null;
  completedAt: Date | null;
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
  // Query just by passengerId to avoid missing composite index errors
  const q = query(
    collection(db, "rides"),
    where("passengerId", "==", passengerId)
  );
  return onSnapshot(q, (snap) => {
    let rides = snap.docs.map((d) => rideFromDoc(d.id, d.data() as Record<string, unknown>));
    // Filter in-memory for active states
    rides = rides.filter(r => ["pending", "accepted", "arrived", "inProgress"].includes(r.status));
    rides.sort((a, b) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0));
    
    if (rides.length === 0) {
      callback(null);
    } else {
      callback(rides[0]);
    }
  }, (err) => console.error("Error in listenToPassengerRide:", err));
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
  }, (err) => console.error("Error in listenToRideHistory:", err));
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

// ── Fare estimate ──────────────────────────────────────────────────────────

export function estimateFare(distanceMiles: number, type: RideType = "ride"): number {
  const base = type === "food" ? 3.0 : 2.5;
  const perMile = type === "ride" ? 1.85 : 1.65;
  return Math.max(base + distanceMiles * perMile, 7);
}
