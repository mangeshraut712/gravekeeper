"use client";

/** Decorative drifting fog for the graveyard. Hidden when the visitor prefers reduced motion. */
export default function FogOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden motion-reduce:hidden"
      aria-hidden="true"
      data-testid="fog-overlay"
    >
      <div className="fog-layer fog-layer-a" />
      <div className="fog-layer fog-layer-b" />
    </div>
  );
}
