import { Timestamp } from "firebase/firestore";

export interface Ride {
  id: string;
  status: "pending" | "accepted" | "arrived" | "inProgress" | "completed" | "cancelled";
  type: "ride" | "courier" | "food";
  passengerId: string;
  passengerName: string;
  driverId: string | null;
  driverName: string;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
  driverTake: number;
  coopFee: number;
  disputed: boolean;
  chargeBlocked: boolean;
  isAdvanced: boolean;
  scheduledDate: string | null;
  requestedAt: Timestamp | null;
  acceptedAt: Timestamp | null;
  completedAt: Timestamp | null;
  earlyEnd?: boolean;
  proratedFare?: number;
  passengerRating?: number;
  driverRating?: number;
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  licensePlate?: string;
  rating: number;
  totalRides: number;
  verified?: boolean;
  suspended?: boolean;
  isOnline?: boolean;
  memberSince?: Timestamp;
}

export interface WithdrawalRequest {
  id: string;
  driverId: string;
  driverName?: string;
  amount: number;
  status: "pending" | "paid" | "rejected";
  requestedAt: Timestamp | null;
  paidAt?: Timestamp | null;
  note?: string;
}

export interface Dispute {
  id: string;
  rideId: string;
  passengerId: string;
  passengerName?: string;
  reason: string;
  details?: string;
  status?: "open" | "resolved";
  createdAt: Timestamp | null;
}
