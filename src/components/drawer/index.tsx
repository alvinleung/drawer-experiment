"use client";

import {
  PropsWithChildren,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { MovementTracker } from "./movement-tracker";
import React from "react";
import "../debug/log";
import {
  clamp,
  fireEventListenerOnce,
  getTransitionDurationSeconds,
  getTranslateY,
  useHasActiveTransition,
  useIsLowPowerMode,
} from "./utils";
import {
  useObservableValue,
  useObserve,
  useObserveScroll,
} from "../animation/observable-value";
import {
  createSpring,
  createSpringTimingFunction,
} from "../animation/spring-motion";
import { cubicBezier } from "../animation/cubic-bezier";
import { usePresence } from "../animation/presence";
import { getSnapPointPixelY, resolveSnapPoint, SnapPointControl } from "./snap";

interface DrawerProps extends PropsWithChildren {
  dismissResistence?: number;
  onDismiss?: () => void;
  snapControl: SnapPointControl;
}

const EXPANDED_THRESHOLD = 0.5;

export function Drawer({
  children,
  onDismiss,
  dismissResistence = 0.6,
  snapControl,
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;
  const heightHolderRef = useRef<HTMLDivElement>(
    null,
  ) as RefObject<HTMLDivElement>;

  useEffect(() => {
    const drawer = drawerRef.current;
    const resizeOserver = new ResizeObserver(() => {
      const height = drawer.getBoundingClientRect().height;
      if (!heightHolderRef.current) return;
      heightHolderRef.current.style.height = height + "px";
    });
    resizeOserver.observe(drawer);
    return () => {
      resizeOserver.disconnect();
    };
  }, []);

  const contentScrollY = useObserveScroll(drawerRef);
  const dragGestureInitialStateRef = useRef<null | {
    y: number;
    drawerOffsetY: number;
  }>(null);

  const isTouching = useRef(false);
  const drawerY = useObservableValue(0);
  const transition = useObservableValue<
    "instant" | "default" | "enter" | "exit"
  >("default");

  // for scroll bounce effect
  const prevFrameScrollVelocityRef = useRef(0);
  const isPerformingBounceRef = useRef(false);
  const prevUpdateTime = useRef(0);
  useObserve(
    contentScrollY,
    (latest) => {
      // Using the last two value to calculate Velocity is not accurate.
      // Because the last delta is likely shorten due to the scroll clamping to zero
      // So we use the delta 1 frame before to calculate the exit gesture velocity
      const currTime = performance.now();
      const timeDelta = currTime - prevUpdateTime.current;
      prevUpdateTime.current = currTime;

      const movementDelta =
        (contentScrollY.getPrevious() || contentScrollY.get()) -
        contentScrollY.get();

      // velocity per second
      const velocity = movementDelta * (1000 / timeDelta);

      // trigger the scroll bounce 1 step earlier than scroll reaching zero
      // to create the illusion of continuous motion on mobile. Without this, there is
      // slight puase, making it not ideal.

      // HACK: use movement delta here as a proximiate
      if (latest > movementDelta) {
        // Save the prev frame delta
        prevFrameScrollVelocityRef.current = velocity;
        isPerformingBounceRef.current = false;
        return;
      }

      // when user's finger is on, do not perform scroll bounce
      if (isTouching.current) return;

      // this check prevent double-firing of the bounce animation
      if (isPerformingBounceRef.current) return;
      isPerformingBounceRef.current = true;

      // trigger artificial overscroll bounce base on scroll velocity
      const spring = createSpring({
        // damping: 32, // default: 26
        // stiffness: 200, // default: 170
        stiffness: 130, // default: 170
        damping: 26, // default: 26
        mass: 1,
        velocity: -prevFrameScrollVelocityRef.current,
      });

      const overscrollBounceTimingFunction = createSpringTimingFunction(spring);
      const duration = spring.duration * 1000;

      // It requires to slightly delay the animation execuation
      // in order to reliably perform the animation
      const animateBounce = async () => {
        drawerRef.current.animate(
          [
            {
              // use 1 pixel to trigger the overscroll bounce animationi
              transform: "translate3d(0px, 1px, 0px)",
            },
            {
              transform: "translate3d(0px, 0px, 0px)",
            },
          ],
          {
            duration,
            easing: overscrollBounceTimingFunction,
            fill: "forwards",
            iterations: 1,
            composite: "add",
          },
        );
      };
      // requestAnimationFrame is used to delay execution of animation
      // as a workaround of browser ignoring animation
      requestAnimationFrame(animateBounce);
    },
    false,
  );
  // =================================================================
  // Scroll control
  // =================================================================
  const canScroll = useObservableValue(false);
  useObserve(canScroll, (latest) => {
    if (latest) {
      drawerRef.current.style.overflowY = "scroll";
      return;
    }
    // Uses "visible" instead of "hidden" to lock scroll. This  will
    // make sure the browser is ready to render the clipped part of the content
    drawerRef.current.style.overflowY = "visible";
  });

  // =================================================================
  // transition definitions
  // =================================================================
  useObserve(transition, (latest) => {
    const sheet = drawerRef.current;
    if (latest === "default") {
      // spring animation implementation
      // sheet.style.setProperty("--duration", `${defaultSpring.duration}s`);
      // sheet.style.setProperty("--easing", `${defaultSpring.timingFunction}`);

      // use cubic bezier for better performance
      sheet.style.setProperty("--duration", `.5s`);

      // ease out quint is the closet to the spring easing curve
      sheet.style.setProperty("--easing", `cubic-bezier(0.22, 1, 0.36, 1)`);

      // custom easing that is based on ease-out-quit, with more anticipation
      // sheet.style.setProperty("--easing", `cubic-bezier(.35,.79,.23,1)`);
      sheet.style.setProperty("--transition", `all`);

      return;
    }

    if (latest === "enter") {
      sheet.style.setProperty("--duration", `.5s`);
      // uses custom easing for more vigorous feeling
      sheet.style.setProperty("--easing", `cubic-bezier(.32, .72, 0, 1)`);
      sheet.style.setProperty("--transition", `all`);
      return;
    }

    // use ease out quint for a quick but smoother motion
    if (latest === "exit") {
      sheet.style.setProperty("--duration", `.4s`);
      sheet.style.setProperty("--easing", `cubic-bezier(0.25, 1, 0.5, 1)`);
      sheet.style.setProperty("--transition", `all`);
      return;
    }

    if (latest === "instant") {
      sheet.style.setProperty("--duration", `0s`);
      sheet.style.setProperty("--transition", `none`);
      return;
    }
  });

  // =================================================================
  // Commiting DOM Update
  // =================================================================
  const drawerYLastUpdate = useRef(0);
  useObserve(drawerY, (latest) => {
    // timestamp the for calculating motion offset
    drawerYLastUpdate.current = performance.now();

    // remove bounce animation (which easing curve interferes)
    drawerRef.current.getAnimations().forEach((anim) => anim.cancel());

    // Update freaquent css changes directly rather via variable
    // SEE: https://blog.aboutme.be/2023/04/21/css-variables-can-be-slow-in-safari/
    drawerRef.current.style.setProperty(
      "transform",
      `translate3d(0px, ${latest}px, 0px)`,
    );

    canScroll.set(latest < EXPANDED_THRESHOLD);
  });
  const touchMovement = useMemo(() => new MovementTracker(), []);
  const defaultEaseFunc = useMemo(() => cubicBezier(0.35, 0.79, 0.23, 1), []);
  const hasActiveTransiton = useHasActiveTransition(drawerRef);

  // This function computes the position where the drawer is interrupted at.
  // Since we are using CSS transition, there is no clean way
  // simply get the mid-transition value. The following are 2 strategies:
  const getInterruptedDrawerPosition = useCallback(
    (computedStyle: CSSStyleDeclaration) => {
      if (hasActiveTransiton.get()) {
        // Strategy 1 - FOR TRANSITION:
        //
        // On mobile, because of performance constraint, it throttles the reading of
        // computed translate y. The lag resulting a y position that is (roughly) a frame before.
        //
        // To counter that, we compute the estimated location through evaluating the easing function
        // and speculate ahead a small amount of where the y position would land.

        const previous = drawerY.getPrevious() || drawerY.get();

        // yMotion is NOT velocity, it is decrete beginning and end of the motion
        const yOffset = drawerY.get() - previous;

        const elapsedTime = performance.now() - drawerYLastUpdate.current;
        const duration = getTransitionDurationSeconds(computedStyle);
        const speculationAmount = 0.18; // how long does it look forward to compensate
        const animProg = defaultEaseFunc(
          elapsedTime / (duration * 1000) + speculationAmount,
        );
        const speculatedPosition = previous + yOffset * animProg;
        return speculatedPosition;
      }

      // Strategy 2 - FOR ANIMATION:
      //
      // Through experiment, we found that the translate Y is more reliable when it
      // comes to estimating the position in animation. So we basically take
      // the computed CSS value here.

      const currentY = getTranslateY(computedStyle);
      if (isNaN(currentY)) {
        return null;
      }
      return currentY;
    },
    [defaultEaseFunc, drawerY, hasActiveTransiton],
  );

  const releaseScrollWithVelocity = useCallback((releaseVelocity: number) => {
    let animFrame = 0;
    let velocity = releaseVelocity;
    const decayRate = 0.998; // a decay rate closely matches apple default
    const drawer = drawerRef.current;
    let prevFrameTime = performance.now();

    function loop(now: number) {
      const deltaTime = (now - prevFrameTime) / 100;
      prevFrameTime = now;
      velocity *= Math.pow(decayRate, deltaTime * 60);
      drawer.scrollTo({ top: drawer.scrollTop - velocity });

      if (Math.abs(velocity) > 0.1) {
        animFrame = requestAnimationFrame(loop);
      }
    }
    animFrame = requestAnimationFrame(loop);

    fireEventListenerOnce(drawerRef.current, "touchstart", () =>
      cancelAnimationFrame(animFrame),
    );
  }, []);
  // ======================================================================
  //
  //
  // TOUCH EVENT HANDLER
  //
  //
  // ======================================================================

  const hasDrawerExpanded = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isTouching.current = true;

      const elm = drawerRef.current;
      const computedStyle = getComputedStyle(elm);
      const touchY = e.touches[0].clientY;

      const interceptedPosition = getInterruptedDrawerPosition(computedStyle);
      if (interceptedPosition) {
        const clamped = clamp(0, window.innerHeight, interceptedPosition);
        transition.set("instant");
        drawerY.set(clamped, true);
      }

      hasDrawerExpanded.current = drawerY.get() < 0.5;

      touchMovement.reset();
      touchMovement.track(touchY);
    },
    [getInterruptedDrawerPosition, touchMovement, transition, drawerY],
  );

  // touchScollOffset houses the overflowed dragging and applies it to the scroll
  // content body, creating a seamless scroll experience.
  const touchScrollOffset = useRef(0);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touchY = e.touches[0].clientY;
      touchMovement.track(touchY);

      const touchVel = touchMovement.calculateVelocity();
      const hasDragBegun = dragGestureInitialStateRef.current !== null;
      const canBeginDrag =
        !canScroll.get() || (contentScrollY.get() === 0 && touchVel > 0);

      if (!hasDragBegun && canBeginDrag) {
        dragGestureInitialStateRef.current = {
          y: e.touches[0].clientY,
          drawerOffsetY: drawerY.get(),
        };
        transition.set("instant");
      }

      if (canScroll.get() && !hasDragBegun) {
        return;
      }

      const touchOffset = dragGestureInitialStateRef.current!.y - touchY;

      const isDraggingDown = touchOffset < 0;
      const isFirstSnapPoint = snapControl.currentIndex === 0;
      const shouldApplyResistence = isFirstSnapPoint && isDraggingDown ? 1 : 0;

      const resistence =
        touchOffset * dismissResistence * shouldApplyResistence;

      const newPosition =
        dragGestureInitialStateRef.current!.drawerOffsetY -
        touchOffset +
        resistence;
      const clampedNewPosition = clamp(0, window.innerHeight, newPosition);

      // render it to the dom
      drawerY.set(clampedNewPosition);

      const remaindingY = newPosition - clampedNewPosition;
      drawerRef.current.scrollTop = -remaindingY;
      touchScrollOffset.current = -remaindingY;
    },
    [
      touchMovement,
      contentScrollY,
      canScroll,
      snapControl.currentIndex,
      dismissResistence,
      drawerY,
      transition,
    ],
  );

  const handleTouchEnd = useCallback(() => {
    const hasDragGestureBegun = dragGestureInitialStateRef.current !== null;

    //reset the gesture
    dragGestureInitialStateRef.current = null;
    hasDrawerExpanded.current = false;
    isTouching.current = false;

    const velocitySmoothed = touchMovement.calculateVelocity(3);

    // return early if the content is scrolled
    if (drawerY.get() < 1) {
      drawerY.set(0);
      if (hasDragGestureBegun) {
        releaseScrollWithVelocity(velocitySmoothed);
      }
      return;
    }

    // resolve the gesture using snap point if the user uses snap point
    const snap = resolveSnapPoint(
      snapControl.snapPoints,
      drawerY.get(),
      velocitySmoothed,
    );

    if (!snap) {
      onDismiss?.();
      return;
    }

    snapControl.navigateToIndex(snap.index);
  }, [
    touchMovement,
    drawerY,
    snapControl,
    releaseScrollWithVelocity,
    onDismiss,
  ]);

  const [isPresent, safeToRemove] = usePresence();

  // set the position to window height as an entry animation
  useLayoutEffect(() => {
    transition.set("instant");
    drawerY.set(window.innerHeight);
  }, [drawerY, transition]);

  useEffect(() => {
    const sheet = drawerRef.current;

    if (isPresent) {
      transition.set("default");

      // needs a slight delay so the enter animation can be reset to zero
      requestAnimationFrame(() => {
        const point = snapControl.snapPoints[snapControl.currentIndex];
        const pixelY = getSnapPointPixelY(point);
        drawerY.set(window.innerHeight - pixelY);
      });
      return;
    }

    transition.set("exit");
    requestAnimationFrame(() => {
      drawerY.set(window.innerHeight, true);
    });

    sheet.addEventListener("transitionend", safeToRemove);
    return () => {
      sheet.removeEventListener("transitionend", safeToRemove);
    };
  }, [
    drawerY,
    isPresent,
    transition,
    safeToRemove,
    onDismiss,
    snapControl,
    canScroll,
  ]);

  return (
    <div
      className="rounded-t-2xl bg-zinc-800 will-change-transform transition-(--transition) duration-(--duration) ease-(--easing) fixed inset-0 overscroll-none no-scrollbar"
      ref={drawerRef}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
    >
      <div className="select-none">
        <div className="flex w-full items-center justify-center py-2">
          <div className={"h-1 w-12 bg-zinc-600"} />
        </div>
        {children}
      </div>
    </div>
  );
}
