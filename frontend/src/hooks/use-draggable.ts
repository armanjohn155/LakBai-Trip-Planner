import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

interface Position {
  x: number;
  y: number;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface UseDraggableOptions {
  containerRef: RefObject<HTMLElement | null>;
  storageKey?: string;
  defaultPosition: (container: DOMRect, element: DOMRect) => Position;
  threshold?: number;
  padding?: number;
  onTap?: () => void;
}

function loadSavedPosition(key?: string): Position | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Position>;
    if (typeof parsed?.x === "number" && typeof parsed?.y === "number" && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // Ignore localStorage read errors
  }
  return null;
}

function savePosition(key: string | undefined, pos: Position): void {
  if (!key || typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(pos));
  } catch {
    // Ignore localStorage write errors
  }
}

export function useDraggable<T extends HTMLElement = HTMLElement>({
  containerRef,
  storageKey,
  defaultPosition,
  threshold = 5,
  padding = 12,
  onTap,
}: UseDraggableOptions) {
  const targetRef = useRef<T | null>(null);
  const [position, setPosition] = useState<Position | null>(() => loadSavedPosition(storageKey));
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef<{ pointerX: number; pointerY: number; startX: number; startY: number } | null>(null);
  const hasMovedPastThresholdRef = useRef(false);
  const justDraggedRef = useRef(false);
  const clearJustDraggedTimerRef = useRef<number | null>(null);

  const positionRef = useRef<Position | null>(position);
  positionRef.current = position;

  const calculateBounds = useCallback((): { bounds: Bounds; containerRect: DOMRect; targetRect: DOMRect } | null => {
    const container = containerRef.current;
    const target = targetRef.current;
    if (!container || !target) return null;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const minX = padding;
    const maxX = Math.max(minX, containerRect.width - targetRect.width - padding);
    const minY = padding;
    const maxY = Math.max(minY, containerRect.height - targetRect.height - padding);

    return { bounds: { minX, maxX, minY, maxY }, containerRect, targetRect };
  }, [containerRef, padding]);

  const clampPosition = useCallback(
    (pos: Position, bounds: Bounds): Position => ({
      x: Math.min(Math.max(pos.x, bounds.minX), bounds.maxX),
      y: Math.min(Math.max(pos.y, bounds.minY), bounds.maxY),
    }),
    [],
  );

  // Initialize or re-clamp position when container/element is measured or resized
  const recheckPosition = useCallback(() => {
    const data = calculateBounds();
    if (!data) return;
    const { bounds, containerRect, targetRect } = data;

    setPosition((current) => {
      if (current) {
        return clampPosition(current, bounds);
      }
      const def = defaultPosition(containerRect, targetRect);
      return clampPosition(def, bounds);
    });
  }, [calculateBounds, clampPosition, defaultPosition]);

  useEffect(() => {
    recheckPosition();

    const handleResize = () => {
      recheckPosition();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      if (clearJustDraggedTimerRef.current !== null) {
        window.clearTimeout(clearJustDraggedTimerRef.current);
      }
    };
  }, [recheckPosition]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<T>) => {
      if (event.button !== 0) return;
      event.stopPropagation();

      const target = targetRef.current;
      if (!target) return;

      const data = calculateBounds();
      if (!data) return;

      const currentPos = positionRef.current ?? defaultPosition(data.containerRect, data.targetRect);

      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Ignore pointer capture errors
      }

      dragStartRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        startX: currentPos.x,
        startY: currentPos.y,
      };
      hasMovedPastThresholdRef.current = false;
      justDraggedRef.current = false;
    },
    [calculateBounds, defaultPosition],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<T>) => {
      const dragStart = dragStartRef.current;
      if (!dragStart) return;

      event.stopPropagation();

      const deltaX = event.clientX - dragStart.pointerX;
      const deltaY = event.clientY - dragStart.pointerY;
      const distance = Math.hypot(deltaX, deltaY);

      if (!hasMovedPastThresholdRef.current && distance >= threshold) {
        hasMovedPastThresholdRef.current = true;
        justDraggedRef.current = true;
        setIsDragging(true);
      }

      if (hasMovedPastThresholdRef.current) {
        const data = calculateBounds();
        if (!data) return;

        const nextPos = clampPosition(
          {
            x: dragStart.startX + deltaX,
            y: dragStart.startY + deltaY,
          },
          data.bounds,
        );

        setPosition(nextPos);
      }
    },
    [calculateBounds, clampPosition, threshold],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<T>) => {
      const dragStart = dragStartRef.current;
      if (!dragStart) return;

      event.stopPropagation();

      const target = targetRef.current;
      if (target) {
        try {
          if (target.hasPointerCapture(event.pointerId)) {
            target.releasePointerCapture(event.pointerId);
          }
        } catch {
          // Ignore release errors
        }
      }

      const didDrag = hasMovedPastThresholdRef.current;
      dragStartRef.current = null;
      setIsDragging(false);

      if (didDrag) {
        if (positionRef.current) {
          savePosition(storageKey, positionRef.current);
        }
        // Keep justDraggedRef true briefly to swallow the immediately following click event
        if (clearJustDraggedTimerRef.current !== null) {
          window.clearTimeout(clearJustDraggedTimerRef.current);
        }
        clearJustDraggedTimerRef.current = window.setTimeout(() => {
          justDraggedRef.current = false;
        }, 120);
      } else {
        justDraggedRef.current = false;
      }
    },
    [storageKey],
  );

  const onPointerCancel = useCallback(
    (event: React.PointerEvent<T>) => {
      event.stopPropagation();
      const target = targetRef.current;
      if (target) {
        try {
          if (target.hasPointerCapture(event.pointerId)) {
            target.releasePointerCapture(event.pointerId);
          }
        } catch {
          // Ignore
        }
      }
      dragStartRef.current = null;
      hasMovedPastThresholdRef.current = false;
      justDraggedRef.current = false;
      setIsDragging(false);
    },
    [],
  );

  const onClick = useCallback(
    (event: React.MouseEvent<T>) => {
      event.stopPropagation();
      if (justDraggedRef.current) {
        event.preventDefault();
        justDraggedRef.current = false;
        return;
      }
      onTap?.();
    },
    [onTap],
  );

  return {
    ref: targetRef,
    position,
    isDragging,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClick,
    },
  };
}
