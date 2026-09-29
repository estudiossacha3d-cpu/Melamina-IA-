import { useState, useRef, useCallback, useEffect } from 'react';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface UseDraggableWindowOptions {
  defaultPosition?: Position | (() => Position);
  defaultSize?: Size | (() => Size);
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  storageKey?: string;
  minVisibleX?: number;
  minVisibleY?: number;
}

export function useDraggableWindow({
  defaultPosition,
  defaultSize,
  minWidth = 200,
  minHeight = 140,
  maxWidth,
  maxHeight,
  storageKey,
  minVisibleX = 60,
  minVisibleY = 40
}: UseDraggableWindowOptions = {}) {
  const getDefaultPos = useCallback((): Position => {
    if (typeof defaultPosition === 'function') {
      return defaultPosition();
    }
    if (defaultPosition) {
      return defaultPosition;
    }
    return { x: 20, y: 60 };
  }, [defaultPosition]);

  const getDefaultSize = useCallback((): Size => {
    if (typeof defaultSize === 'function') {
      return defaultSize();
    }
    if (defaultSize) {
      return defaultSize;
    }
    return { width: 300, height: 380 };
  }, [defaultSize]);

  // Position state
  const [position, setPosition] = useState<Position>(() => {
    if (typeof window === 'undefined') return { x: 20, y: 60 };
    if (storageKey) {
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
            return {
              x: Math.min(window.innerWidth - minVisibleX, Math.max(0, parsed.x)),
              y: Math.min(window.innerHeight - minVisibleY, Math.max(30, parsed.y))
            };
          }
        }
      } catch (err) {}
    }
    return getDefaultPos();
  });

  // Size state
  const [size, setSize] = useState<Size>(() => {
    if (typeof window === 'undefined') return { width: 300, height: 380 };
    if (storageKey) {
      try {
        const saved = sessionStorage.getItem(`${storageKey}_size`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.width === 'number' && typeof parsed?.height === 'number') {
            return {
              width: Math.min(window.innerWidth - 10, Math.max(minWidth, parsed.width)),
              height: Math.min(window.innerHeight - 30, Math.max(minHeight, parsed.height))
            };
          }
        }
      } catch (err) {}
    }
    return getDefaultSize();
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ pointerX: 0, pointerY: 0, posX: 0, posY: 0 });

  const isResizingRef = useRef(false);
  const resizeDirectionRef = useRef<'corner' | 'right' | 'bottom' | 'left'>('corner');
  const resizeStartRef = useRef({ pointerX: 0, pointerY: 0, width: 0, height: 0, posX: 0 });

  // Update bounds on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(Math.max(10, prev.x), Math.max(10, window.innerWidth - minVisibleX)),
        y: Math.min(Math.max(35, prev.y), Math.max(35, window.innerHeight - minVisibleY))
      }));
      setSize(prev => ({
        width: Math.min(prev.width, window.innerWidth - 10),
        height: Math.min(prev.height, window.innerHeight - 40)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [minVisibleX, minVisibleY]);

  // DRAG HANDLERS
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, [data-no-drag]')) {
      return;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    isDraggingRef.current = true;
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: position.x,
      posY: position.y
    };
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;

    const maxX = Math.max(10, window.innerWidth - minVisibleX);
    const maxY = Math.max(35, window.innerHeight - minVisibleY);

    const newX = Math.min(maxX, Math.max(5, dragStartRef.current.posX + dx));
    const newY = Math.min(maxY, Math.max(35, dragStartRef.current.posY + dy));

    setPosition({ x: newX, y: newY });
  }, [minVisibleX, minVisibleY]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (storageKey) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(position));
      } catch (err) {}
    }
  }, [position, storageKey]);

  // RESIZE HANDLERS
  const startResize = useCallback((direction: 'corner' | 'right' | 'bottom' | 'left', e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    e.preventDefault();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    isResizingRef.current = true;
    resizeDirectionRef.current = direction;
    resizeStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x
    };
  }, [size, position]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!isResizingRef.current) return;
    e.stopPropagation();

    const dx = e.clientX - resizeStartRef.current.pointerX;
    const dy = e.clientY - resizeStartRef.current.pointerY;
    const dir = resizeDirectionRef.current;

    const maxW = maxWidth || (window.innerWidth - 10);
    const maxH = maxHeight || (window.innerHeight - 40);

    let newWidth = resizeStartRef.current.width;
    let newHeight = resizeStartRef.current.height;
    let newX = position.x;

    if (dir === 'corner' || dir === 'right') {
      newWidth = Math.min(maxW, Math.max(minWidth, resizeStartRef.current.width + dx));
    }
    if (dir === 'corner' || dir === 'bottom') {
      newHeight = Math.min(maxH, Math.max(minHeight, resizeStartRef.current.height + dy));
    }
    if (dir === 'left') {
      const prospectiveWidth = resizeStartRef.current.width - dx;
      if (prospectiveWidth >= minWidth && prospectiveWidth <= maxW) {
        newWidth = prospectiveWidth;
        newX = resizeStartRef.current.posX + dx;
        setPosition(prev => ({ ...prev, x: newX }));
      }
    }

    setSize({ width: Math.round(newWidth), height: Math.round(newHeight) });
  }, [minWidth, minHeight, maxWidth, maxHeight, position.x]);

  const handleResizeUp = useCallback((e: React.PointerEvent) => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (storageKey) {
      try {
        sessionStorage.setItem(`${storageKey}_size`, JSON.stringify(size));
        sessionStorage.setItem(storageKey, JSON.stringify(position));
      } catch (err) {}
    }
  }, [size, position, storageKey]);

  const resetWindow = useCallback(() => {
    const defPos = getDefaultPos();
    const defSize = getDefaultSize();
    setPosition(defPos);
    setSize(defSize);
    if (storageKey) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(defPos));
        sessionStorage.setItem(`${storageKey}_size`, JSON.stringify(defSize));
      } catch (err) {}
    }
  }, [getDefaultPos, getDefaultSize, storageKey]);

  return {
    position,
    setPosition,
    size,
    setSize,
    resetWindow,
    dragProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      style: { touchAction: 'none' as const, cursor: 'grab' }
    },
    resizeCornerProps: {
      onPointerDown: (e: React.PointerEvent) => startResize('corner', e),
      onPointerMove: handleResizeMove,
      onPointerUp: handleResizeUp,
      onPointerCancel: handleResizeUp,
      style: { touchAction: 'none' as const, cursor: 'nwse-resize' }
    },
    resizeRightProps: {
      onPointerDown: (e: React.PointerEvent) => startResize('right', e),
      onPointerMove: handleResizeMove,
      onPointerUp: handleResizeUp,
      onPointerCancel: handleResizeUp,
      style: { touchAction: 'none' as const, cursor: 'ew-resize' }
    },
    resizeBottomProps: {
      onPointerDown: (e: React.PointerEvent) => startResize('bottom', e),
      onPointerMove: handleResizeMove,
      onPointerUp: handleResizeUp,
      onPointerCancel: handleResizeUp,
      style: { touchAction: 'none' as const, cursor: 'ns-resize' }
    }
  };
}
