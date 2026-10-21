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

export const createNumberedPin = (label: number, color: string): L.DivIcon =>
  L.divIcon({
    className: "suroy-pin",
    html: numberedPinSvg(label, color),
    iconSize: [30, 40],
    iconAnchor: [15, 38],
  });