import { useEffect, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon, ExpandIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

interface ImageGalleryProps {
  images: string[];
  name: string;
  fallbackTone: string;
}

export function ImageGallery({ images, name, fallbackTone }: ImageGalleryProps) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const current = index % images.length;
  const go = (delta: number) => setIndex((prev) => (prev + delta + images.length) % images.length);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  const gallery = (
    <GalleryItem src={images[current]} name={name} fallbackTone={fallbackTone} className="h-full w-full object-cover" />
  );

  const dots = (
    <div className="flex justify-center gap-1.5" role="tablist" aria-label="Photo navigation">
      {images.map((_, dotIndex) => (
        <button
          key={dotIndex}
          type="button"
          role="tab"
          aria-selected={dotIndex === current}
          aria-label={`Photo ${dotIndex + 1} of ${images.length}`}
          onClick={() => setIndex(dotIndex)}
          className={cn(
            "h-1.5 rounded-full transition-all",
            dotIndex === current ? "w-5 bg-surf-400" : "w-1.5 bg-line hover:bg-ink-600/40",
          )}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="relative aspect-[4/3] max-h-[420px] overflow-hidden rounded-2xl ring-1 ring-line">
        {gallery}
        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-lagoon-950/45 text-sand-50 backdrop-blur-sm transition-colors hover:bg-lagoon-950/65"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-lagoon-950/45 text-sand-50 backdrop-blur-sm transition-colors hover:bg-lagoon-950/65"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          aria-label="View fullscreen"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-lagoon-950/45 text-sand-50 backdrop-blur-sm transition-colors hover:bg-lagoon-950/65"
        >
          <ExpandIcon className="h-5 w-5" />
        </button>
        {images.length > 1 ? <div className="absolute inset-x-0 bottom-3">{dots}</div> : null}
      </div>

      {images.length > 0 ? (
        <div className="flex gap-2 overflow-hidden">
          {images.map((image, thumbIndex) => (
            <button
              key={`${image}-${thumbIndex}`}
              type="button"
              onClick={() => setIndex(thumbIndex)}
              aria-label={`View photo ${thumbIndex + 1}`}
              aria-current={thumbIndex === current}
              className={cn(
                "aspect-[16/10] w-[calc((100%-2rem)/5)] shrink-0 overflow-hidden rounded-[10px] transition-all",
                thumbIndex === current ? "ring-2 ring-surf-400" : "opacity-70 ring-1 ring-line hover:opacity-100",
              )}
            >
              <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {fullscreen ? (
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-lagoon-950/95 p-4 pt-[calc(3.5rem_+_env(safe-area-inset-top))] sm:p-5 sm:pt-20"
          role="dialog"
          aria-modal="true"
          aria-label={`${name} photos`}
          onClick={() => setFullscreen(false)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setFullscreen(false);
            }}
            aria-label="Close photo viewer"
            className="fixed right-[max(12px,env(safe-area-inset-right))] top-[max(12px,env(safe-area-inset-top))] z-20 flex h-11 w-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-lagoon-950/20 bg-white text-[#111] shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-150 hover:scale-105 hover:bg-sand-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#14b8a6] focus-visible:ring-offset-2 focus-visible:ring-offset-lagoon-950 active:scale-95 sm:right-5 sm:top-5 sm:h-12 sm:w-auto sm:px-4"
          >
            <XIcon className="h-[22px] w-[22px] shrink-0 sm:h-6 sm:w-6" />
            <span className="hidden text-sm font-semibold sm:inline">Close</span>
          </button>

          <div className="relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <div className="overflow-hidden rounded-2xl">
              <div className="h-[80vh]">{gallery}</div>
            </div>
            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label="Previous photo"
                  className="absolute -left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-sand-50 backdrop-blur-sm transition-colors hover:bg-white/20 sm:-left-6"
                >
                  <ChevronLeftIcon className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label="Next photo"
                  className="absolute -right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-sand-50 backdrop-blur-sm transition-colors hover:bg-white/20 sm:-right-6"
                >
                  <ChevronRightIcon className="h-6 w-6" />
                </button>
              </>
            ) : null}
            <p className="mt-4 text-center text-sm font-semibold text-sand-50/80">
              {name} — photo {current + 1} of {images.length}
            </p>
            <div className="mt-2 flex justify-center gap-1.5">{dots}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GalleryItem({
  src,
  name,
  fallbackTone,
  className,
}: {
  src: string;
  name: string;
  fallbackTone: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return <div className={cn("h-full w-full bg-gradient-to-br", fallbackTone, className)} aria-hidden="true" />;
  }
  return (
    <img
      src={src}
      alt={`${name} photo`}
      loading="lazy"
      onError={() => setBroken(true)}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}