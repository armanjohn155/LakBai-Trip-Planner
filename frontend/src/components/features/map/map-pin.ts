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