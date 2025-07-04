import { ObservableValue } from "./drawer/observable-value";

type Transition = {
  duration: number;
  ease: string;
  delay: number;
};

export function areTransitionsEqual(t1: Transition, t2: Transition) {
  return (
    t1.ease === t2.ease && t1.delay === t2.delay && t1.duration === t2.duration
  );
}

type AnimationAndTransitionProperties =
  | "transition"
  | "transitionDelay"
  | "transitionDuration"
  | "transitionTimingFunction"
  | "transitionProperty"
  | "animation"
  | "animationDelay"
  | "animationDirection"
  | "animationDuration"
  | "animationFillMode"
  | "animationIterationCount"
  | "animationName"
  | "animationPlayState"
  | "animationTimingFunction";

type TransitionProperties = Pick<
  CSSStyleDeclaration,
  Exclude<keyof CSSStyleDeclaration, AnimationAndTransitionProperties>
>;

export function start(
  element: HTMLElement,
  css: TransitionProperties,
  easing: Transition,
) {
  element.style.transitionDelay = `${easing.delay}s`;
  element.style.transitionDuration = `${easing.duration}s`;
  element.style.transitionTimingFunction = easing.ease;
  element.style.transitionProperty = getAnimatingProperties(css);

  requestAnimationFrame(() => Object.assign(element.style, css));
}

function getAnimatingProperties(css: TransitionProperties) {
  // const allPropertiesCamelCase = Object.keys(css);
  if (css.length === 1 && css.opacity) {
    return "opacity";
  }
  return "all";
}

const DEFAULT_TRANSITION: Transition = {
  duration: 0.5,
  ease: "",
  delay: 0,
};

export class AnimationValue<T, E extends HTMLElement> {
  private value: ObservableValue<T>;
  private element: E;
  private currentTransition: Transition;
  private transitioning: boolean = false;

  constructor(element: E, initial: T) {
    this.value = new ObservableValue(initial);
    this.element = element;
    this.currentTransition = DEFAULT_TRANSITION;

    this.element.addEventListener(
      "transitionrun",
      this.handleTransitionStart.bind(this),
    );
    this.element.addEventListener(
      "transitionstart",
      this.handleTransitionStart.bind(this),
    );
    this.element.addEventListener(
      "transitionend",
      this.handleTransitionEnd.bind(this),
    );
    this.element.addEventListener(
      "transitioncancel",
      this.handleTransitionEnd.bind(this),
    );
  }

  private handleTransitionStart() {
    this.transitioning = true;
  }

  private handleTransitionEnd() {
    this.transitioning = false;
    console.log(this.transitioning);
  }

  animate(value: T, transition?: Partial<Transition>) {
    if (transition) {
      this.lazyUpdateTransitionDOM(transition);
    }

    return new Promise((resolve, reject) => {
      resolve(true);
      this.value.set(value);
      reject(false);
    });
  }

  private lazyUpdateTransitionDOM(transition: Partial<Transition>) {
    if (transition.ease !== undefined) {
      this.element.style.transitionTimingFunction = transition.ease;
    }
    if (transition.duration !== undefined) {
      this.element.style.transitionDuration = `${transition.duration}s`;
    }
    if (transition.delay !== undefined) {
      this.element.style.transitionDelay = `${transition.delay}s`;
    }
    Object.assign(this.currentTransition, transition);
  }

  jump(value: T) {
    this.value.set(value);
  }

  get() {
    return this.value.get();
  }
  getPrevious() {
    return this.value.getPrevious();
  }

  observe(handler: (latest: T) => void) {
    return this.value.observe(handler);
  }
}
