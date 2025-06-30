// SEE: https://linear-easing-generator.netlify.app/?codeType=js&code=const+%5Bduration%2C+func%5D+%3D+createSpring%28%7B%0A++mass%3A+1%2C%0A++stiffness%3A+100%2C%0A++damping%3A+10%2C%0A++velocity%3A+0%2C%0A%7D%29%3B%0A%0A%2F*%0A++Export+your+easing+function+as+a+global.%0A++The+name+you+use+here+will+appear+in+the+output.%0A++The+easing+function+must+take+a+number+as+input%2C%0A++where+0+is+the+start%2C+and+1+is+the+end.%0A++It+must+return+the+%27eased%27+value.%0A*%2F%0Aself.spring+%3D+func%3B%0A%2F*%0A++Some+easings+have+an+ideal+duration%2C+like+this+one.%0A++You+can+export+it+to+the+global%2C+in+milliseconds%2C%0A++and+it+will+be+used+in+the+output.%0A++This+is+optional.%0A*%2F%0Aself.duration+%3D+duration%3B%0A%0Afunction+createSpring%28%7B+mass%2C+stiffness%2C+damping%2C+velocity+%7D%29+%7B%0A++const+w0+%3D+Math.sqrt%28stiffness+%2F+mass%29%3B%0A++const+zeta+%3D+damping+%2F+%282+*+Math.sqrt%28stiffness+*+mass%29%29%3B%0A++const+wd+%3D+zeta+%3C+1+%3F+w0+*+Math.sqrt%281+-+zeta+*+zeta%29+%3A+0%3B%0A++const+b+%3D+zeta+%3C+1+%3F+%28zeta+*+w0+%2B+-velocity%29+%2F+wd+%3A+-velocity+%2B+w0%3B%0A%0A++function+solver%28t%29+%7B%0A++++if+%28zeta+%3C+1%29+%7B%0A++++++t+%3D%0A++++++++Math.exp%28-t+*+zeta+*+w0%29+*%0A++++++++%281+*+Math.cos%28wd+*+t%29+%2B+b+*+Math.sin%28wd+*+t%29%29%3B%0A++++%7D+else+%7B%0A++++++t+%3D+%281+%2B+b+*+t%29+*+Math.exp%28-t+*+w0%29%3B%0A++++%7D%0A%0A++++return+1+-+t%3B%0A++%7D%0A%0A++const+duration+%3D+%28%28%29+%3D%3E+%7B%0A++++const+step+%3D+1+%2F+6%3B%0A++++let+time+%3D+0%3B%0A%0A++++while+%28true%29+%7B%0A++++++if+%28Math.abs%281+-+solver%28time%29%29+%3C+0.001%29+%7B%0A++++++++const+restStart+%3D+time%3B%0A++++++++let+restSteps+%3D+1%3B%0A++++++++while+%28true%29+%7B%0A++++++++++time+%2B%3D+step%3B%0A++++++++++if+%28Math.abs%281+-+solver%28time%29%29+%3E%3D+0.001%29+break%3B%0A++++++++++restSteps%2B%2B%3B%0A++++++++++if+%28restSteps+%3D%3D%3D+16%29+return+restStart%3B%0A++++++++%7D%0A++++++%7D%0A++++++time+%2B%3D+step%3B%0A++++%7D%0A++%7D%29%28%29%3B%0A%0A++return+%5Bduration+*+1000%2C+%28t%29+%3D%3E+solver%28duration+*+t%29%5D%3B%0A%7D&simplify=0.011835902864259&round=3
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
    const RESTING_THRESHOLD = 0.0001;
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
  stepCount = 32,
) {
  const { solve, duration } = solver;
  const steps: { value: number; progress: number }[] = [];

  // trace out each step to build the css linea timing function
  for (let i = 0; i < stepCount - 1; i++) {
    const progress = i / (stepCount - 1);
    steps.push({ value: solve(progress * duration), progress });
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
