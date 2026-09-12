"use client";

import { useRef, useState, type CSSProperties, type PointerEvent, type ReactElement, type ReactNode } from "react";
import { cn } from "@beadloom/ui";
import {
  clampPanelFrame,
  movePanelFrame,
  resizePanelFrame,
  type PanelFrame,
  type PanelSizeLimits,
  type ResizeEdge
} from "./floating-panel-frame";

type FloatingAnchor = "top-right" | "bottom-right";

type FloatingChromePanelProps = {
  ariaLabel: string;
  title: string;
  defaultAnchor: FloatingAnchor;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  children: ReactNode;
  className?: string;
  testId?: string;
  onActivate?: () => void;
};

type PanelGesture = {
  kind: "move" | "resize";
  edge: ResizeEdge | null;
  pointerId: number;
  lastX: number;
  lastY: number;
};

const resizeHandles: { edge: ResizeEdge; className: string }[] = [
  { edge: "n", className: "top-0 right-2 left-2 h-1.5 cursor-n-resize" },
  { edge: "s", className: "right-2 bottom-0 left-2 h-1.5 cursor-s-resize" },
  { edge: "e", className: "top-2 right-0 bottom-2 w-1.5 cursor-e-resize" },
  { edge: "w", className: "top-2 bottom-2 left-0 w-1.5 cursor-w-resize" },
  { edge: "ne", className: "top-0 right-0 size-3 cursor-nesw-resize" },
  { edge: "nw", className: "top-0 left-0 size-3 cursor-nwse-resize" },
  { edge: "se", className: "right-0 bottom-0 size-3 cursor-nwse-resize" },
  { edge: "sw", className: "bottom-0 left-0 size-3 cursor-nesw-resize" }
];

function readParentBounds(node: HTMLElement | null): { width: number; height: number } {
  const parent = node?.offsetParent;
  if (!(parent instanceof HTMLElement)) {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  const rect = parent.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function measureFrame(node: HTMLElement, limits: PanelSizeLimits): PanelFrame {
  const parent = node.offsetParent;
  const panelRect = node.getBoundingClientRect();
  if (!(parent instanceof HTMLElement)) {
    return clampPanelFrame(
      { x: panelRect.left, y: panelRect.top, width: panelRect.width, height: panelRect.height },
      { width: window.innerWidth, height: window.innerHeight },
      limits
    );
  }
  const parentRect = parent.getBoundingClientRect();
  return clampPanelFrame(
    {
      x: panelRect.left - parentRect.left,
      y: panelRect.top - parentRect.top,
      width: panelRect.width,
      height: panelRect.height
    },
    { width: parentRect.width, height: parentRect.height },
    limits
  );
}

export function FloatingChromePanel({
  ariaLabel,
  title,
  defaultAnchor,
  defaultWidth,
  defaultHeight,
  minWidth,
  minHeight,
  children,
  className,
  testId,
  onActivate
}: FloatingChromePanelProps): ReactElement {
  const panelRef = useRef<HTMLElement>(null);
  const frameRef = useRef<PanelFrame | null>(null);
  const gestureRef = useRef<PanelGesture | null>(null);
  const [frame, setFrame] = useState<PanelFrame | null>(null);
  const limits: PanelSizeLimits = { minWidth, minHeight };
  frameRef.current = frame;

  function captureFrame(): PanelFrame {
    if (frameRef.current !== null) {
      return frameRef.current;
    }
    const node = panelRef.current;
    const next =
      node === null
        ? clampPanelFrame({ x: 0, y: 0, width: defaultWidth, height: defaultHeight }, readParentBounds(null), limits)
        : measureFrame(node, limits);
    frameRef.current = next;
    setFrame(next);
    return next;
  }

  function beginGesture(kind: PanelGesture["kind"], event: PointerEvent<HTMLElement>, edge: ResizeEdge | null): void {
    if (event.button !== 0) {
      return;
    }
    onActivate?.();
    captureFrame();
    gestureRef.current = { kind, edge, pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* jsdom and some browsers may not support pointer capture */
    }
  }

  function handleHeaderPointerDown(event: PointerEvent<HTMLElement>): void {
    beginGesture("move", event, null);
  }

  function handleResizePointerDown(edge: ResizeEdge, event: PointerEvent<HTMLElement>): void {
    event.stopPropagation();
    beginGesture("resize", event, edge);
  }

  function handleGesturePointerMove(event: PointerEvent<HTMLElement>): void {
    const gesture = gestureRef.current;
    if (gesture === null || gesture.pointerId !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - gesture.lastX;
    const deltaY = event.clientY - gesture.lastY;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    const current = frameRef.current ?? captureFrame();
    const bounds = readParentBounds(panelRef.current);
    const next =
      gesture.kind === "move" || gesture.edge === null
        ? movePanelFrame(current, deltaX, deltaY, bounds, limits)
        : resizePanelFrame(current, gesture.edge, deltaX, deltaY, bounds, limits);
    frameRef.current = next;
    setFrame(next);
  }

  function endGesture(event: PointerEvent<HTMLElement>): void {
    const gesture = gestureRef.current;
    if (gesture === null || gesture.pointerId !== event.pointerId) {
      return;
    }
    gestureRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer capture may already be released */
    }
  }

  const frameStyle: CSSProperties = {
    width: frame?.width ?? defaultWidth,
    height: frame?.height ?? defaultHeight,
    maxWidth: "calc(100% - var(--chrome-inset) * 2)",
    ...(frame === null
      ? defaultAnchor === "top-right"
        ? { top: "var(--chrome-below-header)", right: "var(--chrome-inset)" }
        : { bottom: "var(--chrome-inset)", right: "var(--chrome-inset)" }
      : { top: frame.y, left: frame.x, right: "auto", bottom: "auto" })
  };

  return (
    <aside
      aria-label={ariaLabel}
      className={cn(
        "glass-panel pointer-events-auto absolute flex min-h-0 flex-col overflow-hidden rounded-[var(--chrome-radius)]",
        className
      )}
      data-testid={testId}
      ref={panelRef}
      role="complementary"
      style={frameStyle}
      onPointerCancel={endGesture}
      onPointerDown={onActivate}
      onPointerMove={handleGesturePointerMove}
      onPointerUp={endGesture}
    >
      {resizeHandles.map((handle) => (
        <span
          aria-hidden="true"
          className={cn("absolute z-20 touch-none", handle.className)}
          data-testid={`floating-panel-resize-${handle.edge}`}
          key={handle.edge}
          onPointerDown={(event) => handleResizePointerDown(handle.edge, event)}
        />
      ))}
      <div
        className="relative z-10 flex h-9 shrink-0 cursor-grab items-center px-3 active:cursor-grabbing"
        data-testid="floating-panel-move"
        onPointerDown={handleHeaderPointerDown}
      >
        <h2 className="text-muted-foreground min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide">{title}</h2>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </aside>
  );
}
