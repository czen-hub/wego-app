import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  getDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  GeoPoint,
  increment,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";

export type RideStatus = "pending" | "accepted" | "arrived" | "inProgress" | "completed" | "cancelled" | "reserved";
export type RideType = "ride" | "courier" | "food";
export type RoadIssueType = "closure" | "accident" | "traffic" | "hazard" | "pothole" | "other";

export async function reportRoadIssue(opts: {
  userId: string;
  type: RoadIssueType;
  lat: number;
  lng: number;
}): Promise<void> {
  await addDoc(collection(db, "roadReports"), {
    userId: opts.userId,
    type: opts.type,
    location: new GeoPoint(opts.lat, opts.lng),
    createdAt: serverTimestamp(),
  });
}

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
  pendingStop: { id?: string; address: string; lat: number; lng: number; fareDelta: number } | null;
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
  earlyEnd?: boolean;
  proratedFare?: number;
  tipAmount?: number;
  tipGiven?: boolean;
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
  if (ts instanceof Date) return ts;
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
    pickupAddress: ((data.pickupAddress as string) ?? "").replace(/\s*\([+-]?\d+\.\d+,\s*[+-]?\d+\.\d+\)\s*$/, "").trim(),
    dropoffAddress: ((data.dropoffAddress as string) ?? "").replace(/\s*\([+-]?\d+\.\d+,\s*[+-]?\d+\.\d+\)\s*$/, "").trim(),
    pickupLocation: (data.pickupLocation as GeoPoint | null) ?? null,
    dropoffLocation: (data.dropoffLocation as GeoPoint | null) ?? null,
    fare: (data.fare as number) ?? 0,
    driverTake: (data.driverTake as number) ?? 0,
    coopFee: (data.coopFee as number) ?? 0,
    estimatedMinutes: (data.estimatedMinutes as number) ?? 8,
    isAdvanced: (data.isAdvanced as boolean) ?? false,
    stopCount: (data.stopCount as number) ?? 0,
    stopFeeTotal: (data.stopFeeTotal as number) ?? 0,
    pendingStop: (data.pendingStop as { id?: string; address: string; lat: number; lng: number; fareDelta: number } | null) ?? null,
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
    earlyEnd: (data.earlyEnd as boolean | undefined) ?? undefined,
    proratedFare: (data.proratedFare as number | undefined) ?? undefined,
    tipAmount: (data.tipAmount as number | undefined),
    tipGiven: (data.tipGiven as boolean) ?? false,
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
  plannedStops?: Array<{ address: string; lat: number; lng: number }>;
  initialStopCount?: number;
  initialStopFeeTotal?: number;
}) {
  const coopFee = Math.round(opts.fare * 0.12 * 100) / 100;
  const driverTake = Math.round((opts.fare - coopFee) * 100) / 100;
  const pinArr = new Uint32Array(1);
  crypto.getRandomValues(pinArr);
  const pin = String(1000 + (pinArr[0] % 9000));
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
    stops: (opts.plannedStops ?? []).map(s => ({ address: s.address, lat: s.lat, lng: s.lng, fareDelta: 0 })),
    stopCount: opts.initialStopCount ?? 0,
    stopFeeTotal: opts.initialStopFeeTotal ?? 0,
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

export async function disputeRide(rideId: string, reason: string, passengerId: string): Promise<void> {
  try {
    await addDoc(collection(db, "disputes"), {
      rideId,
      passengerId,
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
  const pinArr = new Uint32Array(1);
  crypto.getRandomValues(pinArr);
  const pin = String(1000 + (pinArr[0] % 9000));
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

export async function cancelRide(rideId: string, cancellationFee?: number): Promise<void> {
  try {
    await updateDoc(doc(db, "rides", rideId), {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      ...(cancellationFee !== undefined ? {
        cancellationFee,
        fare: cancellationFee,
        driverTake: cancellationFee, // 100% to driver — no coop fee on cancellations
        coopFee: 0,
      } : {}),
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

  // When passenger rates, update the driver's rolling average rating on their profile
  if (raterType === "passenger") {
    try {
      const rideSnap = await getDoc(doc(db, "rides", rideId));
      const driverId = rideSnap.data()?.driverId as string | null;
      if (driverId) {
        const driverRef = doc(db, "drivers", driverId);
        await runTransaction(db, async (tx) => {
          const driverSnap = await tx.get(driverRef);
          const data = driverSnap.data() ?? {};
          const currentRating = (data.rating as number) ?? 5.0;
          // Default ratingCount to 10 so early ratings don't swing the average wildly
          const ratingCount = (data.ratingCount as number) ?? 10;
          const newCount = ratingCount + 1;
          const newRating = Math.round(((currentRating * ratingCount + rating) / newCount) * 100) / 100;
          tx.update(driverRef, { rating: newRating, ratingCount: newCount });
        });
      }
    } catch {
      // Non-critical — ride rating already saved, driver profile update is best-effort
    }
  }
}

// ── Listen to active ride ──────────────────────────────────────────────────

export function listenToPassengerRide(
  passengerId: string,
  callback: (ride: Ride | null) => void
): () => void {
  const q = query(
    collection(db, "rides"),
    where("passengerId", "==", passengerId),
    where("status", "in", ["pending", "accepted", "arrived", "inProgress", "reserved"])
  );
  return onSnapshot(q, (snap) => {
    let rides = snap.docs.map((d) => rideFromDoc(d.id, d.data() as Record<string, unknown>));
    rides = rides.filter(r => ["pending", "accepted", "arrived", "inProgress", "reserved"].includes(r.status));
    rides.sort((a, b) => {
      const aActive = a.status === "reserved" ? 0 : 1;
      const bActive = b.status === "reserved" ? 0 : 1;
      if (aActive !== bActive) return bActive - aActive; // active rides always beat reserved
      return (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0);
    });
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
    callback(rides.slice(0, 100));
  }, (err) => console.error("listenToRideHistory:", err));
}

// ── Ride Chat ──────────────────────────────────────────────────────────────

export async function sendRideMessage(rideId: string, senderId: string, senderType: "driver" | "passenger", text: string, driverId?: string, passengerName?: string) {
  await addDoc(collection(db, "ride_chats"), {
    rideId,
    senderId,
    senderType,
    text,
    createdAt: serverTimestamp(),
  });
  if (senderType === "passenger" && driverId) {
    await addDoc(collection(db, "messages"), {
      driverId,
      title: passengerName ? `${passengerName}` : "Passenger",
      body: text,
      type: "notification",
      rideId,
      fromName: passengerName || "Passenger",
      read: false,
      createdAt: serverTimestamp(),
    });
  }
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
  const stopId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await updateDoc(doc(db, "rides", rideId), {
    stopCount: increment(1),
    stopFeeTotal: increment(opts.feeAmount),
    pendingStop: { id: stopId, address: opts.address, lat: opts.lat, lng: opts.lng, fareDelta: opts.feeAmount },
    stops: arrayUnion({ address: opts.address, lat: opts.lat, lng: opts.lng, fareDelta: opts.feeAmount }),
  });
}

export async function updateStopDetails(rideId: string, opts: {
  oldFeeAmount: number;
  newFeeAmount: number;
  address: string;
  lat: number;
  lng: number;
  oldLat?: number;
  oldLng?: number;
}): Promise<void> {
  const snap = await getDoc(doc(db, "rides", rideId));
  type StopEntry = { address: string; lat: number; lng: number; fareDelta: number };
  const existing: StopEntry[] = (snap.data()?.stops ?? []) as StopEntry[];
  const stopId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const newEntryForArray = { address: opts.address, lat: opts.lat, lng: opts.lng, fareDelta: opts.newFeeAmount };
  const newPendingEntry = { id: stopId, ...newEntryForArray };
  let updatedStops: StopEntry[];
  if (opts.oldLat !== undefined && opts.oldLng !== undefined) {
    const matched = existing.some(s => s.lat === opts.oldLat && s.lng === opts.oldLng);
    updatedStops = matched
      ? existing.map(s => (s.lat === opts.oldLat && s.lng === opts.oldLng) ? newEntryForArray : s)
      : [...existing, newEntryForArray];
  } else {
    updatedStops = existing.length > 0 ? [...existing.slice(0, -1), newEntryForArray] : [newEntryForArray];
  }
  await updateDoc(doc(db, "rides", rideId), {
    stops: updatedStops,
    stopFeeTotal: increment(opts.newFeeAmount - opts.oldFeeAmount),
    pendingStop: newPendingEntry,
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
  currentStopLat: number;
  currentStopLng: number;
}): Promise<void> {
  const snap = await getDoc(doc(db, "rides", rideId));
  type StopEntry = { address: string; lat: number; lng: number; fareDelta: number };
  const existing: StopEntry[] = (snap.data()?.stops ?? []) as StopEntry[];
  const stopId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const newStopForArray: StopEntry = { address: opts.newStopAddress, lat: opts.newStopLat, lng: opts.newStopLng, fareDelta: opts.fareDelta };
  const newPendingEntry = { id: stopId, ...newStopForArray };
  let replaced = false;
  const updatedStops = existing.map(s => {
    if (!replaced && Math.abs(s.lat - opts.currentStopLat) < 0.00001 && Math.abs(s.lng - opts.currentStopLng) < 0.00001) {
      replaced = true;
      return newStopForArray;
    }
    return s;
  });
  if (!replaced) updatedStops.push(newStopForArray);
  await updateDoc(doc(db, "rides", rideId), {
    dropoffAddress: opts.newDropoffAddress,
    dropoffLocation: new GeoPoint(opts.newDropoffLat, opts.newDropoffLng),
    pendingStop: newPendingEntry,
    stops: updatedStops,
  });
}

// ── Fare estimate ──────────────────────────────────────────────────────────
export { estimateFare } from "./fare";

export async function incrementPassengerRideCount(passengerId: string): Promise<void> {
  try {
    await updateDoc(doc(db, "passengers", passengerId), { totalRides: increment(1) });
  } catch {}
}

export async function submitTip(rideId: string, tipAmount: number): Promise<void> {
  await updateDoc(doc(db, "rides", rideId), {
    tipAmount,
    tipGiven: true,
    driverTake: increment(tipAmount),
  });
}
