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
import { createSpring, createSpringTimingFunction } from "./spring-motion";
import { velocityPerSecond } from "framer-motion";
import { MovementTracker } from "./movement-tracker";
import {
  useObserveScroll,
  useObservableValue,
  useObserve,
} from "./observable-value";
import React from "react";
import { usePresence } from "./presence";

const clamp = (min: number, max: number, value: number) =>
  Math.max(min, Math.min(max, value));

interface DrawerProps extends PropsWithChildren {
  onDismiss?: () => void;
}

export function Drawer({ children, onDismiss }: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;
  const touchTargetRef = useRef<HTMLDivElement>(
    null,
  ) as RefObject<HTMLDivElement>;

  const contentScrollY = useObserveScroll(touchTargetRef);
  const gestureInitialStateRef = useRef<null | {
    y: number;
    drawerOffsetY: number;
  }>(null);

  const isTouching = useRef(false);
  const drawerOffsetY = useObservableValue(0);
  const canContentScroll = useObservableValue(false);
  const motion = useObservableValue<"instant" | "interporlates">(
    "interporlates",
  );

  // not using spring because of lag in low power mode
  /* const defaultSpring = useMemo(
    () => createSpring({ stiffness: 1000, damping: 100 }),
    [],
  ); */

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

      const velocity = velocityPerSecond(movementDelta, timeDelta);

      // trigger the scroll bounce 1 step earlier than scroll reaching zero
      // to create the illusion of continuous motion on mobile. Without this, there is
      // slight puase, making it not ideal.

      // HACK: use movement delta here as a proximiate
      if (latest > movementDelta) {
        // force the drawer to be full screen when the content is scrolling
        // drawerOffsetY.set(0);

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
        stiffness: 200, // default: 170
        damping: 26, // default: 26
        mass: 1,
        velocity: -prevFrameScrollVelocityRef.current,
      });

      const overscrollBounceTimingFunction = createSpringTimingFunction(spring);

      // It requires to slightly delay the animation execuation
      // in order to reliably perform the animation
      const animateBounce = () => {
        drawerRef.current.animate(
          [
            {
              // use 1 pixel to trigger the overscroll bounce animationi
              transform: "translateY(1px)",
            },
            {
              transform: "translateY(0px)",
            },
          ],
          {
            duration: spring.duration * 2000,
            easing: overscrollBounceTimingFunction,
            fill: "forwards",
            iterations: 1,
            composite: "add",
          },
        );
      };
      requestAnimationFrame(animateBounce);
    },
    false,
  );

  useObserve(motion, (latest) => {
    const sheet = drawerRef.current;
    if (latest === "interporlates") {
      // spring animation implementation
      // sheet.style.setProperty("--duration", `${defaultSpring.duration}s`);
      // sheet.style.setProperty("--easing", `${defaultSpring.timingFunction}`);

      // use cubic bezier for better performance
      // sheet.style.setProperty("--duration", `2s`);
      sheet.style.setProperty("--duration", `.5s`);
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

  useObserve(drawerOffsetY, (latest) => {
    canContentScroll.set(latest <= 0);
    drawerRef.current.style.setProperty("--y-offset", `${latest}px`);
  });

  useObserve(canContentScroll, (latest) => {
    const elm = touchTargetRef.current;
    if (latest) {
      elm.style.setProperty("overflow-y", `scroll`);
      return;
    }
    elm.style.setProperty("overflow-y", `scroll`);
  });

  // WORK AROUND FOR MOBILE BROWSER:
  //
  // super hacky way to compensate scroll and offsetY difference
  // after interrupting touch gesture with scroll. The debounce is being reset
  // every touch down gesture as well.

  const scrollCompensateTimeoutRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const compensateScrollDebounced = useCallback(() => {
    const scrollContainer = touchTargetRef.current;
    const handleScroll = () => {
      if (scrollCompensateTimeoutRef.current) {
        clearTimeout(scrollCompensateTimeoutRef.current);
      }
      scrollCompensateTimeoutRef.current = setTimeout(() => {
        scrollContainer.removeEventListener("scroll", handleScroll);

        const remaindingOffset = drawerOffsetY.get();
        const scrollOffest = touchTargetRef.current.scrollTop;

        if (scrollOffest < remaindingOffset) {
          // user scroll back up to the snap area
          motion.set("instant");
          drawerOffsetY.set(remaindingOffset - scrollOffest);
          scrollContainer.scrollTo({
            top: 0,
          });

          requestAnimationFrame(() => {
            motion.set("interporlates");
            drawerOffsetY.set(0);
          });
          return;
        }
        // user has scrolled, so we secretly adjust the scroll wihtout them knowing
        scrollContainer.scrollTo({
          top: scrollOffest - remaindingOffset,
        });
        motion.set("instant");
        drawerOffsetY.set(0);
      }, 100);
    };
    handleScroll();
    scrollContainer.addEventListener("scroll", handleScroll);
  }, [drawerOffsetY, motion]);

  const touchMovement = useMemo(() => new MovementTracker(), []);
  const getComputedYTranslate = (elm: HTMLElement) => {
    const computedTranslate = getComputedStyle(elm).translate;
    const currentPosition = computedTranslate.split(" ");
    const currentY = parseFloat(currentPosition[1]);
    return currentY;
  };

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (scrollCompensateTimeoutRef.current)
        clearTimeout(scrollCompensateTimeoutRef.current);

      const elm = drawerRef.current;
      const currentY = getComputedYTranslate(elm);
      const touchY = e.touches[0].clientY;

      // reject touches that outside of the drawer panel
      if (touchY < currentY) {
        e.preventDefault();
        return;
      }

      if (!isNaN(currentY)) {
        // on mobile, because of performance constraint, you cant' really
        // calculate the translateY and apply to the offsetY.
        // It will resulted a y position that is a frame before.
        //
        //
        // the lag compensation create the illusion of catching the sheet.
        const lagCompensationOffset = 40;
        const clamped = clamp(
          0,
          window.innerHeight,
          currentY - lagCompensationOffset,
        );

        motion.set("instant");
        drawerOffsetY.set(clamped);
      }

      isTouching.current = true;
      touchMovement.track(touchY);
    },
    [motion, drawerOffsetY, touchMovement],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touchY = e.touches[0].clientY;
      touchMovement.track(touchY);
      const vel = touchMovement.calculateVelocity();

      const hasScrolled = contentScrollY.get() > 0;
      const isDismissing = drawerOffsetY.get() >= 0;
      const isUsingInitiatingScrollDown =
        !isDismissing && !hasScrolled && vel < 0;

      // ignore touch move after user start scrolling
      if (hasScrolled || isUsingInitiatingScrollDown) {
        return;
      }

      // reject touches that outside of the drawer panel
      if (touchY < drawerOffsetY.get()) {
        e.preventDefault();
        return;
      }

      // for some reason this is running when offset become zero:
      // making it unable to scroll down
      if (!gestureInitialStateRef.current) {
        gestureInitialStateRef.current = {
          y: e.touches[0].clientY,
          drawerOffsetY: drawerOffsetY.get(),
        };
        motion.set("instant");
        isTouching.current = true;
      }

      const touchOffset = gestureInitialStateRef.current.y - touchY;

      // update the offest here
      const newY = clamp(
        0,
        window.innerHeight,
        gestureInitialStateRef.current.drawerOffsetY - touchOffset,
      );

      // render it to the dom
      drawerOffsetY.set(newY);
    },
    [contentScrollY, motion, drawerOffsetY, touchMovement],
  );

  const handleTouchEnd = useCallback(() => {
    //reset the gesture
    gestureInitialStateRef.current = null;
    isTouching.current = false;

    // return if the user have reset
    if (contentScrollY.get() > 0) {
      compensateScrollDebounced();
      return;
    }

    // enable motion
    motion.set("interporlates");
    canContentScroll.set(true);

    // figure out the snapping
    const COMMIT_THRESHOLD = 0.75;
    const isOverCommitThreshold =
      (window.innerHeight - drawerOffsetY.get()) / window.innerHeight <
      COMMIT_THRESHOLD;

    const velocitySmoothed = touchMovement.calculateVelocity(3);
    const isFlick = velocitySmoothed > 10;
    const isCancelDirection = velocitySmoothed < 0;

    if ((isOverCommitThreshold && !isCancelDirection) || isFlick) {
      drawerOffsetY.set(window.innerHeight);
      onDismiss?.();
      return;
    }
    drawerOffsetY.set(0);
  }, [
    contentScrollY,
    motion,
    canContentScroll,
    drawerOffsetY,
    touchMovement,
    compensateScrollDebounced,
    onDismiss,
  ]);

  const [isPresent, safeToRemove] = usePresence();

  // set the position to window height as an entry animation
  useLayoutEffect(() => {
    motion.set("instant");
    drawerOffsetY.set(window.innerHeight);
    drawerRef.current.focus();
  }, [drawerOffsetY, motion]);

  useEffect(() => {
    const sheet = drawerRef.current;
    if (isPresent) {
      // needs a slight delay so the enter animation can be reset to zero
      requestAnimationFrame(() => {
        motion.set("interporlates");
        drawerOffsetY.set(0);
      });
      return;
    }

    sheet.addEventListener("transitionend", safeToRemove);
    return () => {
      sheet.removeEventListener("transitionend", safeToRemove);
    };
  }, [drawerOffsetY, isPresent, motion, safeToRemove]);

  useEffect(() => {
    if (!isPresent) {
      touchTargetRef.current.style.pointerEvents = "none";
      return;
    }
    touchTargetRef.current.style.pointerEvents = "all";
  }, [isPresent]);

  return (
    <div
      className="fixed inset-0 overscroll-none"
      ref={touchTargetRef}
      // HACK:
      // put the touch detection at a stationary div
      // because the browser seems to be unable to catch up with the animation hit box
      //
      // it fails to register touch when the drawer sheet is beginning out of the screen
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
    >
      <div
        ref={drawerRef}
        className="absolute will-change-transform  bg-blue-800  transition-(--transition) translate-y-(--y-offset) ease-(--easing) duration-(--duration)"
      >
        <div className="flex w-full items-center justify-center py-2">
          <div className={"h-1 w-12 bg-red-600"} />
        </div>
        {children}
      </div>
    </div>
  );
}
