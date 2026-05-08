# Firebase Setup Guide — WeGo Apps

Follow these steps once. Takes about 20 minutes.

---

## Step 1 — Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click **Add project**
3. Name it: `wego-app` (or any name)
4. Disable Google Analytics (not needed yet)
5. Click **Create project**

---

## Step 2 — Enable Authentication

1. In your Firebase project, click **Authentication** in the left sidebar
2. Click **Get started**
3. Under **Sign-in method**, enable **Email/Password**
4. Save

---

## Step 3 — Create Firestore Database

1. Click **Firestore Database** in the left sidebar
2. Click **Create database**
3. Choose **Start in test mode** (you'll secure it properly below)
4. Choose a region closest to your users (e.g., `us-west1` for Bay Area)
5. Click **Done**

---

## Step 4 — Get Your Config Keys

1. Click the gear icon ⚙️ → **Project settings**
2. Scroll down to **Your apps**
3. Click **Add app** → choose **Web** (</>)
4. Register the app with any nickname
5. Copy the `firebaseConfig` object — you'll need these values:

```
apiKey: "..."
authDomain: "..."
projectId: "..."
storageBucket: "..."
messagingSenderId: "..."
appId: "..."
```

---

## Step 5 — Add Keys to Both Apps

**Driver app** — create `wego-driver-mvp-b02/.env`:
```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

**Passenger app** — create `wego-passenger-mvp/.env` with the same values.

> Both apps share one Firebase project. Drivers go in the `drivers` collection, passengers go in `passengers`.

---

## Step 6 — Set Firestore Security Rules

In Firebase Console → Firestore → **Rules**, paste this and click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Drivers can read/write their own profile
    match /drivers/{driverId} {
      allow read, write: if request.auth != null && request.auth.uid == driverId;
    }

    // Passengers can read/write their own profile
    match /passengers/{passengerId} {
      allow read, write: if request.auth != null && request.auth.uid == passengerId;
    }

    // Rides — driver or passenger involved can read/write
    match /rides/{rideId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.passengerId == request.auth.uid;
      allow update: if request.auth != null
        && (resource.data.passengerId == request.auth.uid
          || resource.data.driverId == request.auth.uid
          || resource.data.driverId == null);
    }

    // Messages — user can only read their own
    match /messages/{messageId} {
      allow read, write: if request.auth != null
        && resource.data.userId == request.auth.uid;
    }

    // Earnings — driver can only read their own
    match /earnings/{entryId} {
      allow read: if request.auth != null
        && resource.data.driverId == request.auth.uid;
      allow write: if false; // only written by backend/admin
    }
  }
}
```

---

## Step 7 — Run Both Apps

```bash
# Driver app
cd wego-driver-mvp-b02
pnpm dev

# Passenger app (separate terminal)
cd wego-passenger-mvp
pnpm dev
```

Open driver app at http://localhost:5173 — you'll see the login screen.
Create an account → you're in.

---

## What's Wired Up

| Feature | Status |
|---|---|
| Email/password login + signup | ✅ Ready |
| Password reset via email | ✅ Ready |
| Driver profile in Firestore | ✅ Ready |
| Passenger profile in Firestore | ✅ Ready |
| Protected routes (login required) | ✅ Ready |
| Real-time pending ride listener | ✅ Ready |
| Accept / start / complete ride | ✅ Ready |
| GPS location tracking while online | ✅ Ready |
| Real-time message inbox | ✅ Ready |
| Weekly earnings listener | ✅ Ready |
| Error boundaries (no more crashes) | ✅ Ready |
| Ride request from passenger app | ✅ Ready |

## What Needs Firebase Account Before Working

- Login / Signup screens
- Real-time dispatch
- All Firestore data

## What Still Uses Mock Data (Phase 2)

- Earnings page numbers (hardcoded $3,024 etc.)
- Governance votes
- Legacy pension projections
- Scheduled rides list

These will connect to Firestore in Phase 2 once you have real ride data.

---

## Next Steps After Setup

1. Create your first driver account in the driver app
2. Create a passenger account in the passenger app
3. Request a test ride from passenger app
4. Accept it from driver app — watch real-time dispatch work
5. Complete the ride — earnings flow to Firestore

Once Firebase is connected, total cost at 0 users = **$0/month**.
Firebase free tier covers: 50K reads/day, 20K writes/day, 1GB storage.
That's enough for a full pilot with 100 drivers.
