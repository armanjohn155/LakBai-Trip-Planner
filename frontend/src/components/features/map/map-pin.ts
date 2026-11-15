import L from "leaflet";

const TEAL = "#2fb8a6";
const MANGO = "#f6b01e";
const DARK = "#0b3038";

const pinSvg = (active: boolean): string => {
  const head = active ? MANGO : TEAL;
  const inner = DARK;
  return `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M13 1C6.8 1 2 7.7 2 13.9 2 23 13 33 13 33s11-10 11-19.1C24 7.7 19.2 1 13 1z" fill="${head}"/>
    <circle cx="13" cy="14" r="4.3" fill="${inner}"/>
    <circle cx="13" cy="14" r="1.9" fill="#f7f9f8"/>
  </svg>`;
};

export const createPinIcon = (active = false): L.DivIcon =>
  L.divIcon({
    className: `suroy-pin${active ? " is-active" : ""}`,
    html: pinSvg(active),
    iconSize: [26, 34],
    iconAnchor: [13, 32],
  });

export const defaultPin = createPinIcon(false);
export const activePin = createPinIcon(true);

const dayColors = ["#2fb8a6", "#f6b01e", "#6d5efc", "#ef5da8", "#3f8efc", "#22c55e", "#f97316", "#14b8a6"];

/** A fixed colour per day number so day polylines and markers match. */
export const dayColor = (dayNumber: number): string => dayColors[(Math.max(dayNumber, 1) - 1) % dayColors.length];

const numberedPinSvg = (label: number, color: string): string => `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M15 1C7.8 1 2 6.9 2 14.7 2 25.4 15 39 15 39s13-13.6 13-24.3C28 6.9 22.2 1 15 1z" fill="${color}"/>
    <circle cx="15" cy="15" r="8.2" fill="#f7f9f8"/>
    <text x="15" y="19.4" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-weight="700" fill="#0b3038">${label}</text>
  </svg>`;

export const createNumberedPin = (label: number, color: string, active = false): L.DivIcon =>
  L.divIcon({
    className: `suroy-pin${active ? " is-active" : ""}`,
    html: numberedPinSvg(label, color),
    iconSize: [30, 40],
    iconAnchor: [15, 38],
  });

const memberColors = ["#e11d48", "#7c3aed", "#0284c7", "#16a34a", "#d97706", "#db2777", "#4f46e5", "#0d9488", "#b45309", "#9333ea"];

/** A stable, distinct colour per traveller so markers and the party list match. */
export const memberColor = (userId: number): string =>
  memberColors[Math.abs(Math.trunc(userId)) % memberColors.length];

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();
};

interface MemberPinOptions {
  name: string;
  color: string;
  stale?: boolean;
}

/** Initials bubble for a sharing traveller; fades when their ping is stale. */
export const createMemberPin = ({ name, color, stale = false }: MemberPinOptions): L.DivIcon =>
  L.divIcon({
    className: `trip-member-marker${stale ? " is-stale" : ""}`,
    html: `<span class="trip-member-marker__dot" style="--member-color:${color}">${escapeHtml(initials(name))}</span><span class="trip-member-marker__label">${escapeHtml(name)}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

/** Temporary "meet here" pin. */
export const meetupPin = L.divIcon({
  className: "trip-meetup-marker",
  html: '<span class="trip-meetup-marker__pin">M</span><span class="trip-meetup-marker__label">Meet here</span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});