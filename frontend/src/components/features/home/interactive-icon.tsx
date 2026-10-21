import { useRef } from "react";
import type { ComponentType, KeyboardEvent, MouseEvent } from "react";

import { cn } from "@/lib/cn";

import { ICON_ORDER, type IconAction } from "./icon-tabs";

export type { IconAction } from "./icon-tabs";

/**
 * Interactive icon quick-action row.
 *
 * First pass based on the Figma frame:
 *   - Five 86 × 73 icon buttons with 1px #9CA3AF borders and #1E2A4A icons
 *   - The tab row sits on the page's cream band (#F5F3EE); the cyan canvas
 *     (#E0F7F7) is the panel card below it.
 *
 * The row is a horizontal track: the active tab is translated to the centre
 * of the viewport, and the viewport's edges fade so tabs can slide in/out.
 * Keep the transitions in sync with the panel carousel in feature-section.tsx.
 */

type IconComponent = ComponentType<{ className?: string }>;

interface IconButtonConfig {
  action: IconAction;
  /** Used for both the aria-label and the native title tooltip. */
  label: string;
  Icon: IconComponent;
}

// ── Design tokens ────────────────────────────────────────────────────────
const BUTTON_WIDTH = 86;
const BUTTON_HEIGHT = 73;
const BUTTON_GAP = 45;

const ICON_STEP = BUTTON_WIDTH + BUTTON_GAP;
const ICON_ROW_WIDTH = 5 * BUTTON_WIDTH + 4 * BUTTON_GAP;

// Desktop viewport wide enough to keep all five buttons visible while any tab
// is centred; it shrinks with the container on smaller screens.
const ICON_VIEWPORT_WIDTH = ICON_ROW_WIDTH + ICON_STEP * 2;

const ICON_COMPONENTS: Record<IconAction, Omit<IconButtonConfig, "action">> = {
  map: { label: "Map", Icon: MapPinnedIcon },
  route: { label: "Route", Icon: RouteIcon },
  pricing: { label: "Pricing", Icon: DollarIcon },
  list: { label: "List", Icon: ListIcon },
  assistant: { label: "Assistant", Icon: BotIcon },
};

const ICON_BUTTONS: IconButtonConfig[] = ICON_ORDER.map((action) => ({
  action,
  ...ICON_COMPONENTS[action],
}));

// ── Placeholder actions ──────────────────────────────────────────────────
// TODO: Replace each console.log with the real feature behaviour.
function handleMap() {
  console.log("[interactive-icon] map");
}

function handleRoute() {
  console.log("[interactive-icon] route");
}

function handlePricing() {
  console.log("[interactive-icon] pricing");
}

function handleList() {
  console.log("[interactive-icon] list");
}

function handleAssistant() {
  console.log("[interactive-icon] assistant");
}

const iconHandlers: Record<IconAction, () => void> = {
  map: handleMap,
  route: handleRoute,
  pricing: handlePricing,
  list: handleList,
  assistant: handleAssistant,
};

/** One shared click handler: reads data-action, runs its placeholder, selects the tab. */
function handleIconClick(event: MouseEvent<HTMLButtonElement>, onSelect: (action: IconAction) => void) {
  const action = event.currentTarget.dataset.action as IconAction | undefined;

  if (!action) return;

  iconHandlers[action]();
  onSelect(action);
}

// ── Section ──────────────────────────────────────────────────────────────
interface InteractiveIconSectionProps {
  value: IconAction;
  onChange: (action: IconAction) => void;
  panelId: string;
}

export function InteractiveIconSection({ value, onChange, panelId }: InteractiveIconSectionProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeIndex = Math.max(0, ICON_ORDER.indexOf(value));

  // Distance from the track's first button edge to the active button centre.
  // Moving the track left by this amount puts the active icon at 50% (centre).
  const centreOffset = activeIndex * ICON_STEP + BUTTON_WIDTH / 2;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = ICON_ORDER.length - 1;
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = index === lastIndex ? 0 : index + 1;
        break;
      case "ArrowLeft":
        nextIndex = index === 0 ? lastIndex : index - 1;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    onChange(ICON_ORDER[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <section aria-labelledby="interactive-icon-heading" className="overflow-hidden bg-[#F5F3EE]">
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
        <h2 id="interactive-icon-heading" className="sr-only">
          Quick actions
        </h2>

        {/* The mask fades tabs that slide past the left/right edges. */}
        <div
          className="relative mx-auto overflow-hidden"
          style={{
            maxWidth: ICON_VIEWPORT_WIDTH,
            maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          }}
        >
          {/*
            The track starts at 50% of the viewport (margin-left) and is pulled
            left by centreOffset. Same duration/easing as the panel track so the
            icon and its panel move together.
          */}
          <div
            role="tablist"
            aria-label="Feature previews"
            className="flex w-max items-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              gap: BUTTON_GAP,
              marginLeft: "50%",
              transform: `translateX(-${centreOffset}px)`,
            }}
          >
            {ICON_BUTTONS.map(({ action, label, Icon }, index) => {
              const isActive = action === value;

              return (
                <button
                  key={action}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`${panelId}-tab-${action}`}
                  aria-selected={isActive}
                  aria-controls={panelId}
                  tabIndex={isActive ? 0 : -1}
                  data-action={action}
                  aria-label={label}
                  title={label}
                  onClick={(event) => handleIconClick(event, onChange)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  style={{ width: BUTTON_WIDTH, height: BUTTON_HEIGHT }}
                  className={cn(
                    "inline-flex shrink-0 items-center justify-center rounded-md",
                    "border bg-white text-[#1E2A4A]",
                    "transition-[transform,box-shadow,border-color] duration-150 ease-out",
                    isActive
                      ? "border-[#1E2A4A] shadow-[0_4px_12px_rgba(30,42,74,0.12)]"
                      : "border-[#9CA3AF]",
                    "hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(30,42,74,0.18)]",
                    "active:translate-y-px active:shadow-none",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E2A4A]",
                    "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                  )}
                >
                  <Icon className="h-6 w-6" />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Inline SVG icons (Lucide-style geometry, self-contained) ─────────────
const svgIconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function MapPinnedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgIconProps} aria-hidden="true">
      <path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0" />
      <path d="M4.474 15h-.197a1 1 0 0 0-.969.753l-1.097 4.35a1.5 1.5 0 0 0 1.444 1.898L20.344 22a1.5 1.5 0 0 0 1.446-1.897l-1.098-4.35a1 1 0 0 0-.969-.753h-.197" />
      <circle cx="12" cy="8" r="2" />
    </svg>
  );
}

function RouteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgIconProps} aria-hidden="true">
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </svg>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgIconProps} aria-hidden="true">
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgIconProps} aria-hidden="true">
      <path d="M3 5h.01" />
      <path d="M3 12h.01" />
      <path d="M3 19h.01" />
      <path d="M8 5h13" />
      <path d="M8 12h13" />
      <path d="M8 19h13" />
    </svg>
  );
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...svgIconProps} aria-hidden="true">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}
