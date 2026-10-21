import { useState } from "react";
import type { ComponentType } from "react";

import { cn } from "@/lib/cn";

import { ICON_ORDER, type IconAction } from "./icon-tabs";
import { InteractiveIconSection } from "./interactive-icon";
import { AssistantPanel } from "./panels/assistant-panel";
import { BudgetPanel } from "./panels/budget-panel";
import { ItineraryPanel } from "./panels/itinerary-panel";
import { MapPanel } from "./panels/map-panel";
import { RoutePanel } from "./panels/route-panel";

/** Shared by the tabs (aria-controls) and the panel wrapper (id). */
const PANEL_ID = "home-feature-panel";

interface PanelDefinition {
  heading: string;
  Panel: ComponentType;
}

// Keyed by IconAction so adding a tab forces one panel entry here.
const PANEL_DEFINITIONS: Record<IconAction, PanelDefinition> = {
  map: { heading: "View your trip on a map", Panel: MapPanel },
  route: { heading: "Optimize your route", Panel: RoutePanel },
  pricing: { heading: "Track your budget", Panel: BudgetPanel },
  list: { heading: "Plan your itinerary", Panel: ItineraryPanel },
  assistant: { heading: "Ask the assistant", Panel: AssistantPanel },
};

// Follows the icon order, so tab and panel indexes always line up.
const PANELS = ICON_ORDER.map((action) => ({ action, ...PANEL_DEFINITIONS[action] }));

export function FeatureSection() {
  const [active, setActive] = useState<IconAction>("route");

  const activeIndex = Math.max(0, ICON_ORDER.indexOf(active));
  const activeTabId = `${PANEL_ID}-tab-${active}`;

  return (
    <>
      <InteractiveIconSection value={active} onChange={setActive} panelId={PANEL_ID} />

      <section aria-labelledby="feature-panels-heading" className="bg-[#F5F3EE] pb-16 sm:pb-20">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
          <h2 id="feature-panels-heading" className="sr-only">
            Feature previews
          </h2>

          <div id={PANEL_ID} role="tabpanel" aria-labelledby={activeTabId} className="overflow-hidden">
            {/*
              Each slide is w-full + shrink-0, so the flex track stays one
              viewport wide. translateX(-index * 100%) therefore means "move
              forward by `index` whole panels" — skipping map → list glides
              across all three positions in one 500ms move, instead of
              stepping through the panels in between.
            */}
            <div
              className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              {PANELS.map(({ action, heading, Panel }, index) => {
                const isActive = index === activeIndex;

                return (
                  <div
                    key={action}
                    aria-hidden={!isActive}
                    inert={!isActive}
                    className={cn(
                      "w-full shrink-0",
                      "transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      isActive ? "scale-100 opacity-100" : "scale-[0.98] opacity-60",
                      "motion-reduce:scale-100 motion-reduce:transition-none",
                    )}
                  >
                    <h3 className="mb-4 text-center font-display text-2xl font-medium tracking-tight text-lagoon-900 sm:mb-5 sm:text-3xl">
                      {heading}
                    </h3>

                    {/* Fixed heights keep the page from jumping between tabs. */}
                    <div className="flex h-[300px] items-center justify-center overflow-hidden rounded-3xl bg-[#E0F7F7] p-4 sm:h-[420px] sm:p-8 lg:h-[520px]">
                      <Panel />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
