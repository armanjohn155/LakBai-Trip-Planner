import { useCallback, useEffect, useRef, useState } from "react";

export function useCarouselScroll<T extends HTMLElement>() {
  const trackRef = useRef<T>(null);
  const restLeftRef = useRef(0);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanLeft(Math.abs(track.scrollLeft - restLeftRef.current) > 8);
    setCanRight(track.scrollLeft < track.scrollWidth - track.clientWidth - 8);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    restLeftRef.current = track.scrollLeft;
    updateArrows();
    track.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);
    return () => {
      track.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
      observer.disconnect();
    };
  }, [updateArrows]);

  const scrollBy = useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const gap = parseFloat(getComputedStyle(track).columnGap || "0") || 0;
    const firstCard = track.querySelector<HTMLElement>("[data-card]");
    const step = (firstCard?.offsetWidth ?? 320) + gap;
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  }, []);

  return { trackRef, canLeft, canRight, scrollBy };
}