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
  pendingStop: { id?: string; address: string; lat: number; lng: number; fareDelta: number } | null;
  stops: Array<{ address: string; lat: number; lng: number; fareDelta: number }>;
  pin: string | null;
  pinRequired: boolean;
  scheduledDate: string | null;
  scheduledHour: number | null;
  scheduledMinute: number | null;
  isAdvanced: boolean;
  requestedAt: Date | null;
  acceptedAt: Date | null;
  completedAt: Date | null;
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
  rideId?: string;
  fromName?: string;
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

export interface Opportunity {
  id: string;
  title: string;
  detail: string;
  bonus: string;
  tag: string;
  iconName: string;
  active: boolean;
  lat?: number;
  lng?: number;
  radiusM?: number;
}

export interface DriverGoal {
  weeklyGoal: number;
  bonusAmount: number;
}

export interface BankAccount {
  holderName: string;
  bankName: string;
  accountType: "checking" | "savings";
  routingNumberLast4: string;
  accountNumberLast4: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
    pickupAddress: (data.pickupAddress as string) ?? "",
    dropoffAddress: ((data.dropoffAddress as string) ?? "").replace(/\s*\([+-]?\d+\.\d+,\s*[+-]?\d+\.\d+\)\s*$/, "").trim(),
    pickupLocation: (data.pickupLocation as GeoPoint | null) ?? null,
    dropoffLocation: (data.dropoffLocation as GeoPoint | null) ?? null,
    fare: (data.fare as number) ?? 0,
    driverTake: (data.driverTake as number) ?? 0,
    coopFee: (data.coopFee as number) ?? 0,
    estimatedMinutes: (data.estimatedMinutes as number) ?? 10,
    stopCount: (data.stopCount as number) ?? 0,
    stopFeeTotal: (data.stopFeeTotal as number) ?? 0,
    pendingStop: (data.pendingStop as { id?: string; address: string; lat: number; lng: number; fareDelta: number } | null) ?? null,
    stops: (data.stops as Array<{ address: string; lat: number; lng: number; fareDelta: number }>) ?? [],
    pin: (data.pin as string | null) ?? null,
    pinRequired: (data.pinRequired as boolean) ?? false,
    scheduledDate: (data.scheduledDate as string | null) ?? null,
    scheduledHour: (data.scheduledHour as number | null) ?? null,
    scheduledMinute: (data.scheduledMinute as number | null) ?? null,
    isAdvanced: (data.isAdvanced as boolean) ?? false,
    requestedAt: toDate(data.requestedAt),
    acceptedAt: toDate(data.acceptedAt),
    completedAt: toDate(data.completedAt),
    riderRating: (data.riderRating as number) ?? 5.0,
    passengerRatingGiven: (data.passengerRatingGiven as number) ?? 0,
    driverRatingGiven: (data.driverRatingGiven as number) ?? 0,
    disputed: (data.disputed as boolean) ?? false,
    disputeReason: (data.disputeReason as string | null) ?? null,
    disputedAt: toDate(data.disputedAt),
    chargeBlocked: (data.chargeBlocked as boolean) ?? false,
    driverAlertSeenAt: toDate(data.driverAlertSeenAt),
    earlyEnd: (data.earlyEnd as boolean | undefined) ?? undefined,
    proratedFare: (data.proratedFare as number | undefined) ?? undefined,
  };
}

// ── Driver presence ────────────────────────────────────────────────────────

export function setDriverOnline(driverId: string, online: boolean) {
  return setDoc(doc(db, "drivers", driverId), {
    isOnline: online,
    lastSeen: serverTimestamp(),
  }, { merge: true });
}

export function updateDriverPreferences(
  driverId: string,
  prefs: { acceptRides?: boolean; acceptCourier?: boolean; acceptFood?: boolean; acceptPets?: boolean }
) {
  return setDoc(doc(db, "drivers", driverId), prefs, { merge: true });
}

export async function getDriverPreferences(driverId: string) {
  const { getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(db, "drivers", driverId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    acceptRides:   (data.acceptRides   as boolean) ?? true,
    acceptCourier: (data.acceptCourier as boolean) ?? false,
    acceptFood:    (data.acceptFood    as boolean) ?? false,
    acceptPets:    (data.acceptPets    as boolean) ?? false,
  };
}

export function updateDriverLocation(driverId: string, lat: number, lng: number) {
  return setDoc(doc(db, "drivers", driverId), {
    location: new GeoPoint(lat, lng),
    lastSeen: serverTimestamp(),
  }, { merge: true });
}

// ── Ride listeners ─────────────────────────────────────────────────────────

export function listenForPendingRides(
  callback: (rides: Ride[]) => void,
  onError?: (err: Error) => void
): () => void {
  // Two equality conditions — Firestore serves these from single-field indexes
  // (no composite index needed for pure == chains). Adding driverId==null makes
  // the query satisfy the security rule statically, which prevents the entire
  // listener from being rejected when old/dirty test docs exist with driverId set.
  const q = query(
    collection(db, "rides"),
    where("status", "==", "pending"),
    where("driverId", "==", null)
  );
  return onSnapshot(q, (snap) => {
    let rides = snap.docs.map((d) => rideFromDoc(d.id, d.data() as Record<string, unknown>));
    // Drop ghost pings from old test sessions. Use Date.now() fallback so a brand-new
    // ride whose serverTimestamp hasn't resolved yet isn't accidentally excluded.
    const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
    rides = rides.filter(r => (r.requestedAt?.getTime() ?? Date.now()) > thirtyMinsAgo);
    rides.sort((a, b) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0));
    rides = rides.slice(0, 5);
    callback(rides);
  }, (err) => { console.error("Error in listenForPendingRides:", err); onError?.(err); });
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
  if (status === "cancelled") updates.cancelledAt = serverTimestamp();
  await updateDoc(doc(db, "rides", rideId), updates);
}

