import Echo from "laravel-echo";
import Pusher from "pusher-js";

/**
 * Laravel Reverb WebSocket client for group live tracking.
 *
 * The singleton is keyed by the current Sanctum token so signing out and back
 * in as another traveller never reuses the previous user's channel auth.
 * When the VITE_REVERB_* variables are missing the app simply polls instead.
 */

export type RealtimeStatus = "connected" | "connecting" | "reconnecting" | "disconnected" | "unavailable";

const appKey = (import.meta.env.VITE_REVERB_APP_KEY as string | undefined)?.trim() ?? "";
const configuredHost = (import.meta.env.VITE_REVERB_HOST as string | undefined)?.trim() ?? "";
const configuredPort = Number(import.meta.env.VITE_REVERB_PORT ?? 6001);
const configuredScheme = ((import.meta.env.VITE_REVERB_SCHEME as string | undefined) ?? "").trim().toLowerCase();

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

let instance: { echo: Echo<"reverb">; token: string | null } | null = null;

export function realtimeConfigured(): boolean {
  return appKey !== "";
}

function host(): string {
  return configuredHost !== "" ? configuredHost : window.location.hostname;
}

function port(): number {
  return Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 6001;
}

function secure(): boolean {
  if (configuredScheme === "https" || configuredScheme === "wss") return true;
  if (configuredScheme === "http" || configuredScheme === "ws") return false;
  return window.location.protocol === "https:";
}

function authEndpoint(): string {
  return new URL(`${apiUrl.replace(/\/$/, "")}/broadcasting/auth`, window.location.origin).href;
}

function build(token: string | null): Echo<"reverb"> {
  return new Echo<"reverb">({
    broadcaster: "reverb",
    key: appKey,
    Pusher,
    wsHost: host(),
    wsPort: port(),
    wssPort: port(),
    forceTLS: secure(),
    enabledTransports: secure() ? ["wss"] : ["ws"],
    authEndpoint: authEndpoint(),
    auth: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  });
}

export function getEcho(token: string | null): Echo<"reverb"> | null {
  if (!realtimeConfigured()) return null;
  if (instance !== null && instance.token === token) return instance.echo;

  if (instance !== null) {
    instance.echo.disconnect();
    instance = null;
  }

  const echo = build(token);
  instance = { echo, token };
  return echo;
}

/** Disconnect the shared client, e.g. on sign-out. */
export function releaseEcho(): void {
  instance?.echo.disconnect();
  instance = null;
}
