import { useCallback, useEffect, useRef, useState } from "react";

type DragState = {
  pointerId: number | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  dragging: boolean;
};

type UseTouchDragOptions = {
  disabled?: boolean;
  onMove?: (dx: number, dy: number) => void;
  onDrop?: () => void;
};

export function useTouchDrag({
  disabled = false,
  onMove,
  onDrop,
}: UseTouchDragOptions) {
  const [dragState, setDragState] = useState<DragState>({
    pointerId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    dragging: false,
  });

  const elementRef = useRef<HTMLElement | null>(null);

  const reset = useCallback(() => {
    setDragState({
      pointerId: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      dragging: false,
    });
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);

      setDragState({
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        dragging: true,
      });
    },
    [disabled],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled) return;
      if (!dragState.pointerId || dragState.pointerId !== event.pointerId) return;

      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;

      setDragState((current) => ({
        ...current,
        currentX: event.clientX,
        currentY: event.clientY,
      }));

      onMove?.(dx, dy);
    },
    [disabled, dragState.pointerId, dragState.startX, dragState.startY, onMove],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled) return;
      if (!dragState.pointerId || dragState.pointerId !== event.pointerId) return;

      setDragState((current) => ({
        ...current,
        pointerId: null,
        dragging: false,
      }));

      onDrop?.();
    },
    [disabled, dragState.pointerId, onDrop],
  );

  useEffect(() => {
    if (!elementRef.current) return;
    const element = elementRef.current;
    element.style.touchAction = "none";
    return () => {
      element.style.touchAction = "";
    };
  }, []);

  return {
    dragState,
    elementRef,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: reset,
    },
  };
}
