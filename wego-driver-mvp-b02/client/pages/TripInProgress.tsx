import { useState, useEffect, useRef } from "react";
import { unstable_batchedUpdates } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { MapPin, CheckCircle, Clock, Navigation, Phone, MessageSquare, ChevronLeft, ChevronRight, AlertTriangle, Send, X, DollarSign, Star, ArrowUp, ArrowUpLeft, ArrowUpRight, RotateCcw, RotateCw, GitMerge, Compass, Volume2, VolumeX, Camera } from "lucide-react";
import ClientMap, { type RouteStep } from "@/components/ClientMap";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { updateRideStatus, logEarningsEntry, incrementDriverRideCount, sendRideMessage, listenToRideMessages, submitRating, acknowledgeRideDispute, acknowledgeStop, endRideEarly, reportRoadIssue, type ChatMessage, type RoadIssueType } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { haversineMeters, formatTime, calcWaitCharge } from "@/lib/trip";

type TripPhase = "to-pickup" | "waiting" | "in-progress" | "complete";

interface TripData {
  riderName: string;
  pickupLocation: string;
  dropoffLocation: string;
  riderPayment: number;
  coopFee: number;
  driverTake: number;
  estimatedTime: number;
  type?: "ride" | "courier" | "food";
  isAdvanced?: boolean;
  scheduledDate?: string | null;
  scheduledHour?: number | null;
  scheduledMinute?: number | null;
  pickupCoords?: [number, number];
  dropoffCoords?: [number, number];
  rideId?: string;
}

