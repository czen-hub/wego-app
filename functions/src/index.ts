import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Resend } from "resend";

admin.initializeApp();
const db = admin.firestore();

// Set your Resend API key in Firebase environment config:
//   firebase functions:config:set resend.api_key="re_YOUR_KEY_HERE"
// Then deploy with: firebase deploy --only functions

function getResend(): Resend {
  const key = functions.config().resend?.api_key ?? process.env.RESEND_API_KEY ?? "";
  return new Resend(key);
}

interface RideData {
  passengerId: string;
  driverId: string | null;
  passengerName: string;
  driverName: string;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
  driverTake: number;
  coopFee: number;
  type: string;
  isAdvanced: boolean;
  completedAt: admin.firestore.Timestamp | null;
}

function passengerReceiptHtml(ride: RideData, passengerEmail: string): string {
  const date = ride.completedAt?.toDate().toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  }) ?? "—";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WeGo Receipt</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
  <!-- Header -->
  <div style="background:#2563eb;padding:28px 32px;text-align:center;">
    <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:0 0 4px;letter-spacing:1px;text-transform:uppercase;">Your Receipt</p>
    <p style="color:#ffffff;font-size:28px;font-weight:800;margin:0;">$${ride.fare.toFixed(2)}</p>
    <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:8px 0 0;">${date}</p>
  </div>
  <!-- Body -->
  <div style="padding:28px 32px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px;">Passenger</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#111827;font-size:13px;">${ride.passengerName}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px;">Driver</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#111827;font-size:13px;">${ride.driverName || "—"}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px;">Pickup</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#374151;font-size:12px;max-width:250px;">${ride.pickupAddress}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px;">Dropoff</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#374151;font-size:12px;max-width:250px;">${ride.dropoffAddress}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px;">Ride Type</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#374151;font-size:13px;">${ride.isAdvanced ? "Reserve (Scheduled)" : "On-Demand"} · ${ride.type}</td>
      </tr>
      <tr>
        <td style="padding:12px 0 0;color:#111827;font-size:15px;font-weight:700;">Total Charged</td>
        <td style="padding:12px 0 0;text-align:right;color:#2563eb;font-size:18px;font-weight:800;">$${ride.fare.toFixed(2)}</td>
      </tr>
    </table>
    <!-- Cooperative note -->
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin-top:20px;">
      <p style="margin:0;font-size:12px;color:#1e40af;line-height:1.6;">
        <strong>88% of your fare ($${ride.driverTake.toFixed(2)}) goes directly to your driver.</strong><br>
        WeGo keeps only 12% ($${ride.coopFee.toFixed(2)}) — the lowest platform fee in rideshare. Thank you for supporting a driver-owned cooperative.
      </p>
    </div>
  </div>
  <!-- Footer -->
  <div style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">Questions? Reply to this email or visit <a href="mailto:support@wego.coop" style="color:#2563eb;">support@wego.coop</a></p>
    <p style="margin:8px 0 0;font-size:10px;color:#d1d5db;">WeGo Driver Cooperative · Bay Area, CA</p>
  </div>
</div>
</body>
</html>`;
}

function driverEarningsHtml(ride: RideData): string {
  const date = ride.completedAt?.toDate().toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }) ?? "—";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WeGo Earnings</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
  <!-- Header -->
  <div style="background:#16a34a;padding:28px 32px;text-align:center;">
    <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:0 0 4px;letter-spacing:1px;text-transform:uppercase;">Your Earnings</p>
    <p style="color:#ffffff;font-size:28px;font-weight:800;margin:0;">$${ride.driverTake.toFixed(2)}</p>
    <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:8px 0 0;">${date}</p>
  </div>
  <!-- Body -->
  <div style="padding:28px 32px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px;">Passenger</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;color:#111827;font-size:13px;">${ride.passengerName}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px;">Pickup</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#374151;font-size:12px;">${ride.pickupAddress}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px;">Dropoff</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#374151;font-size:12px;">${ride.dropoffAddress}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px;">Gross Fare</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#374151;font-size:13px;">$${ride.fare.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#6b7280;font-size:13px;">WeGo Fee (12%)</td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;color:#374151;font-size:13px;">-$${ride.coopFee.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:12px 0 0;color:#111827;font-size:15px;font-weight:700;">Your Take (88%)</td>
        <td style="padding:12px 0 0;text-align:right;color:#16a34a;font-size:18px;font-weight:800;">$${ride.driverTake.toFixed(2)}</td>
      </tr>
    </table>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-top:20px;">
      <p style="margin:0;font-size:12px;color:#166534;line-height:1.6;">
        Earnings are added to your running total and paid out every Monday. View your full earnings history in the WeGo Driver app.
      </p>
    </div>
  </div>
  <div style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">Questions? Contact <a href="mailto:support@wego.coop" style="color:#2563eb;">support@wego.coop</a></p>
    <p style="margin:8px 0 0;font-size:10px;color:#d1d5db;">WeGo Driver Cooperative · Bay Area, CA</p>
  </div>
</div>
</body>
</html>`;
}

export const onRideCompleted = functions.firestore
  .document("rides/{rideId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after  = change.after.data() as RideData;

    // Only fire when status transitions to "completed"
    if (before.status === "completed" || after.status !== "completed") return null;

    const resend = getResend();
    const { passengerId, driverId, passengerName, driverName } = after;

    // Fetch passenger and driver emails in parallel
    const [passengerSnap, driverSnap] = await Promise.all([
      passengerId ? db.doc(`passengers/${passengerId}`).get() : Promise.resolve(null),
      driverId    ? db.doc(`drivers/${driverId}`).get()    : Promise.resolve(null),
    ]);

    const passengerEmail = passengerSnap?.data()?.email as string | undefined;
    const driverEmail    = driverSnap?.data()?.email    as string | undefined;

    const sends: Promise<unknown>[] = [];

    if (passengerEmail) {
      sends.push(
        resend.emails.send({
          from: "WeGo <receipts@wego.coop>",
          to: passengerEmail,
          subject: `Your WeGo receipt — $${after.fare.toFixed(2)}`,
          html: passengerReceiptHtml(after, passengerEmail),
        })
      );
    }

    if (driverEmail) {
      sends.push(
        resend.emails.send({
          from: "WeGo <receipts@wego.coop>",
          to: driverEmail,
          subject: `Ride complete — you earned $${after.driverTake.toFixed(2)}`,
          html: driverEarningsHtml(after),
        })
      );
    }

    await Promise.allSettled(sends);
    return null;
  });
