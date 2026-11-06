import { useState } from "react";

import { cn } from "@/lib/cn";
import {
  clampHour,
  clampMinute,
  formatOpeningHours,
  hasCloseTime,
  hasOpenTime,
  isCloseTimeComplete,
  isOpenTimeComplete,
  OPEN_24_HOURS,
  parseOpeningHours,
  sanitizeHour,
  sanitizeMinute,
  type Meridiem,
  type OpeningHoursFields,
} from "@/lib/opening-hours";

interface OpeningHoursInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

interface TimeFieldProps {
  label: string;
  hour: string;
  minute: string;
  meridiem: Meridiem;
  disabled: boolean;
  onHourChange: (value: string) => void;
  onMinuteChange: (value: string) => void;
  onMeridiemChange: (value: Meridiem) => void;
  onHourBlur: () => void;
  onMinuteBlur: () => void;
}

export function OpeningHoursInput({ value, onChange, error }: OpeningHoursInputProps) {
  const initial = parseOpeningHours(value);
  const [fields, setFields] = useState<OpeningHoursFields>(initial.fields);
  const [unparsed, setUnparsed] = useState<string | null>(initial.unparsed);
  const [localError, setLocalError] = useState<string | null>(null);

  const update = (patch: Partial<OpeningHoursFields>) => {
    const next = { ...fields, ...patch };
    setFields(next);
    setUnparsed(null);

    if (next.is24Hours) {
      setLocalError(null);
      onChange(OPEN_24_HOURS);
      return;
    }

    const openStarted = hasOpenTime(next);
    const closeStarted = hasCloseTime(next);

    if (!openStarted && !closeStarted) {
      setLocalError(null);
      onChange("");
      return;
    }

    if (openStarted && !isOpenTimeComplete(next)) {
      setLocalError("Add the opening hour and minute.");
      onChange("");
      return;
    }

    if (closeStarted && !isCloseTimeComplete(next)) {
      setLocalError("Add the closing hour and minute.");
      onChange("");
      return;
    }

    if (openStarted && !closeStarted) {
      setLocalError("Add a closing time or leave both times empty.");
      onChange("");
      return;
    }

    if (closeStarted && !openStarted) {
      setLocalError("Add an opening time or leave both times empty.");
      onChange("");
      return;
    }

    setLocalError(null);
    onChange(formatOpeningHours(next));
  };

  const shownError = error || localError;

  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-sm font-semibold text-ink-900">Opening hours</label>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-ink-700">
          <input
            type="checkbox"
            checked={fields.is24Hours}
            onChange={(event) =>
              update({
                is24Hours: event.target.checked,
                ...(event.target.checked
                  ? { openHour: "", openMinute: "", closeHour: "", closeMinute: "" }
                  : {}),
              })
            }
            className="h-4 w-4 rounded accent-surf-400"
          />
          Open 24 hours
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TimeField
          label="Opens"
          hour={fields.openHour}
          minute={fields.openMinute}
          meridiem={fields.openMeridiem}
          disabled={fields.is24Hours}
          onHourChange={(next) => update({ openHour: sanitizeHour(next) })}
          onMinuteChange={(next) => update({ openMinute: sanitizeMinute(next) })}
          onMeridiemChange={(next) => update({ openMeridiem: next })}
          onHourBlur={() => {
            const next = clampHour(fields.openHour);
            if (next !== fields.openHour) update({ openHour: next });
          }}
          onMinuteBlur={() => {
            const next = clampMinute(fields.openMinute);
            if (next !== fields.openMinute) update({ openMinute: next });
          }}
        />
        <TimeField
          label="Closes"
          hour={fields.closeHour}
          minute={fields.closeMinute}
          meridiem={fields.closeMeridiem}
          disabled={fields.is24Hours}
          onHourChange={(next) => update({ closeHour: sanitizeHour(next) })}
          onMinuteChange={(next) => update({ closeMinute: sanitizeMinute(next) })}
          onMeridiemChange={(next) => update({ closeMeridiem: next })}
          onHourBlur={() => {
            const next = clampHour(fields.closeHour);
            if (next !== fields.closeHour) update({ closeHour: next });
          }}
          onMinuteBlur={() => {
            const next = clampMinute(fields.closeMinute);
            if (next !== fields.closeMinute) update({ closeMinute: next });
          }}
        />
      </div>

      {shownError ? <p className="text-sm text-red-600">{shownError}</p> : null}
      {unparsed ? (
        <p className="text-sm text-ink-600">
          Saved value: “{unparsed}”. Set the times below to replace it.
        </p>
      ) : null}
    </div>
  );
}

function TimeField({
  label,
  hour,
  minute,
  meridiem,
  disabled,
  onHourChange,
  onMinuteChange,
  onMeridiemChange,
  onHourBlur,
  onMinuteBlur,
}: TimeFieldProps) {
  const inputClass = cn(
    "h-12 w-14 rounded-xl bg-white/70 px-2 text-center text-base text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-600/50 focus:outline-none focus:ring-2 focus:ring-surf-400",
    disabled && "opacity-50",
  );

  return (
    <div className={cn("rounded-2xl bg-white/50 p-3 ring-1 ring-inset ring-line", disabled && "opacity-60")}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-600">{label}</p>
      <div className="flex items-center gap-1.5">
        <input
          aria-label={`${label} hour`}
          inputMode="numeric"
          maxLength={2}
          placeholder="8"
          value={hour}
          disabled={disabled}
          onChange={(event) => onHourChange(event.target.value)}
          onBlur={onHourBlur}
          className={inputClass}
        />
        <span className="text-lg font-semibold text-ink-600">:</span>
        <input
          aria-label={`${label} minute`}
          inputMode="numeric"
          maxLength={2}
          placeholder="00"
          value={minute}
          disabled={disabled}
          onChange={(event) => onMinuteChange(event.target.value)}
          onBlur={onMinuteBlur}
          className={inputClass}
        />
        <select
          aria-label={`${label} AM or PM`}
          value={meridiem}
          disabled={disabled}
          onChange={(event) => onMeridiemChange(event.target.value as Meridiem)}
          className={cn(
            "h-12 w-20 rounded-xl bg-white/70 px-2 text-base font-semibold text-ink-900 ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-surf-400",
            disabled && "opacity-50",
          )}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}
