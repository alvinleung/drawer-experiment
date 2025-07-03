"use client";
import { matrix } from "@/components/matrix";

import { RefObject, useEffect, useRef, useState } from "react";
import { animation } from "./animation-utils";

export default function AnimationExperiment() {
  const ref = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;
  const [val, setVal] = useState("");

  useEffect(() => {
    const elm = ref.current;

    const anim = animation(elm, {
      opacity: 1,
      transform: matrix({ x: 0 }),
      transition: {
        duration: 10,
      },
    });

    document.body.onpointerdown = (e: MouseEvent) => {
      anim.to({
        opacity: Math.random(),
        transform: matrix({ x: e.clientX }),
        transition: {
          duration: 2,
        },
      });
    };

    document.body.onpointerup = () => {
      anim.stop();
    };
  }, []);

  return (
    <div>
      <div ref={ref} className="bg-red-400 size-20"></div>; {val}
      <div className="bg-blue-500 size-20" style={{ transform: val }}></div>
      position at 20ms
    </div>
  );
}
const getTranslateX = (computedStyle: CSSStyleDeclaration) => {
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

/* function Animated({
  animate,
  children,
  ...props
}: { animate?: AnimationOptions } & PropsWithChildren<
  React.HTMLProps<HTMLDivElement>
>) {
  const ref = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;
  const anim = useRef<ReturnType<typeof animation> | null>(null);
  useEffect(() => {
    if (!animate) return;
    if (!anim.current) {
      anim.current = animation(ref.current, animate);
      return;
    }
    anim.current.to(animate);
  }, [animate]);
  return (
    <div {...props} ref={ref}>
      {children}
    </div>
  );
} */
