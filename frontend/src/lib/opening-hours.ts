export const OPEN_24_HOURS = "Open 24 hours";

export type Meridiem = "AM" | "PM";

export interface OpeningHoursFields {
  openHour: string;
  openMinute: string;
  openMeridiem: Meridiem;
  closeHour: string;
  closeMinute: string;
  closeMeridiem: Meridiem;
  is24Hours: boolean;
}

export const EMPTY_OPENING_HOURS: OpeningHoursFields = {
  openHour: "",
  openMinute: "",
  openMeridiem: "AM",
  closeHour: "",
  closeMinute: "",
  closeMeridiem: "PM",
  is24Hours: false,
};

const TIME_PATTERN = /^(\d{1,2})(?::(\d{2}))?\s*([AP]M)$/i;
const RANGE_PATTERN = /^(.*?)\s*(?:-|–|—|to)\s*(.*?)$/i;

function parseTime(value: string): { hour: string; minute: string; meridiem: Meridiem } | null {
  const match = value.trim().match(TIME_PATTERN);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");

  if (!Number.isInteger(hour) || hour < 1 || hour > 12) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;

  return {
    hour: String(hour),
    minute: String(minute).padStart(2, "0"),
    meridiem: match[3].toUpperCase() as Meridiem,
  };
}

export function parseOpeningHours(value: string | null | undefined): {
  fields: OpeningHoursFields;
  unparsed: string | null;
} {
  const raw = (value ?? "").trim();

  if (!raw) {
    return { fields: EMPTY_OPENING_HOURS, unparsed: null };
  }

  if (/^(open\s*)?24\s*(hours?|hrs?)$/i.test(raw)) {
    return { fields: { ...EMPTY_OPENING_HOURS, is24Hours: true }, unparsed: null };
  }

  const range = raw.match(RANGE_PATTERN);
  if (range) {
    const open = parseTime(range[1]);
    const close = parseTime(range[2]);

    if (open && close) {
      return {
        fields: {
          openHour: open.hour,
          openMinute: open.minute,
          openMeridiem: open.meridiem,
          closeHour: close.hour,
          closeMinute: close.minute,
          closeMeridiem: close.meridiem,
          is24Hours: false,
        },
        unparsed: null,
      };
    }
  }

  return { fields: EMPTY_OPENING_HOURS, unparsed: raw };
}

export function hasOpenTime(fields: OpeningHoursFields): boolean {
  return Boolean(fields.openHour || fields.openMinute);
}

export function hasCloseTime(fields: OpeningHoursFields): boolean {
  return Boolean(fields.closeHour || fields.closeMinute);
}

function isValidHour(value: string): boolean {
  const hour = Number(value);
  return Number.isInteger(hour) && hour >= 1 && hour <= 12;
}

function isValidMinute(value: string): boolean {
  const minute = Number(value);
  return Number.isInteger(minute) && minute >= 0 && minute <= 59;
}

export function isOpenTimeComplete(fields: OpeningHoursFields): boolean {
  return isValidHour(fields.openHour) && isValidMinute(fields.openMinute);
}

export function isCloseTimeComplete(fields: OpeningHoursFields): boolean {
  return isValidHour(fields.closeHour) && isValidMinute(fields.closeMinute);
}

export function formatOpeningHours(fields: OpeningHoursFields): string {
  if (fields.is24Hours) return OPEN_24_HOURS;
  if (!hasOpenTime(fields) && !hasCloseTime(fields)) return "";
  if (!isOpenTimeComplete(fields) || !isCloseTimeComplete(fields)) return "";

  const openHour = String(Number(fields.openHour));
  const closeHour = String(Number(fields.closeHour));
  const openMinute = String(Number(fields.openMinute)).padStart(2, "0");
  const closeMinute = String(Number(fields.closeMinute)).padStart(2, "0");

  return `${openHour}:${openMinute} ${fields.openMeridiem} - ${closeHour}:${closeMinute} ${fields.closeMeridiem}`;
}

export function sanitizeHour(value: string): string {
  return value.replace(/\D/g, "").slice(0, 2);
}

export function sanitizeMinute(value: string): string {
  return value.replace(/\D/g, "").slice(0, 2);
}

export function clampHour(value: string): string {
  if (!value) return "";

  const hour = Number(value);
  if (!Number.isFinite(hour) || hour < 1) return "12";
  if (hour > 12) return "12";

  return String(hour);
}

export function clampMinute(value: string): string {
  if (!value) return "";

  const minute = Number(value);
  if (!Number.isFinite(minute) || minute < 0) return "00";
  if (minute > 59) return "59";

  return String(minute).padStart(2, "0");
}
