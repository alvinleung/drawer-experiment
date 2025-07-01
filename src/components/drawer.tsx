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
import { cubicBezier, velocityPerSecond } from "framer-motion";
import { MovementTracker } from "./movement-tracker";
import {
  useObserveScroll,
  useObservableValue,
  useObserve,
} from "./observable-value";
import React from "react";
import { usePresence } from "./presence";
import "./log";
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
  const drawerY = useObservableValue(0);
  const transition = useObservableValue<
    "instant" | "default" | "enter" | "exit"
  >("default");

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
        // stiffness: 200, // default: 170
        // damping: 32, // default: 26
        stiffness: 160, // default: 170
        damping: 26, // default: 26
        mass: 1,
        velocity: -prevFrameScrollVelocityRef.current,
      });

      const overscrollBounceTimingFunction = createSpringTimingFunction(spring);

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
            duration: spring.duration * 2000,
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

  useObserve(transition, (latest) => {
    const sheet = drawerRef.current;
    if (latest === "default") {
      // spring animation implementation
      // sheet.style.setProperty("--duration", `${defaultSpring.duration}s`);
      // sheet.style.setProperty("--easing", `${defaultSpring.timingFunction}`);

      // use cubic bezier for better performance
      // sheet.style.setProperty("--duration", `2s`);
      sheet.style.setProperty("--duration", `.5s`);

      // ease out quint is the closet to the spring easing curve
      sheet.style.setProperty("--easing", `cubic-bezier(0.22, 1, 0.36, 1)`);

      // custom easing that is based on ease-out-quit, with more anticipation
      // sheet.style.setProperty("--easing", `cubic-bezier(.35,.79,.23,1)`);
      sheet.style.setProperty("--transition", `all`);

      return;
    }

    if (latest === "enter") {
      sheet.style.setProperty("--duration", `.6s`);
      // uses custom easing for more vigorous feeling
      sheet.style.setProperty("--easing", `cubic-bezier(.35,.79,.23,1)`);
      sheet.style.setProperty("--transition", `all`);
      return;
    }

    // use ease out quint for a quick but smoother motion
    if (latest === "exit") {
      sheet.style.setProperty("--duration", `.45s`);
      sheet.style.setProperty("--easing", `cubic-bezier(0.22, 1, 0.36, 1)`);
      sheet.style.setProperty("--transition", `all`);
      return;
    }

    if (latest === "instant") {
      sheet.style.setProperty("--duration", `0s`);
      sheet.style.setProperty("--transition", `none`);
      return;
    }
  });

  useObserve(drawerY, (latest) => {
    // remove bounce animation (which easing curve interferes)
    drawerRef.current.getAnimations().forEach((anim) => anim.cancel());

    // Update freaquent css changes directly rather via variable
    // SEE: https://blog.aboutme.be/2023/04/21/css-variables-can-be-slow-in-safari/
    drawerRef.current.style.setProperty(
      "transform",
      `translate3d(0px, ${latest}px, 0px)`,
    );
    // drawerRef.current.style.setProperty("--y-offset", `${latest}px`);
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

        const remaindingOffset = getComputedYTranslate(drawerRef.current);
        const scrollOffest = touchTargetRef.current.scrollTop;

        if (scrollOffest < remaindingOffset) {
          // user scroll back up to the snap area
          transition.set("instant");
          drawerY.set(remaindingOffset - scrollOffest);
          scrollContainer.scrollTo({
            top: 0,
          });

          requestAnimationFrame(() => {
            transition.set("default");
            requestAnimationFrame(() => {
              drawerY.set(0);
            });
          });
          return;
        }
        // user has scrolled, so we secretly adjust the scroll wihtout them knowing
        scrollContainer.scrollTo({
          top: scrollOffest - remaindingOffset,
        });
        transition.set("instant");
        drawerY.set(0);
      }, 100);
    };
    handleScroll();
    scrollContainer.addEventListener("scroll", handleScroll);
  }, [drawerY, transition]);

  const touchMovement = useMemo(() => new MovementTracker(), []);
  const getComputedYTranslate = (elm: HTMLElement) => {
    // to work with translate 3d we need to extract the position via the matrix
    const computedStyle = getComputedStyle(elm);

    // css matrix notation looks something like this:
    // matrix(1, 0, 0, 1, 0, 204.453)
    //
    // SEE: https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix
    const positionComponents = computedStyle.transform
      .substring("matrix(".length - 1, computedStyle.transform.length - 1) // remove the brackets and function
      .split(",")
      .map(parseFloat) // [0, 0, 0 , 1, 0, 204.453]
      .slice(-2); // extract the position component

    return positionComponents[1]; // the y component
  };

  // const prev = useRef(0);
  // useAnimationFrame(() => {
  //   const curr = performance.now();
  //   const diff = curr - prev.current;
  //   console.log(diff);
  //   prev.current = curr;
  // });

  const easeFunc = useMemo(() => cubicBezier(0.35, 0.79, 0.23, 1), []);
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
        // const lagCompensationOffset = 40;

        const lagCompensationFactor = 100;
        const previous = drawerY.getPrevious() || drawerY.get();

        // yMotion is NOT velocity, because input could be descrete, beginning and ending of motion
        const yMotionDist = drawerY.get() - previous;

        // find the delta at the frame after
        const t = (currentY - previous) / yMotionDist;
        const delta = easeFunc(t + 0.1) - easeFunc(t);

        // const direction = yDelta > 0 ? -1 : 1;
        const lagCompensationOffset =
          (-yMotionDist * delta * 100) / window.innerHeight;

        console.log("drawery", drawerY.getPrevious());
        console.log(delta);

        // console.log("current", drawerY.get());
        // console.log("yDelta", yDelta);
        // console.log("lag compensation offset", lagCompensationOffset);

        const clamped = clamp(
          0,
          window.innerHeight,
          currentY - lagCompensationOffset,
        );

        transition.set("instant");
        drawerY.set(clamped);
      }

      isTouching.current = true;
      touchMovement.track(touchY);
    },
    [touchMovement, drawerY, easeFunc, transition],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touchY = e.touches[0].clientY;
      touchMovement.track(touchY);
      const vel = touchMovement.calculateVelocity();

      const hasScrolled = contentScrollY.get() > 0;
      const isDismissing = drawerY.get() >= 0;
      const isUsingInitiatingScrollDown =
        !isDismissing && !hasScrolled && vel < 0;

      // ignore touch move after user start scrolling
      if (hasScrolled || isUsingInitiatingScrollDown) {
        return;
      }

      // reject touches that outside of the drawer panel
      if (touchY < drawerY.get()) {
        e.preventDefault();
        return;
      }

      // for some reason this is running when offset become zero:
      // making it unable to scroll down
      if (!gestureInitialStateRef.current) {
        gestureInitialStateRef.current = {
          y: e.touches[0].clientY,
          drawerOffsetY: drawerY.get(),
        };
        transition.set("instant");
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
      drawerY.set(newY);
    },
    [contentScrollY, transition, drawerY, touchMovement],
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

    // figure out the snapping
    const COMMIT_THRESHOLD = 0.75;
    const isOverCommitThreshold =
      (window.innerHeight - drawerY.get()) / window.innerHeight <
      COMMIT_THRESHOLD;

    const velocitySmoothed = touchMovement.calculateVelocity(3);
    const isFlick = velocitySmoothed > 10;
    const isCancelDirection = velocitySmoothed < 0;

    if ((isOverCommitThreshold && !isCancelDirection) || isFlick) {
      // enable motion
      transition.set("exit");
      // like bounce, the animation starts a frame later to make sure
      // motion is set to "interpolates" to trigger a smooth animation
      requestAnimationFrame(() => {
        drawerY.set(window.innerHeight);
      });
      onDismiss?.();
      return;
    }
    transition.set("enter");
    // same as above
    requestAnimationFrame(() => {
      drawerY.set(0);
    });
  }, [
    contentScrollY,
    transition,
    drawerY,
    touchMovement,
    compensateScrollDebounced,
    onDismiss,
  ]);

  const [isPresent, safeToRemove] = usePresence();

  // set the position to window height as an entry animation
  useLayoutEffect(() => {
    transition.set("instant");
    drawerY.set(window.innerHeight);
    drawerRef.current.focus();
  }, [drawerY, transition]);

  useEffect(() => {
    const sheet = drawerRef.current;
    if (isPresent) {
      // needs a slight delay so the enter animation can be reset to zero
      requestAnimationFrame(() => {
        transition.set("default");
        drawerY.set(0);
      });
      return;
    }

    sheet.addEventListener("transitionend", safeToRemove);
    return () => {
      sheet.removeEventListener("transitionend", safeToRemove);
    };
  }, [drawerY, isPresent, transition, safeToRemove]);

  // because we are using an invisible touch target at the background
  // to track finger gesture, it sits on top of the body, blocking all interactions.
  // for better user experience, we need to stop blocking it asap.
  useEffect(() => {
    if (!isPresent) {
      touchTargetRef.current.style.pointerEvents = "none";
      return;
    }
    touchTargetRef.current.style.pointerEvents = "all";
  }, [isPresent]);

  return (
    <div
      className="fixed inset-0 overflow-y-scroll overscroll-none"
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
        className="absolute will-change-transform  bg-blue-800 transition-(--transition) duration-(--duration) ease-(--easing)"
      >
        <div className="flex w-full items-center justify-center py-2">
          <div className={"h-1 w-12 bg-red-600"} />
        </div>
        {children}
      </div>
    </div>
  );
}
