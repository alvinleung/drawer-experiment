type Transition = {
  duration: number;
  ease: string;
  delay: number;
};

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
