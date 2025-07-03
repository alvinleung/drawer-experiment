import * as CSS from "csstype";

interface Transition {
  duration: number;
  easing: string;
  delay: number;
}

type AnimationAndTransitionProperties =
  | "transitionBehavior"
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

type CSSExcluteAnimationAndTransition = Pick<
  CSS.Properties,
  Exclude<keyof CSS.Properties, AnimationAndTransitionProperties>
>;

type TransitionOptions = { transition?: Partial<Transition> };
export type AnimationOptions = Partial<
  Record<keyof CSSExcluteAnimationAndTransition, string | number>
>;

export function animation<T extends HTMLElement, K extends AnimationOptions>(
  elm: T,
  initial: K & TransitionOptions,
) {
  const { transition: transitionConfig, ...initialConfig } = initial;

  const transition: Transition = {
    duration: 2,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    delay: 0,
    ...transitionConfig,
  };

  initial.transition = undefined;
  Object.assign(elm.style, initialConfig);

  let anim: Animation | undefined;

  type AnimatedCSSProps = Partial<Pick<K, Exclude<keyof K, "transition">>>;

  return {
    async to(css: AnimatedCSSProps & TransitionOptions) {
      if (anim) {
        anim.commitStyles();
        anim.cancel();
      }
      const prev: AnimatedCSSProps = {};
      for (const key of Object.keys(css)) {
        //@ts-expect-error yep the value is inconsistent, it was just how css works
        prev[key] = elm.style[key];
      }

      const transitionOption = css.transition;

      anim = elm.animate([prev as Keyframe, css as Keyframe], {
        duration: (transitionOption?.duration || transition.duration) * 1000,
        easing: transitionOption?.easing || transition.easing,
        delay: (transition.delay || transition.delay) * 1000,
        fill: "forwards",
        iterations: 1,
        composite: "replace",
      });

      try {
        return await anim.finished;
      } catch {
        return false;
      }
    },

    // set(css: AnimatedCSSProps) {
    //   Object.assign(elm.style, css);
    // },

    getComputed() {
      if (anim) {
        anim.commitStyles();
      }
      return getComputedStyle(elm);
    },

    stop() {
      // anim?.finish();
      const style = this.getComputed();
      anim?.cancel();
      anim = undefined;
      Object.assign(elm, style);
    },
  };
}
