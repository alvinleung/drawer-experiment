// SEE: https://linear-easing-generator.netlify.app/
// SEE: https://developer.chrome.com/docs/css-ui/css-linear-easing-function

export interface SpringOptions {
  mass: number;
  stiffness: number;
  damping: number;
  velocity: number;
}

interface SpringSolver {
  duration: number;
  solve: (t: number) => number;
}

/*
 *
 * returns:
 * [duration (seconds), resolve(time)] // time in second
 */
export function createSpringSolver({
  mass,
  stiffness,
  damping,
  velocity,
}: SpringOptions): SpringSolver {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const wd = zeta < 1 ? w0 * Math.sqrt(1 - zeta * zeta) : 0;
  const b = zeta < 1 ? (zeta * w0 + -velocity) / wd : -velocity + w0;

  function solver(t: number): number {
    if (zeta < 1) {
      t =
        Math.exp(-t * zeta * w0) *
        (1 * Math.cos(wd * t) + b * Math.sin(wd * t));
    } else {
      t = (1 + b * t) * Math.exp(-t * w0);
    }

    return 1 - t;
  }

  const duration = (() => {
    const step = 1 / 6;
    let time = 0;
    const RESTING_THRESHOLD = 0.1;
    while (true) {
      // this is where you can change the stopping precision
      if (Math.abs(1 - solver(time)) < RESTING_THRESHOLD) {
        const restStart = time;
        let restSteps = 1;
        while (true) {
          time += step;
          if (Math.abs(1 - solver(time)) >= RESTING_THRESHOLD) break;
          restSteps++;
          if (restSteps === 16) return restStart;
        }
      }
      time += step;
    }
  })();

  return { duration, solve: (t: number) => solver(duration * t) };
}

export function createSpringTimingFunction(
  solver: SpringSolver,
  stepCount = 24,
) {
  const { solve, duration } = solver;
  const steps: { value: number; progress: number }[] = [];

  // trace out each step to build the css linea timing function
  for (let i = 0; i < stepCount - 1; i++) {
    const progress = i / (stepCount - 1);
    const value = solve(progress * duration);
    steps.push({ value, progress });
  }

  // add the last step to make sure it step on 1
  steps.push({ value: 1, progress: 1 });

  const stepString = steps.map(
    ({ progress, value }) => `${value} ${progress * 100}%`,
  );

  const cssEasingString = stepString.join(",");
  return `linear(${cssEasingString})`;
}

export function createSpring(options?: Partial<SpringOptions>) {
  const spring = createSpringSolver({
    mass: 1,
    damping: 27,
    stiffness: 172,
    velocity: 0,
    ...options,
  });
  const timingFunction = createSpringTimingFunction(spring);

  return {
    duration: spring.duration,
    timingFunction,
    solve: spring.solve,
  };
}
