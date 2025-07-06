import { RefObject, useEffect, useState } from "react";
import { useObservableValue } from "../animation/observable-value";

export const clamp = (min: number, max: number, value: number) =>
  Math.max(min, Math.min(max, value));

export const getTransitionDurationSeconds = (
  computedStyle: CSSStyleDeclaration,
) => {
  const durationStr = computedStyle.transitionDuration;
  return durationStr.includes("ms")
    ? parseFloat(durationStr) / 1000
    : parseFloat(durationStr);
};
export const getTranslateY = (computedStyle: CSSStyleDeclaration) => {
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

export function useHasActiveTransition<T extends HTMLElement>(
  ref: RefObject<T>,
) {
  const hasActiveTransition = useObservableValue(false);

  useEffect(() => {
    const elm = ref.current;
    if (!elm) return;

    const start = () => {
      hasActiveTransition.set(true);
    };
    const end = () => {
      hasActiveTransition.set(false);
    };

    elm.addEventListener("transitionrun", start);
    elm.addEventListener("transitionstart", start);
    elm.addEventListener("transitionend", end);
    elm.addEventListener("transitioncancel", end);

    return () => {
      elm.removeEventListener("transitionrun", start);
      elm.removeEventListener("transitionstart", start);
      elm.removeEventListener("transitionend", end);
      elm.removeEventListener("transitioncancel", end);
    };
  }, [hasActiveTransition, ref]);

  return hasActiveTransition;
}

export function fireEventListenerOnce<
  T extends HTMLElement,
  K extends keyof HTMLElementEventMap,
>(
  element: T,
  type: K,
  listener: (this: T, ev: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions,
): void {
  const handler = (e: HTMLElementEventMap[K]) => {
    listener.call(element, e);
    element.removeEventListener(type, handler, options);
  };
  element.addEventListener(type, handler, options);
}

export function startTransition<T extends HTMLElement>(
  elm: T,
  safelyPerformTransition: () => void,
) {
  return new Promise<void>((resolve, reject) => {
    const end = () => {
      cleanupListeners();
      resolve();
    };
    const cancel = () => {
      cleanupListeners();
      reject();
    };
    const cleanupListeners = () => {
      elm.removeEventListener("transitionend", end);
      elm.removeEventListener("transitioncancel", cancel);
    };

    let hasStarted = false;
    const start = () => {
      hasStarted = true;
      elm.removeEventListener("transitionstart", start);
      elm.removeEventListener("transitionstrun", start);
    };

    elm.addEventListener("transitionstart", start);
    elm.addEventListener("transitionstrun", start);
    elm.addEventListener("transitionend", end);
    elm.addEventListener("transitioncancel", cancel);

    safelyPerformTransition();
    requestAnimationFrame(() => {
      if (!hasStarted) {
        end();
      }
    });
  });
}
