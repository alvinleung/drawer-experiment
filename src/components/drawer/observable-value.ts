import { useRef, useMemo, RefObject, useEffect } from "react";

/*
 * Simple observable pattern utils for state management outside of the
 * react system. This is useful for isolating CSS related update for a more performant result.
 */
export function useObservableValue<T>(initial: T) {
  const initialValueFrozen = useRef(initial).current;
  return useMemo(
    () => new ObservableValue(initialValueFrozen),
    [initialValueFrozen],
  );
}

export function useObserveScroll<T extends HTMLElement>(ref: RefObject<T>) {
  const scroll = useObservableValue(0);
  useEffect(() => {
    const elm = ref.current;
    if (!elm) return;

    const handleScroll = () => {
      const latestScroll = elm.scrollTop;
      scroll.set(latestScroll);
    };
    handleScroll();
    elm.addEventListener("scroll", handleScroll);
    return () => {
      elm.removeEventListener("scroll", handleScroll);
    };
  }, [ref, scroll]);
  return scroll;
}

export function useObserve<T>(
  value: ObservableValue<T>,
  handler: ChangeHandler<T>,
  performOnMount = true,
) {
  useEffect(() => value.observe(handler, performOnMount));
}

type ChangeHandler<T> = (latest: T) => void;
export class ObservableValue<T> {
  private value: T;
  private prevValue?: T;
  private listeners = new Set<ChangeHandler<T>>();

  constructor(initial: T) {
    this.value = initial;
  }

  set(value: T, forceUpdate = false) {
    // don't fire update event when prev is equal the current value
    if (value === this.value && !forceUpdate) return;

    this.prevValue = this.value;
    this.value = value;

    for (const changeHandler of this.listeners) {
      changeHandler(this.value);
    }
  }

  setPreviousSilently(value: T) {
    this.prevValue = value;
  }

  observe(handler: ChangeHandler<T>, performOnMount = true) {
    if (this.listeners.has(handler)) {
      throw "listener already exist on observable value";
    }

    this.listeners.add(handler);
    if (performOnMount) handler(this.value);

    return () => {
      this.listeners.delete(handler);
    };
  }

  get() {
    return this.value;
  }

  getPrevious() {
    return this.prevValue;
  }
}
