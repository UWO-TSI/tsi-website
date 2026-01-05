"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { gsap } from "gsap";

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const cornersRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  const isActiveRef = useRef(false);
  const targetCornerPositionsRef = useRef<{ x: number; y: number }[] | null>(null);
  const tickerFnRef = useRef<(() => void) | null>(null);
  const activeStrengthRef = useRef({ current: 0 });
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const currentLeaveHandlerRef = useRef<(() => void) | null>(null);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 768;
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const isMobileUserAgent = mobileRegex.test(userAgent.toLowerCase());
    return (hasTouchScreen && isSmallScreen) || isMobileUserAgent;
  }, []);

  const constants = useMemo(
    () => ({
      borderWidth: 2,
      cornerSize: 12,
    }),
    []
  );

  const mousePosRef = useRef({ x: 0, y: 0 });

  const moveCursor = useCallback((x: number, y: number) => {
    if (!cursorRef.current || !dotRef.current) return;
    
    mousePosRef.current = { x, y };
    
    // Dot follows mouse immediately (true position) - no lag
    gsap.set(dotRef.current, {
      x: x,
      y: y,
      xPercent: -50,
      yPercent: -50,
    });
    
    // Corners wrapper lags behind with elastic ease
    gsap.to(cursorRef.current, {
      x,
      y,
      duration: 1.2,
      ease: 'elastic.out(1, 0.6)',
    });
  }, []);

  useEffect(() => {
    if (isMobile || !cursorRef.current || !dotRef.current) return;

    const originalCursor = document.body.style.cursor;
    document.body.style.cursor = 'none';

    const cursor = cursorRef.current;
    const corners = cornersRef.current;
    if (!corners) return;

    const cornerElements = Array.from(corners.children) as HTMLDivElement[];
    let activeTarget: HTMLElement | null = null;
    let currentLeaveHandler: (() => void) | null = null;
    let resumeTimeout: NodeJS.Timeout | null = null;

    const cleanupTarget = (target: HTMLElement) => {
      if (currentLeaveHandler) {
        target.removeEventListener('mouseleave', currentLeaveHandler);
      }
      currentLeaveHandler = null;
    };

    const initialX = window.innerWidth / 2;
    const initialY = window.innerHeight / 2;
    
    gsap.set(cursor, {
      xPercent: -50,
      yPercent: -50,
      x: initialX,
      y: initialY,
    });
    
    // Initialize dot at center as well
    if (dotRef.current) {
      gsap.set(dotRef.current, {
        xPercent: -50,
        yPercent: -50,
        x: initialX,
        y: initialY,
      });
    }

    const tickerFn = () => {
      if (!targetCornerPositionsRef.current || !cursorRef.current || !cornerElements.length) {
        return;
      }

      const strength = activeStrengthRef.current.current;
      if (strength === 0) return;

      const cursorX = gsap.getProperty(cursorRef.current, 'x') as number;
      const cursorY = gsap.getProperty(cursorRef.current, 'y') as number;

      cornerElements.forEach((corner, i) => {
        const currentX = gsap.getProperty(corner, 'x') as number || 0;
        const currentY = gsap.getProperty(corner, 'y') as number || 0;

        const targetX = targetCornerPositionsRef.current![i].x - cursorX;
        const targetY = targetCornerPositionsRef.current![i].y - cursorY;

        const finalX = currentX + (targetX - currentX) * strength;
        const finalY = currentY + (targetY - currentY) * strength;

        const duration = strength >= 0.99 ? 0.2 : 0.05;

        gsap.to(corner, {
          x: finalX,
          y: finalY,
          duration: duration,
          ease: 'power1.out',
          overwrite: 'auto',
        });
      });
    };

    tickerFnRef.current = tickerFn;

    const moveHandler = (e: MouseEvent) => moveCursor(e.clientX, e.clientY);
    window.addEventListener('mousemove', moveHandler);

    const scrollHandler = () => {
      if (!activeTarget || !cursorRef.current) return;
      const mouseX = gsap.getProperty(cursorRef.current, 'x') as number;
      const mouseY = gsap.getProperty(cursorRef.current, 'y') as number;
      const elementUnderMouse = document.elementFromPoint(mouseX, mouseY);
      const isStillOverTarget =
        elementUnderMouse &&
        (elementUnderMouse === activeTarget || 
         (elementUnderMouse as HTMLElement).closest?.(targetSelector) === activeTarget);
      if (!isStillOverTarget && currentLeaveHandler) {
        currentLeaveHandler();
      }
    };
    window.addEventListener('scroll', scrollHandler, { passive: true });

    const mouseDownHandler = () => {
      if (!dotRef.current) return;
      gsap.to(dotRef.current, { scale: 0.7, duration: 0.3 });
      gsap.to(cursorRef.current, { scale: 0.9, duration: 0.2 });
    };

    const mouseUpHandler = () => {
      if (!dotRef.current) return;
      gsap.to(dotRef.current, { scale: 1, duration: 0.3 });
      gsap.to(cursorRef.current, { scale: 1, duration: 0.2 });
    };

    window.addEventListener('mousedown', mouseDownHandler);
    window.addEventListener('mouseup', mouseUpHandler);

    const targetSelector = 'button, a, [role="button"], .cursor-target, input[type="button"], input[type="submit"]';

    const enterHandler = (e: MouseEvent) => {
      const directTarget = e.target as HTMLElement;
      const allTargets: HTMLElement[] = [];
      let current: HTMLElement | null = directTarget;
      while (current && current !== document.body) {
        if (current.matches && current.matches(targetSelector)) {
          allTargets.push(current);
        }
        current = current.parentElement;
      }
      const target = allTargets[0] || null;
      if (!target || !cursorRef.current || !cornerElements.length) return;
      if (activeTarget === target) return;
      if (activeTarget) {
        cleanupTarget(activeTarget);
      }
      if (resumeTimeout) {
        clearTimeout(resumeTimeout);
        resumeTimeout = null;
      }

      activeTarget = target;
      cornerElements.forEach(corner => gsap.killTweensOf(corner));

      const rect = target.getBoundingClientRect();
      const { borderWidth, cornerSize } = constants;
      const cursorX = gsap.getProperty(cursorRef.current, 'x') as number;
      const cursorY = gsap.getProperty(cursorRef.current, 'y') as number;

      targetCornerPositionsRef.current = [
        { x: rect.left - borderWidth, y: rect.top - borderWidth },
        { x: rect.right + borderWidth - cornerSize, y: rect.top - borderWidth },
        { x: rect.right + borderWidth - cornerSize, y: rect.bottom + borderWidth - cornerSize },
        { x: rect.left - borderWidth, y: rect.bottom + borderWidth - cornerSize },
      ];

      isActiveRef.current = true;
      if (tickerFnRef.current) {
        gsap.ticker.add(tickerFnRef.current);
      }

      gsap.to(activeStrengthRef.current, {
        current: 1,
        duration: 0.2,
        ease: 'power2.out',
      });

      cornerElements.forEach((corner, i) => {
        gsap.to(corner, {
          x: targetCornerPositionsRef.current![i].x - cursorX,
          y: targetCornerPositionsRef.current![i].y - cursorY,
          duration: 0.2,
          ease: 'power2.out',
        });
      });

      const leaveHandler = () => {
        if (tickerFnRef.current) {
          gsap.ticker.remove(tickerFnRef.current);
        }

        isActiveRef.current = false;
        targetCornerPositionsRef.current = null;
        gsap.set(activeStrengthRef.current, { current: 0, overwrite: true });
        activeTarget = null;

        if (cornerElements.length) {
          cornerElements.forEach(corner => gsap.killTweensOf(corner));
          const { cornerSize } = constants;
          const scale = 0.75; // 25% smaller
          const positions = [
            { x: -cornerSize * 1.5 * scale, y: -cornerSize * 1.5 * scale },
            { x: cornerSize * 0.5 * scale, y: -cornerSize * 1.5 * scale },
            { x: cornerSize * 0.5 * scale, y: cornerSize * 0.5 * scale },
            { x: -cornerSize * 1.5 * scale, y: cornerSize * 0.5 * scale },
          ];
          const tl = gsap.timeline();
          cornerElements.forEach((corner, index) => {
            tl.to(
              corner,
              {
                x: positions[index].x,
                y: positions[index].y,
                duration: 0.3,
                ease: 'power3.out',
              },
              0
            );
          });
        }

        cleanupTarget(target);
      };

      currentLeaveHandler = leaveHandler;
      target.addEventListener('mouseleave', leaveHandler);
    };

    window.addEventListener('mouseover', enterHandler, { passive: true });

    // Initialize corner positions - 25% smaller (closer together)
    const { cornerSize } = constants;
    const scale = 0.75; // 25% smaller
    const initialPositions = [
      { x: -cornerSize * 1.5 * scale, y: -cornerSize * 1.5 * scale },
      { x: cornerSize * 0.5 * scale, y: -cornerSize * 1.5 * scale },
      { x: cornerSize * 0.5 * scale, y: cornerSize * 0.5 * scale },
      { x: -cornerSize * 1.5 * scale, y: cornerSize * 0.5 * scale },
    ];
    cornerElements.forEach((corner, index) => {
      gsap.set(corner, {
        x: initialPositions[index].x,
        y: initialPositions[index].y,
      });
    });

    return () => {
      if (tickerFnRef.current) {
        gsap.ticker.remove(tickerFnRef.current);
      }

      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseover', enterHandler);
      window.removeEventListener('scroll', scrollHandler);
      window.removeEventListener('mousedown', mouseDownHandler);
      window.removeEventListener('mouseup', mouseUpHandler);

      if (activeTarget) {
        cleanupTarget(activeTarget);
      }

      if (resumeTimeout) {
        clearTimeout(resumeTimeout);
      }

      document.body.style.cursor = originalCursor;

      isActiveRef.current = false;
      targetCornerPositionsRef.current = null;
      activeStrengthRef.current.current = 0;
    };
  }, [isMobile, moveCursor, constants]);

  if (isMobile) {
    return null;
  }

  return (
    <>
      <div 
        ref={dotRef} 
        className="fixed top-0 left-0 w-0 h-0 pointer-events-none z-[9999]" 
        style={{ 
          mixBlendMode: 'difference', 
          transform: 'translate(-50%, -50%)' 
        }}
      >
        <div 
          className="absolute left-1/2 top-1/2" 
          style={{ 
            width: '4px',
            height: '4px',
            backgroundColor: '#fff',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            willChange: 'transform',
          }} 
        />
      </div>
      <div 
        ref={cursorRef} 
        className="fixed top-0 left-0 w-0 h-0 pointer-events-none z-[9999]" 
        style={{ 
          mixBlendMode: 'difference', 
          transform: 'translate(-50%, -50%)' 
        }}
      >
        <div 
          ref={cornersRef}
          className="absolute left-1/2 top-1/2"
          style={{ 
            transform: 'translate(-50%, -50%)',
            width: 0,
            height: 0,
          }}
        >
          <div 
            className="absolute" 
            style={{ 
              width: '9px',
              height: '9px',
              borderTop: '2px solid #fff',
              borderLeft: '2px solid #fff',
              borderRight: 'none',
              borderBottom: 'none',
              willChange: 'transform',
              left: 0,
              top: 0,
            }} 
          />
          <div 
            className="absolute" 
            style={{ 
              width: '9px',
              height: '9px',
              borderTop: '2px solid #fff',
              borderRight: '2px solid #fff',
              borderLeft: 'none',
              borderBottom: 'none',
              willChange: 'transform',
              left: 0,
              top: 0,
            }} 
          />
          <div 
            className="absolute" 
            style={{ 
              width: '9px',
              height: '9px',
              borderBottom: '2px solid #fff',
              borderRight: '2px solid #fff',
              borderLeft: 'none',
              borderTop: 'none',
              willChange: 'transform',
              left: 0,
              top: 0,
            }} 
          />
          <div 
            className="absolute" 
            style={{ 
              width: '9px',
              height: '9px',
              borderBottom: '2px solid #fff',
              borderLeft: '2px solid #fff',
              borderRight: 'none',
              borderTop: 'none',
              willChange: 'transform',
              left: 0,
              top: 0,
            }} 
          />
        </div>
      </div>
    </>
  );
}