export async function acknowledgeRideDispute(rideId: string) {
  await updateDoc(doc(db, "rides", rideId), {
    driverAlertSeenAt: serverTimestamp(),
  });
}

export async function startRide(rideId: string) {
  await updateRideStatus(rideId, "inProgress");
}

export async function completeRide(rideId: string) {
  await updateRideStatus(rideId, "completed");
}

export async function endRideEarly(rideId: string, proratedFare: number) {
  const coopFee = parseFloat((proratedFare * 0.12).toFixed(2));
  const driverTake = parseFloat((proratedFare - coopFee).toFixed(2));
  await updateDoc(doc(db, "rides", rideId), {
    status: "completed",
    earlyEnd: true,
    proratedFare,
    fare: proratedFare,
    driverTake,
    coopFee,
    completedAt: serverTimestamp(),
  });
}

export async function submitRating(rideId: string, rating: number, raterType: "passenger" | "driver"): Promise<void> {
  const field = raterType === "driver" ? "driverRatingGiven" : "passengerRatingGiven";
  await updateDoc(doc(db, "rides", rideId), { [field]: rating });
}

// ── Messages ───────────────────────────────────────────────────────────────

export function listenToMessages(
  driverId: string,
  callback: (messages: Message[]) => void
): () => void {
  const q = query(
    collection(db, "messages"),
    where("driverId", "==", driverId)
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
        rideId: (data.rideId as string) ?? undefined,
        fromName: (data.fromName as string) ?? undefined,
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

export async function markAllMessagesRead(messageIds: string[]): Promise<void> {
  await Promise.all(messageIds.map((id) => markMessageRead(id).catch(() => {})));
}

export async function submitGovernanceVote(
  driverId: string,
  initiativeId: string,
  choice: "approve" | "reject"
): Promise<void> {
  await setDoc(doc(db, "governance_votes", `${initiativeId}_${driverId}`), {
    driverId,
    initiativeId,
    choice,
    votedAt: serverTimestamp(),
  });
}

export function listenToGovernanceVotes(
  driverId: string,
  callback: (votes: Record<string, "approve" | "reject">) => void
): () => void {
  const q = query(collection(db, "governance_votes"), where("driverId", "==", driverId));
  return onSnapshot(q, (snap) => {
    const votes: Record<string, "approve" | "reject"> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      votes[data.initiativeId as string] = data.choice as "approve" | "reject";
    });
    callback(votes);
  }, (err) => {
    console.error("Error in listenToGovernanceVotes:", err);
    callback({});
  });
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
  weekAgo.setHours(0, 0, 0, 0);

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

export function listenToPendingJobsByType(
  type: "food" | "courier",
  callback: (rides: Ride[]) => void
): () => void {
  // Use single compound (status + type) — both are non-null equality filters
  // so Firestore can satisfy this with auto-created single-field indexes.
  // driverId==null check is done in memory to avoid needing a 3-field composite index.
  const q = query(
    collection(db, "rides"),
    where("status", "==", "pending"),
    where("type", "==", type)
  );
  return onSnapshot(q, (snap) => {
    let rides = snap.docs.map((d) => rideFromDoc(d.id, d.data() as Record<string, unknown>));
    rides = rides.filter(r => r.driverId === null);
    rides.sort((a, b) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0));
    callback(rides);
  }, (err) => {
    console.error(`listenToPendingJobsByType(${type}):`, err);
    callback([]);
  });
}

export async function logStop(rideId: string, feeAmount: number): Promise<void> {
  await updateDoc(doc(db, "rides", rideId), {
    stopCount: increment(1),
    stopFeeTotal: increment(feeAmount),
  });
}

export async function acknowledgeStop(rideId: string): Promise<void> {
  await updateDoc(doc(db, "rides", rideId), { pendingStop: null });
}

