import { useCallback, useMemo, useReducer, useRef } from "react";

type SnapPoint = number | string;

export interface SnapPointControl {
  snapPoints: SnapPoint[];
  currentIndex: number;
  navigateToIndex: (index: number) => void;
}

export function getSnapPointPixelY(point: SnapPoint): number {
  if (typeof point === "number") {
    return point * window.innerHeight;
  }
  if (point.endsWith("px")) {
    return parseInt(point.substring(-2));
  }
  if (point.endsWith("%")) {
    return parseInt(point.substring(-1)) * window.innerHeight;
  }
  throw "Cannot recognize unit, please use px or raw number as percentage";
}

/*
 * Calculates snap point based on drawer offset and velocity of the gesture
 * Returns null when the snap point is fully out of screen, it is a dismiss gesture
 */
export function resolveSnapPoint(
  snapPoints: SnapPoint[],
  yOffset: number,
  velocity: number,
) {
  const bottomOffset = window.innerHeight - yOffset;
  const sortedPoints = snapPoints.sort(
    (a, b) => getSnapPointPixelY(a) - getSnapPointPixelY(b),
  );

  let lowerIndex = -1;
  let lowerDist = window.innerHeight;
  let upperIndex = sortedPoints.length - 1;
  let upperDist = getSnapPointPixelY(sortedPoints[sortedPoints.length - 1]);

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const dist = bottomOffset - getSnapPointPixelY(sortedPoints[i]);
    if (dist < 0) {
      upperIndex = i;
      upperDist = dist;
      break;
    }
    lowerIndex = i;
    lowerDist = dist;
  }

  const isGestureStationary = Math.abs(velocity) < 2;

  if (isGestureStationary) {
    const isCloserToLower = Math.abs(lowerDist) < Math.abs(upperDist);
    const index = isCloserToLower ? lowerIndex : upperIndex;

    // -1 index means exit
    if (index === -1) return null;

    return {
      index,
      position: getSnapPointPixelY(sortedPoints[index]),
    };
  }

  const index = velocity < 0 ? upperIndex : lowerIndex;
  // -1 index means dismiss
  if (index === -1) return null;

  return {
    index,
    position: getSnapPointPixelY(sortedPoints[index]),
  };
}

/*
 * A hook for using snap point, it sorts the list and at the same time
 * resolve the positions
 */
export function useSnapPoint(snapPoints: SnapPoint[]): SnapPointControl {
  const [updateSignal, forceUpdate] = useReducer((prev) => prev + 1, 0);
  const currIndex = useRef(0);
  const navigateToIndex = useCallback((index: number) => {
    forceUpdate();
    currIndex.current = index;
  }, []);

  return useMemo(
    () => ({
      currentIndex: currIndex.current,
      navigateToIndex,
      snapPoints,
    }),
    // we DO want update signal to trigger a re-rendering of the memorized value
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigateToIndex, updateSignal, snapPoints],
  );
}