export default function TripInProgress() {
  const navigate = useNavigate();
  const location = useLocation();
  const trip = location.state as TripData | null;

  if (!trip) {
    navigate("/", { replace: true });
    return null;
  }

  const [phase, setPhase] = useState<TripPhase>("to-pickup");
  const [elapsed, setElapsed] = useState(0);
  const [waitElapsed, setWaitElapsed] = useState(0);
  const enRouteElapsed = useRef(0);
  const enRouteFeeRef = useRef(5.00);

  // Track en-route time and fee tier
  useEffect(() => {
    if (phase !== "to-pickup") return;
    const id = setInterval(() => {
      enRouteElapsed.current += 1;
      const mins = enRouteElapsed.current / 60;
      enRouteFeeRef.current = mins < 3 ? 5.00 : mins < 8 ? 9.00 : 14.00;
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Wait timer during waiting phase
  useEffect(() => {
    if (phase !== "waiting") return;
    const id = setInterval(() => setWaitElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const [stopEarnings, setStopEarnings] = useState(0);
  const [completedStops, setCompletedStops] = useState<Array<{ address: string; fareDelta: number }>>([]);
  const [passengerRating, setPassengerRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [autoCloseIn, setAutoCloseIn] = useState(8);
  const autoCloseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [earlyEndData, setEarlyEndData] = useState<{ proratedFare: number } | null>(null);
  const [contactWindowSecs, setContactWindowSecs] = useState(300);
  const contactWindowTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSendError, setChatSendError] = useState(false);
  const { user } = useAuth();
  const [calling, setCalling] = useState(false);
  const [passengerPhone, setPassengerPhone] = useState<string | null>(null);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);
  const [passengerCancelled, setPassengerCancelled] = useState(false);
  const [cancellationFee, setCancellationFee] = useState(0);
  const { coords: driverCoords, accuracy } = useCurrentLocation();

  const prevPhaseRef = useRef<TripPhase | null>(null);
  useEffect(() => {
    prevPhaseRef.current = phase;
  }, [phase]);
  const [ridePin, setRidePin] = useState<string | null>(null);
  const [pinRequired, setPinRequired] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinEntry, setPinEntry] = useState(["", "", "", ""]);
  const [pinError, setPinError] = useState(false);
  const [pickupIssueAlertOpen, setPickupIssueAlertOpen] = useState(false);
  const [pickupIssueAlert, setPickupIssueAlert] = useState({
    active: false,
    chargeBlocked: false,
    driverAlertSeen: false,
  });
  const [stopNotifOpen, setStopNotifOpen] = useState(false);
  const [stopNotif, setStopNotif] = useState<{ address: string; lat: number; lng: number; fareDelta: number } | null>(null);
  const [stopViaCoords, setStopViaCoords] = useState<[number, number] | null>(null);
  const lastPendingStopKeyRef = useRef<string | null>(null);
  const pinSubmittingRef = useRef(false);
  const approachNotifFiredRef = useRef(false);
  const [mapResetToken, setMapResetToken] = useState(0);
  const [headingUp, setHeadingUp] = useState(true);
  const [dropoffCoordsOverride, setDropoffCoordsOverride] = useState<[number, number] | null>(null);
  const tripNavMode = phase === "to-pickup" || phase === "in-progress";
  const [scheduledSecsRemaining, setScheduledSecsRemaining] = useState<number | null>(null);
  const lastMapMoveRef = useRef<number>(0);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [passengerCardExpanded, setPassengerCardExpanded] = useState(false);
  const [safetyAlertOpen, setSafetyAlertOpen] = useState(false);
  const hasRestoredPhaseRef = useRef(false);
  const lastDriverMoveRef = useRef<{ coords: [number, number]; time: number } | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      // Only useful during waiting phase — driver may drag the map and want auto-recenter
      if (phaseRef.current !== "waiting") return;
      const t = lastMapMoveRef.current;
      if (t > 0 && Date.now() - t >= 8000) {
        lastMapMoveRef.current = 0;
        setMapResetToken((v) => v + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Countdown clock for scheduled (advanced) pickups
  useEffect(() => {
    if (!trip.isAdvanced || trip.scheduledHour == null || trip.scheduledMinute == null) return;
    const compute = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(trip.scheduledHour!, trip.scheduledMinute!, 0, 0);
      if (target.getTime() - now.getTime() < -30 * 60 * 1000) target.setDate(target.getDate() + 1);
      return Math.round((target.getTime() - now.getTime()) / 1000);
    };
    setScheduledSecsRemaining(compute());
    const id = setInterval(() => setScheduledSecsRemaining(compute()), 1000);
    return () => clearInterval(id);
  }, [trip.isAdvanced, trip.scheduledHour, trip.scheduledMinute]);

  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem("wego_voice") !== "off");
  const voiceEnabledRef = useRef(localStorage.getItem("wego_voice") !== "off");
  const lastSpokenRef = useRef("");
  const speechUnlockedRef = useRef(false);

  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  const unlockSpeech = () => {
    if (speechUnlockedRef.current || !("speechSynthesis" in window)) return;
    speechUnlockedRef.current = true;
    // iOS requires a user-gesture to unlock the speech synthesizer
    const u = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(u);
  };

  const speak = (text: string) => {
    if (!voiceEnabledRef.current || !("speechSynthesis" in window)) return;
    if (text === lastSpokenRef.current) return;
    lastSpokenRef.current = text;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "en-US";
    utt.rate = 1.05;
    utt.volume = 1.0;
    window.speechSynthesis.speak(utt);
  };

  const [toastError, setToastError] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showError = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastError(msg);
    toastTimerRef.current = setTimeout(() => setToastError(null), 3500);
  };

  const phaseRef = useRef(phase);
  const waitElapsedRef = useRef(waitElapsed);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    waitElapsedRef.current = waitElapsed;
  }, [waitElapsed]);

  // Listen for chat messages
  useEffect(() => {
    if (!trip.rideId) return;
    const unsub = listenToRideMessages(trip.rideId, (msgs) => {
      const prev = prevMsgCountRef.current;
      prevMsgCountRef.current = msgs.length;
      setChatMessages(msgs);
      if (msgs.length > prev) {
        const hasNewPassengerMsg = msgs.slice(prev).some(m => m.senderType === "passenger");
        if (hasNewPassengerMsg) setChatOpen(true);
      }
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return unsub;
  }, [trip.rideId]);

  // Listen for passenger cancellation + read pin fields
  useEffect(() => {
    if (!trip.rideId) return;
    const unsub = onSnapshot(doc(db, "rides", trip.rideId), (docSnap) => {
      unstable_batchedUpdates(() => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      // hasPendingWrites is true when our own local write (e.g. serverTimestamp()) hasn't been
      // confirmed yet — driverAlertSeenAt will be undefined during that window, causing a false
      // re-open of the modal. Keep the previous driverAlertSeen value until the server confirms.
      const pending = docSnap.metadata.hasPendingWrites;
      setRidePin((data.pin as string | null) ?? null);
      setPinRequired((data.pinRequired as boolean) ?? false);
      // Fetch passenger phone once when passengerId becomes available
      const pId = data.passengerId as string | undefined;
      if (pId && !passengerPhone) {
        import("firebase/firestore").then(({ getDoc, doc: fsDoc }) =>
          getDoc(fsDoc(db, "passengers", pId)).then((snap) => {
            if (snap.exists()) setPassengerPhone((snap.data().phone as string) || null);
          }).catch(() => {})
        );
      }
      // Detect new passenger stop request
      const newPendingStop = data.pendingStop as { id?: string; address: string; lat: number; lng: number; fareDelta: number } | null | undefined;
      // Use unique stop ID if available (prevents same-address re-request from being missed)
      const stopKey = newPendingStop?.id ?? newPendingStop?.address ?? null;
      if (newPendingStop && stopKey !== lastPendingStopKeyRef.current) {
        lastPendingStopKeyRef.current = stopKey;
        const safeStop = { ...newPendingStop, fareDelta: Math.min(newPendingStop.fareDelta, 50.00) };
        setStopNotif(safeStop);
        if (newPendingStop.lat !== 0 || newPendingStop.lng !== 0) {
          setStopViaCoords([newPendingStop.lat, newPendingStop.lng]);
        }
        setStopNotifOpen(true);
      }
      if (!newPendingStop) {
        lastPendingStopKeyRef.current = null;
      }
      // Sync completedStops and stopEarnings from Firestore — survives driver session restarts
      const allStops = (data.stops as Array<{ address: string; lat: number; lng: number; fareDelta: number }>) ?? [];
      const ackStops = newPendingStop
        ? allStops.filter(s => !(s.lat === newPendingStop.lat && s.lng === newPendingStop.lng && s.address === newPendingStop.address))
        : allStops;
      setCompletedStops(ackStops.map(s => ({ address: s.address, fareDelta: s.fareDelta })));
      setStopEarnings(parseFloat(((data.stopFeeTotal as number) ?? 0).toFixed(2)));

      const status = data.status;
      // On first snapshot, restore phase from Firestore (handles app-resume mid-trip)
      if (!hasRestoredPhaseRef.current) {
        hasRestoredPhaseRef.current = true;
        if (status === "arrived") setPhase("waiting");
        else if (status === "inProgress") setPhase("in-progress");
      }
      const pickupIssueReported =
        (data.disputed as boolean) === true &&
        (data.disputeReason as string | null) === "passenger_not_picked_up";
      const driverAlertSeen = Boolean(data.driverAlertSeenAt);
      setPickupIssueAlert(prev => ({
        active: pickupIssueReported,
        chargeBlocked: (data.chargeBlocked as boolean) ?? false,
        driverAlertSeen: pending ? prev.driverAlertSeen : driverAlertSeen,
      }));
      if (pickupIssueReported && !driverAlertSeen && !pending) {
        setPickupIssueAlertOpen(true);
      }
      if (status === "cancelled") {
        const storedFee = data.cancellationFee as number | undefined;
        let fee = 0;
        if (storedFee !== undefined) {
          fee = storedFee;
        } else {
          const currentPhase = phaseRef.current;
          const currentWaitElapsed = waitElapsedRef.current;
          if (currentPhase === "to-pickup") {
            fee = enRouteFeeRef.current;
          } else if (currentPhase === "waiting") {
            const freeWait = trip.isAdvanced ? 480 : 300;
            const meterSecs = trip.isAdvanced ? Math.max(0, currentWaitElapsed - freeWait) : 0;
            const meterFee = parseFloat(Math.min((meterSecs / 60) * 0.50, 1.00).toFixed(2));
            fee = enRouteFeeRef.current + 3.00 + meterFee;
          }
          // in-progress cancellation fee comes from storedFee written by passenger app
        }
        setCancellationFee(fee);
        // Log cancellation earnings — 100% to driver, no coop fee
        if (fee > 0 && user && trip.rideId) {
          logEarningsEntry({ driverId: user.uid, rideId: trip.rideId, gross: fee, coopFee: 0, type: trip.type ?? "ride" }).catch(() => {});
        }
        setPassengerCancelled(true);
      }
      }); // end batchedUpdates
    });
    return unsub;
  }, [trip.rideId, trip.isAdvanced]);

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || !user || !trip.rideId) return;
    setChatInput("");
    setChatSendError(false);
    try {
      await sendRideMessage(trip.rideId, user.uid, "driver", text);
    } catch {
      setChatSendError(true);
      setChatInput(text);
    }
  };

  const handleCall = () => {
    if (passengerPhone) {
      setCalling(true);
      window.location.href = `tel:${passengerPhone}`;
      setTimeout(() => setCalling(false), 10000);
    }
  };

  const handlePassengerNoShow = () => {
    let fee = 0;
    if (phase === "to-pickup") {
      fee = enRouteFeeRef.current;
    } else if (phase === "waiting") {
      const freeWait = trip.isAdvanced ? 480 : 300;
      const meterSecs = trip.isAdvanced ? Math.max(0, waitElapsed - freeWait) : 0;
      const meterFee = parseFloat(Math.min((meterSecs / 60) * 0.50, 1.00).toFixed(2));
      fee = enRouteFeeRef.current + 3.00 + meterFee;
    }
    setCancellationFee(fee);
    setPassengerCancelled(true);
    if (trip.rideId) updateRideStatus(trip.rideId, "cancelled").catch(() => {});
  };

  // Timer during in-progress phase
  useEffect(() => {
    if (phase !== "in-progress") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const freeWaitSecs = trip.isAdvanced ? 480 : 300;
  const waitRemaining = Math.max(0, freeWaitSecs - waitElapsed);
  const meterSecs = trip.isAdvanced ? Math.max(0, waitElapsed - freeWaitSecs) : 0;
  const meterCharge = calcWaitCharge(waitElapsed, trip.isAdvanced ?? false);
  const canLeave = waitElapsed >= freeWaitSecs;

  const [currentStep, setCurrentStep] = useState<RouteStep | null>(null);
  const [allRouteSteps, setAllRouteSteps] = useState<RouteStep[]>([]);
  const [turnListOpen, setTurnListOpen] = useState(false);
  const [fitRouteToken, setFitRouteToken] = useState(0);
  const fitRouteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [navDistM, setNavDistM] = useState<number | null>(null);
  const preAnnouncedRef = useRef<string>("");
  const [speedLimit, setSpeedLimit] = useState<number | null>(null);
  const [speedMph, setSpeedMph] = useState<number | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ remainingM: number; remainingSecs: number } | null>(null);
  const [cameraWarning, setCameraWarning] = useState(false);
  const cameraWarnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueDone, setIssueDone] = useState(false);

  const stripCoords = (s: string | null | undefined) => (s ?? "").replace(/\s*\(\d+\.\d+,\s*-?\d+\.\d+\)$/, "").trim();

  const handleCameraApproach = () => {
    if (cameraWarnTimerRef.current) clearTimeout(cameraWarnTimerRef.current);
    setCameraWarning(true);
    speak("Speed camera ahead");
    cameraWarnTimerRef.current = setTimeout(() => setCameraWarning(false), 5000);
  };

  const handleRerouting = () => {
    preAnnouncedRef.current = "";
    setRerouting(true);
    setCurrentStep(null);
    setNavDistM(null);
    setSpeedLimit(null);
    setRouteInfo(null);
    speak("Recalculating route");
  };

  const handleStepChange = (step: RouteStep | null) => {
    setCurrentStep(step);
    if (step) setRerouting(false);
  };

  function fmtDist(m: number): string {
    if (m < 15) return "arriving";
    const ft = m * 3.28084;
    if (ft < 1000) return `${Math.round(ft / 100) * 100} ft`;
    const mi = m / 1609.34;
    return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
  }

  function ManeuverIcon({ type, modifier, className: cls = "text-background", size: sz = 20 }: { type: string; modifier?: string; className?: string; size?: number }) {
    if (type === "arrive") return <MapPin size={sz} className={cls} />;
    if (type === "depart") return <Navigation size={sz} className={cls} />;
    if (type === "roundabout" || type === "rotary") return <RotateCw size={sz} className={cls} />;
    if (type === "merge" || type === "fork") return <GitMerge size={sz} className={cls} />;
    if (modifier === "uturn") return <RotateCcw size={sz} className={cls} />;
    if (modifier === "left" || modifier === "sharp left" || modifier === "slight left")
      return <ArrowUpLeft size={sz} className={cls} />;
    if (modifier === "right" || modifier === "sharp right" || modifier === "slight right")
      return <ArrowUpRight size={sz} className={cls} />;
    return <ArrowUp size={sz} className={cls} />;
  }

  const isDelivery = trip.type === "courier" || trip.type === "food";
  const typeLabel = trip.type === "food" ? "Food Delivery" : trip.type === "courier" ? "Courier" : "Ride";
  const pickupLabel = trip.type === "food" ? "Restaurant" : "Pickup";
  const arrivedLabel = trip.type === "food" ? "Arrived at Restaurant" : "Arrived at Pickup";
  const completeLabel = isDelivery ? "Delivery Complete" : "Complete Trip";
  const hasPickupIssueAlert = pickupIssueAlert.active;
  const pickupIssueNeedsAcknowledgement = hasPickupIssueAlert && !pickupIssueAlert.driverAlertSeen;

  // Request notification permission when trip goes in-progress
  useEffect(() => {
    if (phase !== "in-progress") return;
    approachNotifFiredRef.current = false;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [phase]);

  // Fire a notification when driver is ~300m (~30s) from dropoff
  useEffect(() => {
    if (phase !== "in-progress" || !driverCoords || !trip?.dropoffCoords) return;
    if (approachNotifFiredRef.current) return;
    const dist = haversineMeters(driverCoords[0], driverCoords[1], trip.dropoffCoords[0], trip.dropoffCoords[1]);
    if (dist > 300) return;
    approachNotifFiredRef.current = true;
    if ("Notification" in window && Notification.permission === "granted") {
      const notif = new Notification("WeGo — Approaching Dropoff", {
        body: `Return to WeGo to complete ${trip.riderName.split(" ")[0]}'s trip.`,
        icon: "/favicon.ico",
        requireInteraction: true,
        tag: "wego-approach",
      });
      notif.onclick = () => { window.focus(); notif.close(); };
    }
  }, [driverCoords, phase, trip?.dropoffCoords]);

  // Track last GPS position to detect when driver stops moving
  useEffect(() => {
    if (!driverCoords) return;
    if (
      !lastDriverMoveRef.current ||
      haversineMeters(driverCoords[0], driverCoords[1], lastDriverMoveRef.current.coords[0], lastDriverMoveRef.current.coords[1]) > 20
    ) {
      lastDriverMoveRef.current = { coords: driverCoords, time: Date.now() };
    }
  }, [driverCoords]);

  // Safety alert: if driver hasn't moved for 3+ minutes while on an active trip
  useEffect(() => {
    if (phase !== "to-pickup" && phase !== "in-progress") return;
    const id = setInterval(() => {
      if (!lastDriverMoveRef.current || safetyAlertOpen) return;
      const idleSecs = (Date.now() - lastDriverMoveRef.current.time) / 1000;
      if (idleSecs >= 180) setSafetyAlertOpen(true);
    }, 15_000);
    return () => clearInterval(id);
  }, [phase, safetyAlertOpen]);

  // Voice guidance: announce each turn once at the right approach distance, never repeat
  useEffect(() => {
    if (!currentStep || navDistM === null) return;

    // First step after route load or reroute — announce immediately so driver knows where to go
    if (preAnnouncedRef.current === "") {
      preAnnouncedRef.current = currentStep.instruction;
      const d = currentStep.distance;
      let text = currentStep.instruction;
      if (d > 1609) text = `In ${(d / 1609.34).toFixed(1)} miles, ${currentStep.instruction}`;
      else if (d > 400) text = `In ${Math.round((d * 3.28084) / 100) * 100} feet, ${currentStep.instruction}`;
      speak(text);
      return;
    }

    // Subsequent turns: announce nextStep once when navDistM drops to threshold
    const upcoming = currentStep.nextStep;
    if (!upcoming || upcoming.instruction === preAnnouncedRef.current) return;

    // Longer segments (highway) get more lead time than short city blocks
    const threshold = currentStep.distance > 3000 ? 1200 : 600;
    if (navDistM > threshold) return;

    preAnnouncedRef.current = upcoming.instruction;
    let text = upcoming.instruction;
    if (navDistM > 1609) text = `In ${(navDistM / 1609.34).toFixed(1)} miles, ${upcoming.instruction}`;
    else if (navDistM > 150) text = `In ${Math.round((navDistM * 3.28084) / 100) * 100} feet, ${upcoming.instruction}`;
    speak(text);
  // navDistM changes every GPS tick — intentional, ref prevents re-announcing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, navDistM]);

  // Zoom in to driver's position ~4s after GPS first arrives (overrides initial fitBounds)
  // MUST be before any early returns to satisfy hooks rules
  const hasInitialCenteredRef = useRef(false);
  useEffect(() => {
    if (!driverCoords || hasInitialCenteredRef.current) return;
    hasInitialCenteredRef.current = true;
    const id = setTimeout(() => setMapResetToken((v) => v + 1), 4000);
    return () => clearTimeout(id);
  }, [driverCoords]);

  function resetAutoClose() {
    if (autoCloseTimerRef.current) clearInterval(autoCloseTimerRef.current);
    setAutoCloseIn(8);
    autoCloseTimerRef.current = setInterval(() => {
      setAutoCloseIn((n) => {
        if (n <= 1) {
          clearInterval(autoCloseTimerRef.current!);
          autoCloseTimerRef.current = null;
          navigate("/", { state: { tripCompleted: true } });
          return 10;
        }
        return n - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    if (phase !== "complete") return;
    resetAutoClose();
    setContactWindowSecs(300);
    const contactId = setInterval(() => {
      setContactWindowSecs((s) => {
        if (s <= 1) { clearInterval(contactId); return 0; }
        return s - 1;
      });
    }, 1000);
    contactWindowTimerRef.current = contactId;
    return () => {
      if (autoCloseTimerRef.current) clearInterval(autoCloseTimerRef.current);
      clearInterval(contactId);
    };
  }, [phase]);

  if (phase === "complete") {
    const earlyProratedFare = earlyEndData?.proratedFare ?? null;
    const earlyProratedCoopFee = earlyProratedFare !== null ? parseFloat((earlyProratedFare * 0.12).toFixed(2)) : 0;
    const earlyDriverTake = earlyProratedFare !== null ? parseFloat((earlyProratedFare - earlyProratedCoopFee + stopEarnings).toFixed(2)) : 0;
    return (
      <div className="relative min-h-screen bg-background flex flex-col items-center px-4 py-12 overflow-y-auto" onPointerDown={resetAutoClose}>
        <div className="max-w-md w-full space-y-6">
          {/* Success Icon */}
          <div className="flex flex-col items-center gap-3 pt-8">
            <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
              <CheckCircle size={40} className="text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">{earlyEndData ? "Ride Ended Early" : isDelivery ? "Delivery Complete" : "Trip Complete"}</h1>
            {earlyEndData && (
              <div className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-600 dark:text-amber-400">
                Prorated — passenger charged for distance covered
              </div>
            )}
            <p className="text-muted-foreground text-center">
              {earlyEndData ? "Ride ended early. Your earnings reflect the distance covered." : isDelivery ? `${typeLabel} delivered successfully.` : `Great ride, ${trip.riderName.split(" ")[0]} has been dropped off.`}
            </p>
          </div>

          {/* Earnings Card */}
          {pickupIssueAlert.chargeBlocked ? (
            <div className="glass-card p-5 border border-amber-500/30 rounded-2xl space-y-3 bg-amber-500/5">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
                <p className="text-sm font-semibold text-foreground">Payout Under Review</p>
              </div>
              <p className="text-sm text-muted-foreground">
                The passenger reported a pickup issue. Your payout of{" "}
                <span className="text-foreground font-medium">${trip.driverTake.toFixed(2)}</span> is on hold
                while the WeGo team reviews this trip.
              </p>
              <p className="text-xs text-muted-foreground bg-muted/20 border border-border rounded-lg px-3 py-2">
                You'll be notified via Messages once the review is complete. This usually takes 1–2 business days.
              </p>
            </div>
          ) : earlyProratedFare !== null ? (
            <div className="glass-card p-5 border border-amber-500/20 rounded-2xl space-y-4 bg-gradient-to-br from-amber-500/8 to-transparent">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your Earnings (Prorated)</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Passenger charged</span>
                  <span className="text-foreground font-medium">${earlyProratedFare.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">WeGo Fee (12%)</span>
                  <span className="text-destructive font-medium">-${earlyProratedCoopFee.toFixed(2)}</span>
                </div>
                {stopEarnings > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stop fees (100% yours)</span>
                    <span className="text-primary font-medium">+${stopEarnings.toFixed(2)}</span>
                  </div>
                )}
                <div className="h-px bg-border/50" />
                <div className="flex justify-between">
                  <span className="text-primary font-semibold">Your Take</span>
                  <span className="text-2xl font-bold text-primary">${earlyDriverTake.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-5 border border-primary/20 rounded-2xl space-y-4 bg-gradient-to-br from-primary/8 to-transparent">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your Earnings</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{isDelivery ? "Customer Paid" : "Rider Paid"}</span>
                  <span className="text-foreground font-medium">${trip.riderPayment.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">WeGo Fee (12%)</span>
                  <span className="text-destructive font-medium">-${trip.coopFee.toFixed(2)}</span>
                </div>
                {stopEarnings > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stop fees (100% yours)</span>
                    <span className="text-primary font-medium">+${stopEarnings.toFixed(2)}</span>
                  </div>
                )}
                <div className="h-px bg-border/50" />
                <div className="flex justify-between">
                  <span className="text-primary font-semibold">Your Take</span>
                  <span className="text-2xl font-bold text-primary">${(trip.driverTake + stopEarnings).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Trip Summary */}
          {(() => {
            const stripCoords = (s: string | null | undefined) => (s ?? "").replace(/\s*\(\d+\.\d+,\s*-?\d+\.\d+\)$/, "").trim();
            return (
              <div className="glass-card p-4 border border-border rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{isDelivery ? "Delivery Summary" : "Trip Summary"}</p>
                  <button type="button" onClick={() => setSummaryExpanded((e) => !e)} className="text-xs text-primary font-semibold">
                    {summaryExpanded ? "See less" : "See more"}
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-3 items-start">
                    <MapPin size={16} className="text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Pickup</p>
                      <p className="text-sm text-foreground">{stripCoords(trip.pickupLocation)}</p>
                    </div>
                  </div>
                  {summaryExpanded && completedStops.map((stop, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <MapPin size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Stop {i + 1}</p>
                        <p className="text-sm text-foreground">{stop.address}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 items-start">
                    <MapPin size={16} className="text-primary/60 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Dropoff</p>
                      <p className="text-sm text-foreground">{stripCoords(trip.dropoffLocation)}</p>
                    </div>
                  </div>
                  {summaryExpanded && (
                    <div className="flex gap-3 items-start">
                      <Clock size={16} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="text-sm text-foreground">{formatTime(elapsed)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Rating */}
          <div className="glass-card p-4 border border-border rounded-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {trip.riderName.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{trip.riderName}</p>
                  <p className="text-xs text-muted-foreground">{isDelivery ? "Rate this customer" : "Rate this passenger"}</p>
                </div>
              </div>
              {!ratingSubmitted ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">How was your passenger?</p>
                  <div className="flex justify-center gap-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                        onClick={() => setPassengerRating(star)}
                        className={`transition-transform active:scale-90 ${star <= passengerRating ? "text-yellow-400" : "text-muted-foreground/30"}`}
                      >
                        <Star size={32} fill={star <= passengerRating ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                  {passengerRating > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (trip.rideId) {
                          try {
                            await submitRating(trip.rideId, passengerRating, "driver");
                          } catch {
                            showError("Couldn't save rating — please try again");
                            return;
                          }
                        }
                        setRatingSubmitted(true);
                      }}
                      className="w-full py-2.5 rounded-xl bg-primary/10 border border-primary/25 text-primary font-semibold text-sm active:scale-95 transition-transform"
                    >
                      Submit Rating
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2 text-primary">
                  <CheckCircle size={16} />
                  <span className="text-sm font-semibold">Thanks for rating!</span>
                </div>
              )}
            </div>

          {/* Passenger contact window */}
          <div className="glass-card p-4 border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Passenger contact window</p>
              <span className={`text-xs font-mono font-bold ${contactWindowSecs === 0 ? "text-muted-foreground" : "text-primary"}`}>
                {contactWindowSecs === 0 ? "Expired" : `${Math.floor(contactWindowSecs / 60)}:${String(contactWindowSecs % 60).padStart(2, "0")}`}
              </span>
            </div>
            {contactWindowSecs > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (autoCloseTimerRef.current) { clearInterval(autoCloseTimerRef.current); autoCloseTimerRef.current = null; }
                  setChatOpen(true);
                }}
                className="w-full py-3 rounded-xl bg-primary/10 border border-primary/25 text-primary font-semibold text-sm active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <MessageSquare size={16} />
                Message Passenger
              </button>
            )}
            <p className="text-xs text-muted-foreground text-center">
              {contactWindowSecs === 0 ? "Contact window closed." : "Passenger may contact you about forgotten items within this window."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/", { state: { tripCompleted: true } })}
            className="w-full py-4 rounded-2xl bg-primary text-foreground font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            Back to Command
          </button>
          <p className="text-center text-xs text-muted-foreground">Closing automatically in {autoCloseIn}s · tap anywhere to reset</p>
        </div>

        {/* Post-trip chat modal */}
        {chatOpen && (
          <div className="absolute inset-0 z-50 flex flex-col justify-end items-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => { setChatOpen(false); resetAutoClose(); }} />
            <div className="relative w-full max-w-[430px] bg-card border-t border-border rounded-t-2xl flex flex-col max-h-[70vh] overflow-hidden">
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {trip.riderName.charAt(0)}
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">{trip.riderName}</p>
                </div>
                <button type="button" aria-label="Close chat" onClick={() => { setChatOpen(false); resetAutoClose(); }}
                  className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center flex-shrink-0 ml-2">
                  <X size={15} className="text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-2 min-h-[120px]">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center pt-4">No messages. Passenger may reach out about forgotten items.</p>
                )}
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`flex w-full ${msg.senderType === "driver" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] min-w-0 px-3 py-2 rounded-2xl text-sm break-words overflow-hidden ${msg.senderType === "driver" ? "bg-primary text-white" : "bg-muted/40 text-foreground border border-border"}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {chatSendError && (
                <p className="text-xs text-destructive px-4 pt-2">Failed to send — tap send to retry.</p>
              )}
              <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => { setChatInput(e.target.value); setChatSendError(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) sendMessage(); }}
                  placeholder="Message passenger…"
                  className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <button type="button" aria-label="Send message" onClick={sendMessage} disabled={!chatInput.trim()}
                  className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform">
                  <Send size={16} className="text-white" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const mapFrom = phase === "to-pickup"
    ? (driverCoords ?? undefined)
    : phase === "waiting"
    ? undefined
    : (driverCoords ?? trip.pickupCoords);
  const effectiveDropoffCoords = dropoffCoordsOverride ?? trip.dropoffCoords;
  const mapTo = phase === "to-pickup"
    ? trip.pickupCoords
    : phase === "waiting"
    ? undefined
    : effectiveDropoffCoords;
  const mapCenter: [number, number] = driverCoords ?? trip.pickupCoords ?? [37.3541, -121.9552];

  const pickupEtaMinutes = (() => {
    if (!driverCoords || !trip.pickupCoords) return trip.estimatedTime;
    const dm = haversineMeters(driverCoords[0], driverCoords[1], trip.pickupCoords[0], trip.pickupCoords[1]);
    return Math.max(1, Math.round((dm / 1609.34 / 30) * 60));
  })();
  const mapPanelClassName = "flex-1 min-h-[300px]";


  if (!trip) return null;

  return (
    <div className="relative w-full bg-background flex flex-col h-[100dvh] overflow-hidden" onPointerDown={unlockSpeech}>
      {/* Live Map */}
      <div className={`relative ${mapPanelClassName}`}>
        <ClientMap
          from={mapFrom}
          to={mapTo}
          via={phase === "in-progress" ? (stopViaCoords ?? undefined) : undefined}
          driverPos={driverCoords ?? undefined}
          accuracy={accuracy ?? undefined}
          center={mapCenter}
          zoom={15}
          className="absolute inset-0"
          interactive
          forceResetToken={mapResetToken}
          followBearing={headingUp}
          navMode={tripNavMode}
          onCenterChange={() => { lastMapMoveRef.current = Date.now(); }}
          onStepChange={phase === "waiting" ? undefined : handleStepChange}
          onAllStepsChange={phase === "waiting" ? undefined : setAllRouteSteps}
          fitRouteToken={fitRouteToken}
          onDistanceChange={phase === "waiting" ? undefined : setNavDistM}
          onSpeedLimitChange={phase === "waiting" ? undefined : setSpeedLimit}
          onCameraApproach={phase === "waiting" ? undefined : handleCameraApproach}
          onSpeedChange={phase === "waiting" ? undefined : setSpeedMph}
          onRerouting={phase === "waiting" ? undefined : handleRerouting}
          onRouteInfoChange={phase === "waiting" ? undefined : setRouteInfo}
          onToDrag={phase === "in-progress" ? setDropoffCoordsOverride : undefined}
        />

        {phase === "in-progress" && (
          <div className="absolute bottom-9 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none whitespace-nowrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm">
              <MapPin size={11} className="text-white" />
              <span className="text-xs font-medium text-white">Drag pin to adjust entrance</span>
            </div>
          </div>
        )}

        {/* Turn-by-turn nav banner — full-width, top-anchored, dashboard-readable */}
        {rerouting ? (
          <div className="absolute top-0 left-0 right-0 z-[1000] nav-banner-safe">
            <div className="flex items-center gap-3 bg-card shadow-xl px-4 py-4">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
              <p className="text-2xl font-black text-foreground flex-1 min-w-0">Recalculating route…</p>
            </div>
          </div>
        ) : currentStep && phase !== "waiting" ? (
          <button type="button" onClick={() => setTurnListOpen(true)}
            className="absolute top-0 left-0 right-0 z-[1000] text-left w-full nav-banner-safe">
            {/* Main step — full-width dashboard card */}
            <div className="flex items-stretch bg-card shadow-xl overflow-hidden">
              <div className="w-[72px] bg-primary flex-shrink-0 flex items-center justify-center">
                <ManeuverIcon type={currentStep.type} modifier={currentStep.modifier} size={32} />
              </div>
              <div className="flex-1 min-w-0 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[22px] font-black text-foreground leading-snug flex-1 min-w-0 break-words">{currentStep.instruction}</p>
                  {navDistM != null && (
                    <span className="text-[22px] font-black text-primary flex-shrink-0 tabular-nums">{fmtDist(navDistM)}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 truncate font-medium">
                  {routeInfo
                    ? `${fmtDist(routeInfo.remainingM)} remaining · ${Math.ceil(routeInfo.remainingSecs / 60)} min`
                    : currentStep.name || ""}
                </p>
              </div>
            </div>
            {/* Next step preview */}
            {currentStep.nextStep && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-secondary border-b border-border shadow">
                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest flex-shrink-0">THEN</span>
                <ManeuverIcon type={currentStep.nextStep.type} modifier={currentStep.nextStep.modifier} className="text-muted-foreground flex-shrink-0" size={15} />
                <p className="text-sm font-semibold text-foreground line-clamp-1">{currentStep.nextStep.instruction}</p>
              </div>
            )}
          </button>
        ) : (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
            <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border backdrop-blur-sm ${
              phase === "to-pickup"
                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                : phase === "waiting"
                ? "bg-sky-500/20 border-sky-400/40 text-sky-300"
                : "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
            }`}>
              {phase === "to-pickup" ? `Heading to ${pickupLabel}` : phase === "waiting" ? (trip.type === "food" ? "At Restaurant" : "Waiting at Pickup") : `${typeLabel} in Progress`}
            </div>
          </div>
        )}

        {/* Timer — only during in-progress, hidden when nav banner is active */}
        {phase === "in-progress" && !currentStep && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/80 backdrop-blur-sm border border-border rounded-xl px-3 py-2 flex items-center gap-2">
            <Clock size={14} className="text-primary" />
            <span className="text-sm font-bold text-primary font-mono">{formatTime(elapsed)}</span>
          </div>
        )}

        {/* Wait timer */}
        {phase === "waiting" && (
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/80 backdrop-blur-sm border rounded-xl px-3 py-2 flex items-center gap-2 ${canLeave ? "border-destructive/40" : "border-border"}`}>
            <Clock size={14} className={canLeave ? "text-destructive" : "text-primary"} />
            <span className={`text-sm font-bold font-mono ${canLeave ? "text-destructive" : "text-primary"}`}>
              {canLeave ? `+${formatTime(waitElapsed - freeWaitSecs)}` : formatTime(waitRemaining)}
            </span>
          </div>
        )}

        {/* Left buttons: Audio · Hazard · SOS */}
        <div className="absolute bottom-[72px] left-4 z-[1000] flex flex-col gap-2">
          <button
            type="button"
            aria-label={voiceEnabled ? "Mute voice guidance" : "Unmute voice guidance"}
            onClick={() => setVoiceEnabled((v) => { const next = !v; localStorage.setItem("wego_voice", next ? "on" : "off"); return next; })}
            className={`w-[42px] h-[42px] rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-all ${voiceEnabled ? "bg-white" : "bg-black"}`}
          >
            {voiceEnabled ? <Volume2 size={22} strokeWidth={3} className="text-black" /> : <VolumeX size={22} strokeWidth={3} className="text-white" />}
          </button>
          <button
            type="button"
            onClick={() => { setIssueDone(false); setIssueOpen(true); }}
            aria-label="Report road issue"
            className="w-[42px] h-[42px] bg-white rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            <AlertTriangle size={22} strokeWidth={3} className="text-black" />
          </button>
          <button
            type="button"
            onClick={() => setSosModalOpen(true)}
            aria-label="Emergency SOS"
            className="w-[42px] h-[42px] bg-destructive rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            <span className="text-xs font-black text-white">SOS</span>
          </button>
        </div>

        {/* Right buttons: Recenter · Fit Route · Compass */}
        <div className="absolute bottom-[72px] right-4 z-[1000] flex flex-col gap-2">
          <button
            type="button"
            onClick={() => { lastMapMoveRef.current = 0; setMapResetToken((v) => v + 1); }}
            aria-label="Recenter map"
            className="w-[42px] h-[42px] bg-white rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            <Navigation size={22} strokeWidth={3} className="text-black" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (fitRouteTimerRef.current) clearTimeout(fitRouteTimerRef.current);
              setFitRouteToken((v) => v + 1);
              fitRouteTimerRef.current = setTimeout(() => {
                lastMapMoveRef.current = 0;
                setMapResetToken((v) => v + 1);
              }, 5000);
            }}
            aria-label="Show full route"
            className="w-[42px] h-[42px] bg-white rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            <MapPin size={22} strokeWidth={3} className="text-black" />
          </button>
          <button
            type="button"
            onClick={() => {
              setHeadingUp((h) => !h);
              const oe = (window as any).DeviceOrientationEvent;
              if (typeof oe?.requestPermission === "function") oe.requestPermission().catch(() => {});
            }}
            aria-label="Toggle heading-up mode"
            className={`w-[42px] h-[42px] rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-all ${headingUp ? "bg-black" : "bg-white"}`}
          >
            <Compass size={22} strokeWidth={3} className={headingUp ? "text-white" : "text-black"} />
          </button>
        </div>

        {/* Speed limit badge — top-right, updates with location */}
        {speedLimit !== null && phase !== "waiting" && (
          <div className="absolute top-4 right-4 z-[1001] pointer-events-none">
            <div className="w-11 bg-white border-[2.5px] border-black rounded text-center shadow-xl leading-none">
              <p className="text-[6px] font-black text-black tracking-tight pt-0.5">SPEED</p>
              <p className="text-[6px] font-black text-black tracking-tight">LIMIT</p>
              <p className="text-[20px] font-black text-black leading-snug pb-0.5">{speedLimit}</p>
            </div>
          </div>
        )}

        {/* Camera warning toast */}
        {cameraWarning && (
          <div className="absolute bottom-[84px] left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-2 bg-red-500/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-xl pointer-events-none whitespace-nowrap">
            <Camera size={13} className="text-white flex-shrink-0" />
            <span className="text-white text-xs font-bold tracking-wide">Speed camera ahead</span>
          </div>
        )}

        {/* Speedometer badge */}
        {speedMph !== null && phase !== "waiting" && (
          <div className="absolute bottom-4 right-4 z-[999] pointer-events-none">
            <div className="w-11 h-11 bg-white border-[2.5px] border-black rounded-full flex flex-col items-center justify-center shadow-xl leading-none">
              <p className="text-[18px] font-black text-black">{speedMph}</p>
              <p className="text-[6px] font-bold text-black tracking-tight">mph</p>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Panel */}
      <div className="px-4 pt-2 space-y-3">
        {/* Rider / Delivery Info — collapsed strip by default */}
        <div className="glass-card border border-border rounded-xl overflow-hidden">
          {/* Always-visible strip */}
          {/* Always-visible strip */}
          <div className="flex items-center gap-2 px-3 py-2">
            <button type="button" onClick={() => setPassengerCardExpanded((v) => !v)}
              className="flex-1 flex items-center gap-3 min-w-0 active:opacity-70 transition-opacity">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {trip.riderName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-foreground truncate">{trip.riderName}</p>
                {phase === "in-progress" && (
                  <p className="text-[11px] text-muted-foreground truncate">{stripCoords(trip.dropoffLocation)}</p>
                )}
              </div>
              <ChevronRight size={14} className={`text-muted-foreground flex-shrink-0 transition-transform ${passengerCardExpanded ? "rotate-90" : ""}`} />
            </button>
            <button type="button" aria-label="Message rider"
              onClick={() => setChatOpen(true)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-all relative ${chatMessages.length > 0 && !chatOpen ? "bg-primary" : "bg-secondary"}`}>
              <MessageSquare size={15} className={chatMessages.length > 0 && !chatOpen ? "text-white" : "text-foreground"} />
            </button>
            <button type="button" aria-label="Call rider" onClick={handleCall}
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-all ${calling ? "bg-green-500" : "bg-secondary"}`}>
              <Phone size={15} className={calling ? "text-white" : "text-foreground"} />
            </button>
          </div>

          {/* Expanded detail */}
          {passengerCardExpanded && (
            <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
              <p className="text-xs text-muted-foreground">Your Take: <span className="text-primary font-semibold">${trip.driverTake.toFixed(2)}</span></p>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Message rider"
                  onClick={() => { setChatOpen(true); setPassengerCardExpanded(false); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-medium active:scale-95 transition-all ${chatMessages.length > 0 && !chatOpen ? "bg-primary border-primary text-white" : "bg-card border-border text-primary"}`}>
                  <MessageSquare size={15} />
                  Message
                </button>
                <button type="button" aria-label="Call rider"
                  onClick={handleCall}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-medium active:scale-95 transition-all ${calling ? "bg-green-500 border-green-500 text-white" : "bg-card border-border text-primary"}`}>
                  <Phone size={15} />
                  Call
                </button>
              </div>
              <button type="button" onClick={() => { setPassengerCardExpanded(false); setCancelModalOpen(true); }}
                className="w-full py-2 rounded-xl border border-destructive/40 text-destructive text-sm font-medium active:scale-95 transition-all">
                Cancel / End Early
              </button>
            </div>
          )}
        </div>

        {hasPickupIssueAlert && (
          <div className="glass-card p-4 border border-amber-500/35 rounded-xl bg-amber-500/5 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              <p className="text-sm font-semibold text-foreground">Passenger pickup issue reported</p>
            </div>
            <p className="text-xs text-muted-foreground">
              The passenger says they are not in the vehicle or the wrong rider may be onboard. Pull over safely and verify before continuing.
            </p>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {pickupIssueAlert.chargeBlocked ? "Trip payout is on hold pending review." : "Review pending."}
            </p>
          </div>
        )}

        {/* Destination Card — hidden during active trip to maximise map space */}
        {phase !== "in-progress" && <div className="glass-card p-4 border border-border rounded-xl space-y-3">
          {phase === "to-pickup" ? (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Navigation size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{pickupLabel} Location</p>
                <p className="text-base font-semibold text-foreground mt-0.5">{stripCoords(trip.pickupLocation)}</p>
                <p className="text-xs text-muted-foreground mt-1">{pickupEtaMinutes} min away</p>
              </div>
            </div>
          ) : phase === "waiting" ? (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{trip.type === "food" ? "At Restaurant — Awaiting Order" : `At ${pickupLabel} — Waiting`}</p>
                <p className="text-base font-semibold text-foreground mt-0.5">{stripCoords(trip.pickupLocation)}</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin size={14} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Dropoff Location</p>
                <p className="text-base font-semibold text-foreground mt-0.5">{stripCoords(trip.dropoffLocation)}</p>
              </div>
            </div>
          )}
        </div>}

        {/* Scheduled pickup countdown */}
        {phase === "to-pickup" && trip.isAdvanced && scheduledSecsRemaining !== null && (
          <div className={`glass-card px-4 py-3 border rounded-xl flex items-center gap-3 ${scheduledSecsRemaining < 0 ? "border-amber-500/40 bg-amber-500/5" : "border-primary/30 bg-primary/5"}`}>
            <Clock size={16} className={scheduledSecsRemaining < 0 ? "text-amber-500 flex-shrink-0" : "text-primary flex-shrink-0"} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scheduled Pickup</p>
              <p className={`text-sm font-bold ${scheduledSecsRemaining < 0 ? "text-amber-500" : "text-foreground"}`}>
                {trip.scheduledHour != null && trip.scheduledMinute != null
                  ? `${trip.scheduledHour % 12 || 12}:${String(trip.scheduledMinute).padStart(2, "0")} ${trip.scheduledHour >= 12 ? "PM" : "AM"}`
                  : "—"}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              {scheduledSecsRemaining >= 0 ? (
                <>
                  <p className="text-xl font-bold font-mono text-primary tabular-nums">{formatTime(scheduledSecsRemaining)}</p>
                  <p className="text-[10px] text-muted-foreground">until pickup</p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold font-mono text-amber-500 tabular-nums">+{formatTime(Math.abs(scheduledSecsRemaining))}</p>
                  <p className="text-[10px] text-amber-500">overdue</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Action Button */}
        {phase === "to-pickup" && (
          <button type="button" onClick={async () => {
              setPhase("waiting");
              if (trip.rideId) {
                try {
                  await updateRideStatus(trip.rideId, "arrived");
                } catch {
                  showError("Couldn't update status — check your connection");
                }
              }
            }}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform btn-glow">
            <CheckCircle size={22} />
            {arrivedLabel}
          </button>
        )}

        {phase === "waiting" && (
          <>
            {trip.type === "food" ? (
              <div className="glass-card p-4 border border-border rounded-xl flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
                <p className="text-sm text-foreground font-medium">Waiting for order to be prepared</p>
              </div>
            ) : (
              <div className={`glass-card p-4 border rounded-xl space-y-2 ${canLeave ? "border-destructive/30" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {canLeave ? (meterSecs > 0 ? "On Meter" : "Free Window Ended") : "Free Wait Time"}
                  </p>
                  <span className={`text-2xl font-bold font-mono ${canLeave ? "text-destructive" : "text-primary"}`}>
                    {canLeave ? `+${formatTime(waitElapsed - freeWaitSecs)}` : formatTime(waitRemaining)}
                  </span>
                </div>
                {trip.isAdvanced && meterSecs > 0 && (
                  <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                    <span className="text-xs text-muted-foreground">Meter charge (passenger owes)</span>
                    <span className="text-sm font-bold text-primary">${meterCharge.toFixed(2)}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {trip.isAdvanced
                    ? "Advance booking: 8 min free · 2 min on meter ($0.50/min)"
                    : "Standard ride: 5 min free wait"}
                </p>
              </div>
            )}

            <button type="button" onClick={async () => {
                if (pinRequired) {
                  setPinModalOpen(true);
                } else {
                  setPhase("in-progress");
                  if (trip.rideId) {
                    try {
                      await updateRideStatus(trip.rideId, "inProgress");
                    } catch {
                      showError("Couldn't update status — check your connection");
                    }
                  }
                }
              }}
              disabled={pickupIssueNeedsAcknowledgement}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-xl ${pickupIssueNeedsAcknowledgement ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-none cursor-not-allowed" : "bg-primary text-primary-foreground btn-glow"}`}>
              <CheckCircle size={22} />
              {pickupIssueNeedsAcknowledgement ? "Acknowledge Safety Alert First" : (trip.type === "food" ? "Food Picked Up" : "Passenger is Here")}
            </button>

            {trip.type !== "food" && (
              <button type="button" onClick={handlePassengerNoShow}
                disabled={!canLeave}
                className={`w-full py-3 rounded-xl border text-sm font-semibold active:scale-95 transition-transform ${
                  canLeave
                    ? "border-destructive/50 text-destructive hover:bg-destructive/5"
                    : "border-border text-muted-foreground opacity-40"
                }`}>
                {canLeave ? "Cancel — No Show" : `Cancel & Leave unlocks in ${formatTime(waitRemaining)}`}
              </button>
            )}
          </>
        )}

        {phase === "in-progress" && stopViaCoords && (
          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">En route to stop</p>
              <p className="text-xs text-muted-foreground truncate">{stopNotif?.address ?? "Passenger stop"}</p>
            </div>
            <button
              type="button"
              onClick={() => setStopViaCoords(null)}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold active:scale-95 transition-transform flex-shrink-0"
            >
              Arrived
            </button>
          </div>
        )}

        {phase === "in-progress" && (
          <>
            {hasPickupIssueAlert && (
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Verify passenger before continuing</p>
                  <p className="text-xs text-muted-foreground">
                    {pickupIssueAlert.driverAlertSeen ? "Alert acknowledged." : "Acknowledgement required."}
                  </p>
                </div>
                {!pickupIssueAlert.driverAlertSeen && (
                  <button
                    type="button"
                    onClick={async () => {
                      setPickupIssueAlert(prev => ({ ...prev, driverAlertSeen: true }));
                      setPickupIssueAlertOpen(false);
                      if (trip.rideId) acknowledgeRideDispute(trip.rideId).catch(() => {});
                    }}
                    className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold active:scale-95 transition-transform"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            )}
            {stopEarnings > 0 && (
              <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5">
                <span className="text-xs text-muted-foreground">Stop fees earned</span>
                <span className="text-sm font-bold text-primary">+${stopEarnings.toFixed(2)}</span>
              </div>
            )}

            <button type="button" onClick={() => setCompleteConfirmOpen(true)}
              disabled={pickupIssueNeedsAcknowledgement || isCompleting}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-xl ${
                pickupIssueNeedsAcknowledgement
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-none cursor-not-allowed"
                  : "bg-primary text-primary-foreground btn-glow"
              }`}>
              <CheckCircle size={22} />
              {pickupIssueNeedsAcknowledgement ? "Acknowledge Safety Alert First" : isCompleting ? "Completing…" : completeLabel}
            </button>
          </>
        )}
      </div>

      {/* Error toast */}
      {toastError && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-2 bg-destructive text-destructive-foreground text-sm font-semibold px-4 py-3 rounded-2xl shadow-xl pointer-events-none max-w-[90vw] text-center">
          {toastError}
        </div>
      )}

      {/* Calling toast */}
      {calling && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-card border border-border rounded-2xl px-5 py-3 shadow-xl">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="text-sm font-semibold text-foreground">Calling {trip.riderName.split(" ")[0]}…</p>
        </div>
      )}

      {pickupIssueAlertOpen && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60">
          <div className="w-full max-w-sm bg-card border border-amber-500/35 rounded-2xl p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={22} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Passenger Issue Reported</h2>
                  <p className="text-sm text-muted-foreground">Verify the passenger in your car now</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close alert"
                onClick={() => setPickupIssueAlertOpen(false)}
                className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center"
              >
                <X size={15} className="text-muted-foreground" />
              </button>
            </div>

            <div className="bg-muted/20 border border-border rounded-xl p-4 space-y-2 text-sm text-muted-foreground">
              <p>The passenger reported that this trip may have started without them in the vehicle.</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Trip payout is blocked pending review</li>
                <li>Safely pull over and verify rider identity</li>
                <li>Use chat or call before continuing the trip</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPickupIssueAlertOpen(false);
                  setChatOpen(true);
                }}
                className="py-3 rounded-xl bg-muted/30 border border-border text-foreground font-semibold text-sm active:scale-95 transition-transform"
              >
                Message Rider
              </button>
              <button
                type="button"
                onClick={async () => {
                  setPickupIssueAlert(prev => ({ ...prev, driverAlertSeen: true }));
                  setPickupIssueAlertOpen(false);
                  if (trip.rideId) acknowledgeRideDispute(trip.rideId).catch(() => {});
                }}
                className="py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-95 transition-transform btn-glow"
              >
                Acknowledge Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passenger cancelled overlay */}
      {passengerCancelled && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <button type="button" onClick={() => navigate("/", { state: { tripCompleted: true } })} aria-label="Dismiss"
                className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center active:scale-95 transition-transform hover:bg-destructive/20">
                <X size={28} className="text-destructive" />
              </button>
              <h2 className="text-lg font-bold text-foreground">Passenger Cancelled</h2>
              <p className="text-sm text-muted-foreground">{trip.riderName.split(" ")[0]} cancelled the ride.</p>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-primary" />
                <p className="text-sm font-semibold text-foreground">Cancellation fee earned</p>
              </div>
              {cancellationFee === 0 ? (
                <p className="text-sm text-muted-foreground">No fee — passenger cancelled within the free window.</p>
              ) : (
                <>
                  <p className="text-3xl font-bold text-primary">${cancellationFee.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">100% goes to you. This will appear in your earnings within 24 hours.</p>
                  <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2 mt-1">
                    {phase === "waiting"
                      ? `Passenger cancelled while you were waiting at pickup. Includes distance fee + $3.00 waiting${meterCharge > 0 ? ` + $${meterCharge.toFixed(2)} meter` : ""}.`
                      : cancellationFee === 5
                      ? "Passenger cancelled while you were nearby (< 5 miles)."
                      : cancellationFee === 9
                      ? "Passenger cancelled while you were 5–10 miles en route."
                      : "Passenger cancelled after you drove 10+ miles including highway."}
                  </div>
                </>
              )}
            </div>

            <button type="button" onClick={() => navigate("/", { state: { tripCompleted: true } })}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm active:scale-95 transition-transform">
              Back to Command
            </button>
          </div>
        </div>
      )}

      {/* Chat modal */}
      {chatOpen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setChatOpen(false)} />
          <div className="relative w-full max-w-[430px] bg-card border-t border-border rounded-t-2xl flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                  {trip.riderName.charAt(0)}
                </div>
                <p className="text-sm font-semibold text-foreground">{trip.riderName}</p>
              </div>
              <button type="button" aria-label="Close chat" onClick={() => setChatOpen(false)}
                className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                <X size={15} className="text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-2 min-h-[80px]">
              {chatMessages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center pt-2">No messages yet</p>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex w-full ${msg.senderType === "driver" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words ${msg.senderType === "driver" ? "bg-primary text-white" : "bg-muted/40 text-foreground border border-border"}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {/* Quick reply chips — always visible */}
            <div className="flex-shrink-0 flex gap-2 overflow-x-auto px-4 py-2 border-t border-border/50 scrollbar-none">
              {["I'm on my way!", "Arrived — look for my car", "3 min late, sorry", "Call me"].map((t) => (
                <button key={t} type="button" onClick={async () => {
                    if (!user || !trip.rideId) return;
                    await sendRideMessage(trip.rideId, user.uid, "driver", t);
                  }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full bg-muted/40 border border-border text-xs text-foreground active:scale-95 active:bg-primary/10 active:border-primary/40 transition-all whitespace-nowrap">
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) sendMessage(); }}
                placeholder="Message rider…"
                className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary" />
              <button type="button" aria-label="Send message" onClick={sendMessage} disabled={!chatInput.trim()}
                className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform">
                <Send size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN entry modal */}
      {pinModalOpen && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={0} className="hidden" />
                <span className="text-2xl">🔒</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Passenger PIN Required</h2>
                <p className="text-sm text-muted-foreground">Ask the passenger for their 4-digit code</p>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  id={`pin-driver-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  aria-label={`PIN digit ${i + 1}`}
                  value={pinEntry[i]}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(-1);
                    const next = [...pinEntry];
                    next[i] = val;
                    setPinEntry(next);
                    setPinError(false);
                    if (val && i < 3) {
                      document.getElementById(`pin-driver-${i + 1}`)?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !pinEntry[i] && i > 0) {
                      document.getElementById(`pin-driver-${i - 1}`)?.focus();
                    }
                  }}
                  className="w-14 h-16 text-center text-2xl font-bold bg-background border-2 border-border rounded-xl focus:outline-none focus:border-primary text-foreground transition-colors"
                />
              ))}
            </div>

            {pinError && (
              <p className="text-sm text-destructive text-center font-medium">Incorrect PIN — ask the passenger again</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => { setPinModalOpen(false); setPinEntry(["", "", "", ""]); setPinError(false); pinSubmittingRef.current = false; }}
                className="py-3 rounded-xl bg-muted/30 border border-border text-foreground font-semibold text-sm active:scale-95 transition-transform">
                Cancel
              </button>
              <button
                type="button"
                disabled={pinEntry.some((d) => d === "")}
                onClick={() => {
                  if (pinSubmittingRef.current) return;
                  pinSubmittingRef.current = true;
                  const entered = pinEntry.join("");
                  if (entered === ridePin) {
                    setPinModalOpen(false);
                    setPinEntry(["", "", "", ""]);
                    setPinError(false);
                    setPhase("in-progress");
                    if (trip.rideId) updateRideStatus(trip.rideId, "inProgress").catch(() => {});
                  } else {
                    setPinError(true);
                    pinSubmittingRef.current = false;
                  }
                }}
                className="py-3 rounded-xl bg-primary text-white font-semibold text-sm active:scale-95 transition-transform disabled:opacity-40"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passenger stop notification */}
      {stopNotifOpen && stopNotif && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60">
          <div className="w-full max-w-sm bg-card border border-amber-500/35 rounded-2xl p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                <MapPin size={22} className="text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Passenger Added a Stop</h2>
                <p className="text-sm text-muted-foreground truncate">{stopNotif.address}</p>
              </div>
            </div>

            <div className="bg-background border border-border rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Stop fee added</span>
                <span className="font-bold text-primary">+${stopNotif.fareDelta.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your new take</span>
                <span className="font-bold text-primary">${(trip.driverTake + stopEarnings + stopNotif.fareDelta).toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">100% of the stop fee goes to you. Route updated on the map.</p>
            </div>

            <button
              type="button"
              onClick={async () => {
                setStopNotifOpen(false);
                if (trip.rideId) acknowledgeStop(trip.rideId).catch(() => {});
              }}
              className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm active:scale-95 transition-transform"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* SOS Modal */}
      {sosModalOpen && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center px-4 bg-black/70">
          <div className="w-full max-w-sm bg-card border border-destructive/40 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-destructive" />
                <h2 className="text-lg font-bold text-foreground">Emergency</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setSosModalOpen(false)}
                className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <a href="tel:911"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-destructive text-white font-bold text-sm active:scale-95 transition-transform">
                <Phone size={16} />
                Call 911
              </a>
              <div className="flex flex-col items-center gap-1">
                <button type="button"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-border text-foreground font-semibold text-sm opacity-50 cursor-not-allowed">
                  Text Emergency Contacts
                </button>
                <span className="text-xs text-muted-foreground">Coming soon</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete trip confirm modal */}
      {completeConfirmOpen && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">{isDelivery ? "Confirm Delivery?" : "Complete Trip?"}</h2>
            <p className="text-sm text-muted-foreground">
              {isDelivery
                ? "Confirm the delivery has been handed off."
                : `Confirm ${trip.riderName.split(" ")[0]} has been dropped off at their destination.`}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setCompleteConfirmOpen(false)}
                className="py-3 rounded-xl bg-muted/30 border border-border text-foreground font-semibold text-sm active:scale-95 transition-transform">
                Keep Driving
              </button>
              <button type="button" disabled={isCompleting} onClick={async () => {
                  setCompleteConfirmOpen(false);
                  setIsCompleting(true);
                  try {
                    // Compute actual fare by time + distance so driver can't collect full fare
                    // if they end the trip before reaching the destination.
                    const estSecs = (trip.estimatedTime || 10) * 60;
                    const tRatio = Math.min(elapsed / estSecs, 1);
                    let dRatio = tRatio;
                    const distToDropoff = driverCoords && trip.dropoffCoords
                      ? haversineMeters(driverCoords[0], driverCoords[1], trip.dropoffCoords[0], trip.dropoffCoords[1])
                      : null;
                    const isAtDestination = distToDropoff !== null && distToDropoff < 500;
                    if (!isAtDestination && driverCoords && trip.pickupCoords && trip.dropoffCoords) {
                      const covM  = haversineMeters(trip.pickupCoords[0], trip.pickupCoords[1], driverCoords[0], driverCoords[1]);
                      const totM  = haversineMeters(trip.pickupCoords[0], trip.pickupCoords[1], trip.dropoffCoords[0], trip.dropoffCoords[1]);
                      dRatio = Math.min(covM / Math.max(totM, 1), 1);
                    }
                    const ratio = Math.min(Math.max(tRatio, dRatio), 1);
                    const actualFare = isAtDestination
                      ? trip.riderPayment
                      : parseFloat(Math.max(5, ratio * trip.riderPayment).toFixed(2));
                    const actualCoopFee = parseFloat((actualFare * 0.12).toFixed(2));
                    const actualGross = actualFare + stopEarnings;
                    if (trip.rideId) {
                      if (actualFare < trip.riderPayment) {
                        await endRideEarly(trip.rideId, actualFare);
                      } else {
                        await updateRideStatus(trip.rideId, "completed");
                      }
                      if (user) {
                        await logEarningsEntry({ driverId: user.uid, rideId: trip.rideId, gross: actualGross, coopFee: actualCoopFee, type: trip.type ?? "ride" });
                        await incrementDriverRideCount(user.uid);
                      }
                    }
                    if (actualFare < trip.riderPayment) {
                      setEarlyEndData({ proratedFare: actualFare });
                    }
                                    // Reset stale trip refs
                    enRouteElapsed.current = 0;
                    enRouteFeeRef.current = 5.00;
                    if (fitRouteTimerRef.current) clearTimeout(fitRouteTimerRef.current);
                    setPhase("complete");
                  } catch {
                    setIsCompleting(false);
                    showError("Couldn't complete trip — check your connection");
                  }
                }}
                className="py-3 rounded-xl bg-primary text-white font-semibold text-sm active:scale-95 transition-transform disabled:opacity-50">
                {isCompleting ? "Completing…" : `Yes, ${completeLabel}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety check modal — driver not moving for 3+ minutes */}
      {safetyAlertOpen && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center px-4 bg-black/70">
          <div className="w-full max-w-sm bg-card border border-amber-500/40 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={24} className="text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Are you okay?</h2>
                <p className="text-sm text-muted-foreground">Vehicle hasn't moved for a few minutes</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <a href="tel:911"
                className="py-3 rounded-xl bg-destructive text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <Phone size={15} />
                Call 911
              </a>
              <button type="button" onClick={() => {
                  setSafetyAlertOpen(false);
                  if (lastDriverMoveRef.current) lastDriverMoveRef.current.time = Date.now();
                }}
                className="py-3 rounded-xl bg-primary text-white font-semibold text-sm active:scale-95 transition-transform">
                I'm Okay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TURN LIST OVERLAY ── */}
      {turnListOpen && (
        <div className="absolute inset-0 z-[9999] bg-background flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card flex-shrink-0">
            <button type="button" aria-label="Close turn list" onClick={() => setTurnListOpen(false)}
              className="w-9 h-9 rounded-xl bg-black flex items-center justify-center active:scale-95 transition-transform flex-shrink-0">
              <X size={18} className="text-white" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-foreground truncate">
                {phase === "to-pickup" ? "Route to pickup" : `Route to ${trip.dropoffLocation?.split(",")[0] ?? "destination"}`}
              </p>
              {routeInfo && (
                <p className="text-xs text-muted-foreground">{fmtDist(routeInfo.remainingM)} · {Math.ceil(routeInfo.remainingSecs / 60)} min remaining</p>
              )}
            </div>
          </div>

          {/* Steps list */}
          <div className="flex-1 overflow-y-auto">
            {allRouteSteps.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">{rerouting ? "Loading route…" : "No steps available"}</div>
            ) : (
              allRouteSteps.map((step, i) => (
                <div key={i} className={`flex items-center gap-4 px-4 py-3 border-b border-border/40 ${i === 0 ? "bg-primary/5" : ""}`}>
                  <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${i === 0 ? "bg-primary" : "bg-secondary"}`}>
                    <ManeuverIcon type={step.type} modifier={step.modifier} className={i === 0 ? "text-white" : "text-foreground"} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${i === 0 ? "text-primary" : "text-foreground"}`}>{step.instruction}</p>
                    {step.name && <p className="text-xs text-muted-foreground truncate">{step.name}</p>}
                  </div>
                  {step.distance > 0 && (
                    <span className="text-sm font-black text-muted-foreground flex-shrink-0 tabular-nums">{fmtDist(step.distance)}</span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Open Google Maps */}
          {trip.dropoffCoords && (
            <div className="flex-shrink-0 p-4 border-t border-border bg-card">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${trip.dropoffCoords[0]},${trip.dropoffCoords[1]}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 rounded-xl bg-white border border-border text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Navigation size={16} className="text-black" />
                Open in Google Maps
              </a>
            </div>
          )}
        </div>
      )}

      {/* Cancel / End Early Modal */}
      {cancelModalOpen && (() => {
        const estimatedSecs = (trip.estimatedTime || 10) * 60;
        const timeRatio = Math.min(elapsed / estimatedSecs, 1);
        let distanceRatio = timeRatio;
        if (driverCoords && trip.pickupCoords && trip.dropoffCoords) {
          const coveredM = haversineMeters(trip.pickupCoords[0], trip.pickupCoords[1], driverCoords[0], driverCoords[1]);
          const totalM   = haversineMeters(trip.pickupCoords[0], trip.pickupCoords[1], trip.dropoffCoords[0], trip.dropoffCoords[1]);
          distanceRatio = Math.min(coveredM / Math.max(totalM, 1), 1);
        }
        const combinedRatio = Math.min(Math.max(timeRatio, distanceRatio), 1);
        const proratedBase = parseFloat(Math.max(5, combinedRatio * trip.riderPayment).toFixed(2));
        const proratedCoopFee = parseFloat((proratedBase * 0.12).toFixed(2));
        const proratedDriverTake = parseFloat((proratedBase - proratedCoopFee + stopEarnings).toFixed(2));

        const cancelReasons = phase === "in-progress"
          ? ["Passenger asked to stop", "Wrong destination", "Safety concern", "Vehicle issue", "Passenger unresponsive", "Other"]
          : ["Passenger no-show", "Passenger asked to cancel", "Wrong pickup location", "Safety concern", "Vehicle issue", "Other"];

        return (
          <div className="absolute inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60">
            <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">
                  {phase === "in-progress" ? "End Ride Early?" : "Cancel Trip?"}
                </h2>
                <button type="button" aria-label="Close" onClick={() => { setCancelModalOpen(false); setCancelReason(null); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>

              {/* Reason picker */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select a reason</p>
                {cancelReasons.map((r) => (
                  <button key={r} type="button" onClick={() => setCancelReason(r)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all active:scale-[0.98] ${
                      cancelReason === r
                        ? "bg-destructive/10 border-destructive/50 text-destructive"
                        : "bg-background border-border text-foreground"
                    }`}>
                    {r}
                  </button>
                ))}
              </div>

              {/* Prorated fare info (end-early only) */}
              {phase === "in-progress" && (
                <div className="bg-background border border-border rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Passenger charged</span>
                    <span className="text-foreground font-semibold">${proratedBase.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">WeGo fee (12%)</span>
                    <span className="text-destructive font-medium">-${proratedCoopFee.toFixed(2)}</span>
                  </div>
                  {stopEarnings > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stop fees</span>
                      <span className="text-primary font-medium">+${stopEarnings.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="h-px bg-border/50" />
                  <div className="flex justify-between font-semibold">
                    <span className="text-primary">Your take</span>
                    <span className="text-primary">${proratedDriverTake.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button type="button" onClick={() => { setCancelModalOpen(false); setCancelReason(null); }}
                  className="py-3 rounded-xl bg-muted/30 border border-border text-foreground font-semibold text-sm active:scale-95 transition-transform">
                  Keep Trip
                </button>
                {phase === "in-progress" ? (
                  <button type="button" disabled={!cancelReason}
                    onClick={async () => {
                      setCancelModalOpen(false);
                      if (trip.rideId) {
                        endRideEarly(trip.rideId, proratedBase, cancelReason ?? undefined).catch(() => {});
                        if (user) {
                          const earlyGross = proratedBase + stopEarnings;
                          logEarningsEntry({ driverId: user.uid, rideId: trip.rideId, gross: earlyGross, coopFee: proratedCoopFee, type: trip.type ?? "ride" }).catch(() => {});
                          incrementDriverRideCount(user.uid).catch(() => {});
                        }
                      }
                      setCancelReason(null);
                      setEarlyEndData({ proratedFare: proratedBase });
                      enRouteElapsed.current = 0;
                      enRouteFeeRef.current = 5.00;
                      if (fitRouteTimerRef.current) clearTimeout(fitRouteTimerRef.current);
                      setPhase("complete");
                    }}
                    className="py-3 rounded-xl bg-destructive/10 border border-destructive/40 text-destructive font-semibold text-sm active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed">
                    End Early — ${proratedBase.toFixed(2)}
                  </button>
                ) : (
                  <button type="button" disabled={!cancelReason}
                    onClick={async () => {
                      setCancelModalOpen(false);
                      if (trip.rideId) await updateRideStatus(trip.rideId, "cancelled", cancelReason ?? undefined);
                      setCancelReason(null);
                      navigate("/");
                    }}
                    className="py-3 rounded-xl bg-destructive/10 border border-destructive/40 text-destructive font-semibold text-sm active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed">
                    Cancel Trip
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── ROAD ISSUE MODAL ── */}
      {issueOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center px-4 pb-8 bg-black/60" onClick={() => setIssueOpen(false)}>
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-amber-500" />
              <p className="text-sm font-bold text-foreground">Report Road Issue</p>
            </div>
            {issueDone ? (
              <div className="flex items-center justify-center gap-2 py-4 text-primary">
                <CheckCircle size={18} />
                <span className="text-sm font-semibold">Report submitted — thanks!</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {([
                  { type: "closure",  label: "Road Closure",  emoji: "🚧" },
                  { type: "accident", label: "Accident",      emoji: "💥" },
                  { type: "traffic",  label: "Heavy Traffic", emoji: "🚗" },
                  { type: "hazard",   label: "Hazard",        emoji: "⚠️" },
                  { type: "pothole",  label: "Pothole",       emoji: "🕳️" },
                  { type: "other",    label: "Other",         emoji: "📍" },
                ] as { type: RoadIssueType; label: string; emoji: string }[]).map(({ type, label, emoji }) => (
                  <button
                    key={type}
                    type="button"
                    disabled={issueSubmitting}
                    onClick={async () => {
                      if (!user || !driverCoords) return;
                      setIssueSubmitting(true);
                      try {
                        await reportRoadIssue({ driverId: user.uid, type, lat: driverCoords[0], lng: driverCoords[1] });
                        setIssueDone(true);
                        setTimeout(() => setIssueOpen(false), 1500);
                      } finally {
                        setIssueSubmitting(false);
                      }
                    }}
                    className="flex items-center gap-2 py-3 px-3 rounded-xl border border-border bg-muted/20 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="text-xs font-semibold text-foreground">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
