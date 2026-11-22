import { useCallback, useEffect, useState } from "react";

import type { ItineraryItem } from "@/lib/types";

export interface RouteAlert {
  type: "5min" | "arrival";
  title: string;
  body: string;
  timestamp: number;
}

export interface UseRouteAlertsOptions {
  itineraryId: number;
  activeStop: ItineraryItem | null;
  remainingDistanceM: number | null;
  remainingDurationS: number | null;
  enabled: boolean;
}

export interface UseRouteAlertsResult {
  alertsSupported: boolean;
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => Promise<boolean>;
  lastAlert: RouteAlert | null;
  dismissLastAlert: () => void;
  playChime: (type: "5min" | "arrival") => void;
}

function getAlertStorageKey(itineraryId: number, stopId: number, type: "5min" | "arrival"): string {
  return `lakbai.alerts.${itineraryId}.${stopId}.${type}`;
}

function hasAlertFired(itineraryId: number, stopId: number, type: "5min" | "arrival"): boolean {
  try {
    return window.sessionStorage.getItem(getAlertStorageKey(itineraryId, stopId, type)) === "1";
  } catch {
    return false;
  }
}

function markAlertFired(itineraryId: number, stopId: number, type: "5min" | "arrival"): void {
  try {
    window.sessionStorage.setItem(getAlertStorageKey(itineraryId, stopId, type), "1");
  } catch {
    // Session storage failure should not crash alert execution
  }
}

/** Synthesize audible chimes via Web Audio API without needing external assets */
function synthesizeChime(type: "5min" | "arrival"): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === "5min") {
      // Gentle two-tone warning chime: 659Hz (E5) -> 880Hz (A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.15);
      gain2.gain.setValueAtTime(0.2, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.6);
    } else {
      // Bright arrival fanfare triad: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.12;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    }

    // Auto-close audio context after sound playback
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 1200);
  } catch {
    // Audio autoplay restrictions or unsupported audio
  }
}

function triggerVibration(type: "5min" | "arrival"): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      if (type === "5min") {
        navigator.vibrate([180, 100, 180]);
      } else {
        navigator.vibrate([250, 100, 250, 100, 300]);
      }
    }
  } catch {
    // Vibration not supported or denied
  }
}

export function useRouteAlerts({
  itineraryId,
  activeStop,
  remainingDistanceM,
  remainingDurationS,
  enabled,
}: UseRouteAlertsOptions): UseRouteAlertsResult {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return typeof Notification !== "undefined" ? Notification.permission : "denied";
  });
  const [lastAlert, setLastAlert] = useState<RouteAlert | null>(null);
  const activeStopId = activeStop?.id ?? null;
  const activeStopTitle = activeStop?.title ?? "Next Stop";
  const alertsSupported = typeof window !== "undefined" && "Notification" in window;

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (typeof Notification === "undefined") return false;
    try {
      const res = await Notification.requestPermission();
      setNotificationPermission(res);
      return res === "granted";
    } catch {
      return false;
    }
  }, []);

  const dispatchAlert = useCallback(
    (type: "5min" | "arrival", title: string, body: string) => {
      // 1. Play synthesized audio chime
      synthesizeChime(type);

      // 2. Vibrate device
      triggerVibration(type);

      // 3. Set in-app toast / banner state
      setLastAlert({
        type,
        title,
        body,
        timestamp: Date.now(),
      });

      // 4. Send Web Notification if granted
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: `lakbai-stop-${itineraryId}-${activeStopId}-${type}`,
          });
        } catch {
          // Web Notification error handling
        }
      }
    },
    [itineraryId, activeStopId],
  );

  // Monitor conditions for 5-minute and 50m arrival alerts
  useEffect(() => {
    if (!enabled || activeStopId === null) return;

    // Check 1: 5-minute ETA alert (~300s)
    if (
      remainingDurationS !== null &&
      remainingDurationS <= 300 &&
      remainingDurationS > 30 &&
      !hasAlertFired(itineraryId, activeStopId, "5min")
    ) {
      markAlertFired(itineraryId, activeStopId, "5min");
      dispatchAlert(
        "5min",
        `Approaching ${activeStopTitle}`,
        `You are approximately 5 minutes away from ${activeStopTitle}.`,
      );
    }

    // Check 2: ~50m arrival proximity alert
    if (
      remainingDistanceM !== null &&
      remainingDistanceM <= 50 &&
      remainingDistanceM >= 0 &&
      !hasAlertFired(itineraryId, activeStopId, "arrival")
    ) {
      markAlertFired(itineraryId, activeStopId, "arrival");
      dispatchAlert(
        "arrival",
        `Arrived at ${activeStopTitle}`,
        `You are within 50 meters of ${activeStopTitle}.`,
      );
    }
  }, [
    enabled,
    itineraryId,
    activeStopId,
    activeStopTitle,
    remainingDistanceM,
    remainingDurationS,
    dispatchAlert,
  ]);

  const dismissLastAlert = useCallback(() => {
    setLastAlert(null);
  }, []);

  return {
    alertsSupported,
    notificationPermission,
    requestNotificationPermission,
    lastAlert,
    dismissLastAlert,
    playChime: synthesizeChime,
  };
}
