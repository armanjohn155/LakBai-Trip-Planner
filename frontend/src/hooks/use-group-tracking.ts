import { useCallback, useEffect, useRef, useState } from "react";

import { apiError, getGroupTracking, pinGroupMeetup, setGroupSharing } from "@/lib/api";
import { getEcho, realtimeConfigured, type RealtimeStatus } from "@/lib/echo";
import type {
  GroupTrackingMember,
  GroupTrackingMeetup,
  GroupTrackingState,
  TrackingPosition,
} from "@/lib/types";

export type GroupTransport = "live" | "connecting" | "polling" | "off";

type ChannelPhase = "idle" | "subscribing" | "subscribed" | "failed";

interface MemberLocationPayload {
  user_id: number;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  heading?: number | null;
  speed?: number | null;
  recorded_at: string;
}

interface MemberSharingPayload {
  user_id: number;
  sharing: boolean;
  reason: string;
}

interface MemberPresencePayload {
  user_id: number;
  online: boolean;
  last_seen_at: string | null;
}

interface MemberArrivedPayload {
  user_id: number;
  name: string;
  stop_id: number;
  stop_title: string;
  arrived_at: string;
}

interface MeetupPinnedPayload {
  meetup: GroupTrackingMeetup;
}

interface UseGroupTrackingOptions {
  itineraryId: number;
  enabled: boolean;
  active: boolean;
  onMemberArrived?: (name: string, stopTitle: string) => void;
}

export interface UseGroupTrackingResult {
  state: GroupTrackingState | null;
  loading: boolean;
  error: string | null;
  message: string | null;
  busy: boolean;
  sharing: boolean;
  transport: GroupTransport;
  realtimeStatus: RealtimeStatus;
  refresh: () => Promise<void>;
  toggleSharing: (enabled: boolean) => Promise<boolean>;
  pinMeetup: (lat: number, lng: number, note: string) => Promise<GroupTrackingMeetup | null>;
}

function positionFromEvent(event: MemberLocationPayload): TrackingPosition {
  return {
    lat: event.lat,
    lng: event.lng,
    accuracy_m: event.accuracy_m,
    heading: event.heading,
    speed: event.speed,
    recorded_at: event.recorded_at,
  };
}

function clearMemberVisibility(member: GroupTrackingMember): GroupTrackingMember {
  return {
    ...member,
    sharing: member.is_me ? member.sharing : false,
    position: null,
    online: null,
    last_seen_at: null,
    distance_to_next_stop_m: null,
    arrived_stop: null,
  };
}

function mergeLocation(state: GroupTrackingState, event: MemberLocationPayload): GroupTrackingState {
  const isSelf = event.user_id === state.me.user_id;

  // Positions are only visible while the viewer is sharing too. A late event
  // that arrives after opting out must not repopulate the map.
  if (!state.me.sharing && !isSelf) return state;

  const position = positionFromEvent(event);

  return {
    ...state,
    me: isSelf ? { ...state.me, position, online: true } : state.me,
    members: state.members.map((member) =>
      member.user_id === event.user_id
        ? { ...member, position, online: true, last_seen_at: event.recorded_at }
        : member,
    ),
  };
}

function mergeSharing(state: GroupTrackingState, event: MemberSharingPayload): GroupTrackingState {
  const isSelf = event.user_id === state.me.user_id;

  if (isSelf && !event.sharing) {
    return {
      ...state,
      me: { ...state.me, sharing: false, position: null, online: false },
      members: state.members.map((member) => clearMemberVisibility(member)),
    };
  }

  return {
    ...state,
    me: isSelf ? { ...state.me, sharing: event.sharing } : state.me,
    members: state.members.map((member) =>
      member.user_id === event.user_id
        ? event.sharing
          ? { ...member, sharing: true }
          : clearMemberVisibility({ ...member, sharing: false })
        : member,
    ),
  };
}

function mergePresence(state: GroupTrackingState, event: MemberPresencePayload): GroupTrackingState {
  const isSelf = event.user_id === state.me.user_id;

  if (!state.me.sharing && !isSelf) return state;

  return {
    ...state,
    me: isSelf ? { ...state.me, online: event.online } : state.me,
    members: state.members.map((member) =>
      member.user_id === event.user_id
        ? { ...member, online: event.online, last_seen_at: event.last_seen_at ?? member.last_seen_at }
        : member,
    ),
  };
}

function mergeArrival(state: GroupTrackingState, event: MemberArrivedPayload): GroupTrackingState {
  const isSelf = event.user_id === state.me.user_id;

  if (!state.me.sharing && !isSelf) return state;

  return {
    ...state,
    members: state.members.map((member) =>
      member.user_id === event.user_id
        ? {
            ...member,
            arrived_stop: {
              id: event.stop_id,
              title: event.stop_title,
              at: event.arrived_at,
            },
          }
        : member,
    ),
  };
}

function mapRealtimeState(state: string): RealtimeStatus {
  if (state === "connected") return "connected";
  if (state === "connecting") return "connecting";
  if (state === "disconnected") return "disconnected";
  return "unavailable";
}

