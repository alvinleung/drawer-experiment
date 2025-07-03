"use client";
import { matrix } from "@/components/matrix";

import { RefObject, useEffect, useRef, useState } from "react";
import { animation } from "./animation-utils";

export default function AnimationExperiment() {
  const ref = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;
  const [val] = useState("");

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