export async function logEarningsEntry(opts: {
  driverId: string;
  rideId: string;
  gross: number;
  coopFee: number;
  type: RideType;
}): Promise<void> {
  await addDoc(collection(db, "earnings"), {
    driverId: opts.driverId,
    rideId: opts.rideId,
    gross: opts.gross,
    coopFee: opts.coopFee,
    amount: Math.round((opts.gross - opts.coopFee) * 100) / 100,
    type: opts.type,
    completedAt: serverTimestamp(),
  });
}

export function listenToDriverFleetShare(
  driverId: string,
  callback: (fleetShare: number) => void
): () => void {
  const q = query(collection(db, "earnings"), where("driverId", "==", driverId));
  return onSnapshot(q, (snap) => {
    let total = 0;
    snap.docs.forEach((d) => {
      const fee = (d.data().coopFee as number) ?? 0;
      total += fee * 0.5;
    });
    callback(Math.round(total * 100) / 100);
  }, (err) => {
    console.error("Error in listenToDriverFleetShare:", err);
    callback(0);
  });
}

export async function incrementDriverRideCount(driverId: string): Promise<void> {
  await updateDoc(doc(db, "drivers", driverId), { totalRides: increment(1) });
}

export function listenToFleetReserve(
  callback: (totalReserve: number) => void
): () => void {
  return onSnapshot(collection(db, "earnings"), (snap) => {
    let total = 0;
    snap.docs.forEach((d) => {
      const fee = (d.data().coopFee as number) ?? 0;
      total += fee * 0.5; // 50% of the 12% coop fee goes to hardware reserve
    });
    callback(Math.round(total * 100) / 100);
  }, (err) => {
    console.error("Error in listenToFleetReserve:", err);
    callback(0);
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
    riderRating: 5.0,
  });
}

// ── Driver dashboard data ──────────────────────────────────────────────────

export function listenToOpportunities(
  callback: (opps: Opportunity[]) => void
): () => void {
  const q = query(
    collection(db, "opportunities"),
    where("active", "==", true)
  );
  return onSnapshot(q, (snap) => {
    const opps = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title:    (data.title    as string) ?? "",
        detail:   (data.detail   as string) ?? "",
        bonus:    (data.bonus    as string) ?? "",
        tag:      (data.tag      as string) ?? "",
        iconName: (data.iconName as string) ?? "Plane",
        active:   (data.active   as boolean) ?? true,
        lat:      data.lat  as number | undefined,
        lng:      data.lng  as number | undefined,
        radiusM:  data.radiusM as number | undefined,
      } satisfies Opportunity;
    });
    callback(opps);
  }, () => callback([]));
}

export type RoadIssueType = "closure" | "accident" | "traffic" | "hazard" | "pothole" | "other";

export async function reportRoadIssue(opts: {
  driverId: string;
  type: RoadIssueType;
  lat: number;
  lng: number;
}): Promise<void> {
  await addDoc(collection(db, "roadReports"), {
    driverId: opts.driverId,
    type: opts.type,
    location: new GeoPoint(opts.lat, opts.lng),
    createdAt: serverTimestamp(),
  });
}

export async function saveBankAccount(
  driverId: string,
  data: { holderName: string; bankName: string; accountType: "checking" | "savings"; routingNumber: string; accountNumber: string }
): Promise<void> {
  await setDoc(doc(db, "drivers", driverId), {
    payoutAccount: {
      holderName: data.holderName,
      bankName: data.bankName,
      accountType: data.accountType,
      routingNumberLast4: data.routingNumber.slice(-4),
      accountNumberLast4: data.accountNumber.slice(-4),
      updatedAt: serverTimestamp(),
    },
  }, { merge: true });
}

export async function getBankAccount(driverId: string): Promise<BankAccount | null> {
  const { getDoc: gd } = await import("firebase/firestore");
  const snap = await gd(doc(db, "drivers", driverId));
  if (!snap.exists()) return null;
  const pa = snap.data()?.payoutAccount;
  if (!pa) return null;
  return {
    holderName: (pa.holderName as string) ?? "",
    bankName: (pa.bankName as string) ?? "",
    accountType: (pa.accountType as "checking" | "savings") ?? "checking",
    routingNumberLast4: (pa.routingNumberLast4 as string) ?? "",
    accountNumberLast4: (pa.accountNumberLast4 as string) ?? "",
  };
}

export async function requestWithdrawal(driverId: string, amount: number): Promise<void> {
  await addDoc(collection(db, "withdrawalRequests"), {
    driverId,
    amount,
    status: "pending",
    requestedAt: serverTimestamp(),
  });
}

export async function getDriverGoal(driverId: string): Promise<DriverGoal> {
  const { getDoc: gd } = await import("firebase/firestore");
  const snap = await gd(doc(db, "drivers", driverId));
  if (snap.exists()) {
    const data = snap.data();
    return {
      weeklyGoal:   (data.weeklyGoal   as number) ?? 20,
      bonusAmount:  (data.bonusAmount  as number) ?? 25,
    };
  }
  return { weeklyGoal: 20, bonusAmount: 25 };
}