export function useGroupTracking({
  itineraryId,
  enabled,
  active,
  onMemberArrived,
}: UseGroupTrackingOptions): UseGroupTrackingResult {
  const [state, setState] = useState<GroupTrackingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [channelPhase, setChannelPhase] = useState<ChannelPhase>("idle");
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>(() =>
    realtimeConfigured() ? "disconnected" : "unavailable",
  );

  const selfIdRef = useRef<number | null>(null);
  const loadStateRef = useRef<() => Promise<void>>(async () => {});
  const arrivedCallbackRef = useRef(onMemberArrived);

  useEffect(() => {
    selfIdRef.current = state?.me.user_id ?? null;
  }, [state?.me.user_id]);

  useEffect(() => {
    arrivedCallbackRef.current = onMemberArrived;
  }, [onMemberArrived]);

  const refresh = useCallback(async () => {
    try {
      const next = await getGroupTracking(itineraryId);
      setState(next);
      setError(null);
    } catch (err) {
      setError(apiError(err));
    }
  }, [itineraryId]);

  useEffect(() => {
    loadStateRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getGroupTracking(itineraryId)
      .then((next) => {
        if (cancelled) return;
        setState(next);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(apiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, itineraryId]);

  const sharing = state?.me.sharing ?? false;

  // Polling fallback: every member who is not on a live socket (including
  // everyone who has not opted in) still needs the roster and meetup pin.
  useEffect(() => {
    if (!enabled) return;
    const live = sharing && channelPhase === "subscribed" && realtimeStatus === "connected";
    if (live) return;

    const seconds = Math.max(5, state?.poll_seconds ?? 10);
    const timer = window.setInterval(() => {
      void loadStateRef.current();
    }, seconds * 1000);

    return () => window.clearInterval(timer);
  }, [enabled, sharing, channelPhase, realtimeStatus, state?.poll_seconds]);

  // Drop the cached party view as soon as the trip stops being active.
  useEffect(() => {
    if (!enabled || active) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((current) => {
      if (current === null) return current;
      return {
        ...current,
        lifecycle_status: current.lifecycle_status === "active" ? "paused" : current.lifecycle_status,
        me: { ...current.me, sharing: false, position: null },
        members: current.members.map((member) => clearMemberVisibility(member)),
        meetup: null,
      };
    });
  }, [enabled, active]);

  useEffect(() => {
    if (!enabled || !active || !sharing) return;

    if (!realtimeConfigured()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChannelPhase("failed");
      return;
    }

    const token = window.localStorage.getItem("suroy.token");
    const echo = getEcho(token);
    if (echo === null) {
      setChannelPhase("failed");
      return;
    }

    const channelName = `itinerary.${itineraryId}.tracking`;
    const channel = echo.private(channelName);
    const connection = echo.connector.pusher.connection;

    const onStateChange = (change: { previous: string; current: string }) => {
      setRealtimeStatus(mapRealtimeState(change.current));
      if (change.current === "connected" && change.previous !== "connected") {
        // Reconnected after a tunnel/lock: reconcile anything missed.
        void loadStateRef.current();
      }
    };

    setChannelPhase("subscribing");
    connection.bind("state_change", onStateChange);
    setRealtimeStatus(mapRealtimeState(connection.state));

    channel.subscribed(() => {
      setChannelPhase("subscribed");
      setMessage((current) =>
        current?.startsWith("Live updates could not connect") ? null : current,
      );
    });

    channel.error(() => {
      setChannelPhase("failed");
      setMessage("Live updates could not connect. Refreshing every 10 seconds instead.");
    });

    channel.listen(".member.location", (event: MemberLocationPayload) => {
      setState((current) => (current === null ? current : mergeLocation(current, event)));
    });

    channel.listen(".member.sharing", (event: MemberSharingPayload) => {
      setState((current) => (current === null ? current : mergeSharing(current, event)));
    });

    channel.listen(".member.presence", (event: MemberPresencePayload) => {
      setState((current) => (current === null ? current : mergePresence(current, event)));
    });

    channel.listen(".member.arrived", (event: MemberArrivedPayload) => {
      setState((current) => (current === null ? current : mergeArrival(current, event)));
      if (event.user_id !== selfIdRef.current) {
        arrivedCallbackRef.current?.(event.name, event.stop_title);
      }
    });

    channel.listen(".meetup.pinned", (event: MeetupPinnedPayload) => {
      setState((current) => (current === null ? current : { ...current, meetup: event.meetup }));
    });

    return () => {
      connection.unbind("state_change", onStateChange);
      channel.stopListening(".member.location");
      channel.stopListening(".member.sharing");
      channel.stopListening(".member.presence");
      channel.stopListening(".member.arrived");
      channel.stopListening(".meetup.pinned");
      echo.leave(channelName);
      setChannelPhase("idle");
    };
  }, [enabled, active, sharing, itineraryId]);

  const toggleSharing = useCallback(
    async (nextEnabled: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const next = await setGroupSharing(itineraryId, nextEnabled);
        setState(next);
        setMessage(
          nextEnabled
            ? "Sharing your live location with the party."
            : "You stopped sharing. The party can no longer see your location.",
        );
        return true;
      } catch (err) {
        setError(apiError(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [itineraryId],
  );

  const pinMeetup = useCallback(
    async (lat: number, lng: number, note: string) => {
      setBusy(true);
      setError(null);
      try {
        const trimmed = note.trim();
        const meetup = await pinGroupMeetup(itineraryId, {
          lat,
          lng,
          note: trimmed === "" ? null : trimmed,
        });
        setState((current) => (current === null ? current : { ...current, meetup }));
        setMessage("Meeting pin dropped for the next 2 hours.");
        return meetup;
      } catch (err) {
        setError(apiError(err));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [itineraryId],
  );

  let transport: GroupTransport = "off";
  if (enabled && active) {
    if (!sharing) {
      transport = "polling";
    } else if (channelPhase === "subscribed" && realtimeStatus === "connected") {
      transport = "live";
    } else if (channelPhase === "failed" || realtimeStatus === "unavailable") {
      transport = "polling";
    } else {
      transport = "connecting";
    }
  }

  return {
    state,
    loading,
    error,
    message,
    busy,
    sharing,
    transport,
    realtimeStatus,
    refresh,
    toggleSharing,
    pinMeetup,
  };
}
