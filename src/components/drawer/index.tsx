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
  executeEventListenerOnce,
  getTransitionDurationSeconds,
  getTranslateY,
  useHasActiveTransition,
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
  const touchTargetRef = useRef<HTMLDivElement>(
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
      touchTargetRef.current.style.overflowY = "scroll";
      return;
    }
    // Uses "visible" instead of "hidden" to lock scroll. This  will
    // make sure the browser is ready to render the clipped part of the content
    touchTargetRef.current.style.overflowY = "visible";
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
  });

  // Interruptable gesture:
  //
  // To achieve interruptable gesture, the appoach here seamlessly blend scroll and
  // the dismiss gesture together. Mobile browser numerous constraints that make it
  // really difficault to achieve this. For example, it is nearly impossible to
  // initiate scroll that mimic native scroll momentum. Making gesture continuation
  // a very tricky to deal with.
  //
  // The final solution here take advantage the fact that the browser will intercept
  // the manipulation of drawerY and turn that into a scroll gesture if there is room
  // to be scrolled. For instance, you swipe up with touch but the content has room
  // to scroll down as a respond to the gesture, it will scroll down.
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

        // delay executing the compesnation if the finger is still on the screen
        if (isTouching.current) {
          executeEventListenerOnce(
            touchTargetRef.current,
            "touchend",
            compensateScrollDebounced,
          );
          return;
        }

        const computedStyle = getComputedStyle(drawerRef.current);
        const remaindingOffset = getTranslateY(computedStyle);
        const scrollOffest = touchTargetRef.current.scrollTop;

        if (scrollOffest < remaindingOffset) {
          // visually match the scroll with drawerY
          transition.set("instant");
          drawerY.set(remaindingOffset - scrollOffest);
          scrollContainer.scrollTo({
            top: 0,
          });

          const snapBackToTop = () => {
            transition.set("default");
            drawerY.set(0);
          };
          if (isTouching.current) {
            executeEventListenerOnce(
              touchTargetRef.current,
              "touchend",
              snapBackToTop,
            );
            return;
          }
          snapBackToTop();
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

  // ======================================================================
  //
  //
  // TOUCH EVENT HANDLER
  //
  //
  // ======================================================================

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isTouching.current = true;

      if (scrollCompensateTimeoutRef.current)
        clearTimeout(scrollCompensateTimeoutRef.current);

      const elm = drawerRef.current;
      const computedStyle = getComputedStyle(elm);
      const currentY = getTranslateY(computedStyle);
      const touchY = e.touches[0].clientY;

      // reject touches that outside of the drawer panel
      if (touchY < currentY) {
        // e.preventDefault();
        return;
      }

      const interceptedPosition = getInterruptedDrawerPosition(computedStyle);
      if (interceptedPosition) {
        const clamped = clamp(0, window.innerHeight, interceptedPosition);
        transition.set("instant");
        drawerY.set(clamped, true);
      }

      touchMovement.reset();
      touchMovement.track(touchY);
    },
    [getInterruptedDrawerPosition, touchMovement, transition, drawerY],
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
      // (we are using a dedicated fixed div to detect touch)
      if (touchY < drawerY.get()) {
        return;
      }

      // We initiate the gesture if it hasn't been initiated
      // Initiation is done here because invalid drag gesture may become
      // valid in the middle of the touch press
      if (!gestureInitialStateRef.current) {
        gestureInitialStateRef.current = {
          y: e.touches[0].clientY,
          drawerOffsetY: drawerY.get(),
        };
        transition.set("instant");
        isTouching.current = true;
      }

      const touchOffset = gestureInitialStateRef.current.y - touchY;

      const isDraggingDown = touchOffset < 0;
      const isFirstSnapPoint = snapControl.currentIndex === 0;
      const shouldApplyResistence = isFirstSnapPoint && isDraggingDown ? 1 : 0;

      const resistence =
        touchOffset * dismissResistence * shouldApplyResistence;

      const newPosition =
        gestureInitialStateRef.current.drawerOffsetY - touchOffset + resistence;
      const clampedNewPosition = clamp(0, window.innerHeight, newPosition);

      // render it to the dom
      drawerY.set(clampedNewPosition);
    },
    [
      touchMovement,
      contentScrollY,
      drawerY,
      snapControl.currentIndex,
      dismissResistence,
      transition,
    ],
  );

  const handleTouchEnd = useCallback(() => {
    //reset the gesture
    gestureInitialStateRef.current = null;
    isTouching.current = false;

    const velocitySmoothed = touchMovement.calculateVelocity(3);

    // trigger the compensation sequence if part of the
    // scroll is done by body scrolling
    if (contentScrollY.get() > 0) {
      compensateScrollDebounced();
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
    contentScrollY,
    drawerY,
    touchMovement,
    snapControl,
    compensateScrollDebounced,
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

        const isLastSnapPoint =
          snapControl.currentIndex === snapControl.snapPoints.length - 1;
        canScroll.set(isLastSnapPoint);
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
      className="select-none fixed inset-0 overscroll-none transition-colors"
      ref={touchTargetRef}
      // HACK:
      // put the touch detection at a stationary div
      // because the browser seems to be unable to catch up with the animation hit box
      // it fails to register touch when the drawer sheet is beginning out of the screen
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      onClick={() => {
        onDismiss?.();
      }}
    >
      <div ref={heightHolderRef} className="overflow-clip">
        <div
          ref={drawerRef}
          onClickCapture={(e) => e.stopPropagation()}
          className="absolute top-6 rounded-t-2xl will-change-transform  bg-gray-700 transition-(--transition) duration-(--duration) ease-(--easing)"
        >
          <div className="flex w-full items-center justify-center py-2">
            <div className={"h-1 w-12 bg-red-600"} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
