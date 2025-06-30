"use client";

import { createSpring } from "@/components/spring-motion";
import { RefObject, useCallback, useEffect, useMemo, useRef } from "react";

/*
 * Right now the browser is responding to spring:
 * but there are a few interesting unresolved problem.
 *
 * Fristly:
 *
 * When we redirect the ball, all the momentum was lost.
 * It become a simple snap.
 *
 * To address this, the approach is to calulate the velocity when redirection happens.
 * And feed that velocity into a new spring calculation.
 *
 * Secondly:
 *
 * Spring value often best decoupled with different Axis so the damping is realistic when you
 * animating both axis XY. But this could be out of scope of our simple use case of animating
 * a raousel
 *
 * Thridly:
 *
 * The duration of the spring animation should be scaled with the distance it tranvels.
 * Right now it is focusing on the use of zero-one
 *
 */

export default function Home() {
  const blockRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;

  /* const posX = useSpring(0, {
    stiffness: 170,
    damping: 25,
    velocity: 0,
    mass: 1,
  });
  const posY = useSpring(0, {
    stiffness: 170,
    damping: 25,
    velocity: 0,
    mass: 1,
  }); */

  const spring = useMemo(
    () =>
      createSpring({
        stiffness: 170,
        damping: 25,
        velocity: 0,
        mass: 1,
      }),
    [],
  );

  useEffect(() => {
    const block = blockRef.current;
    if (block === undefined) {
      return;
    }

    block.style.transition = `transform`;
    block.style.transitionTimingFunction = spring.timingFunction;
    // block.style.transitionTimingFunction = `cubic-bezier(0.16, 1, 0.3, 1)`;

    block.style.transitionDuration = `${spring.duration}s`;
  }, [spring.duration, spring.timingFunction]);

  const lastChangeRef = useRef(0);
  const handleClick = useCallback((e: React.MouseEvent) => {
    const block = blockRef.current;
    if (block === undefined) {
      return;
    }

    const current = performance.now();
    const elapsedTime = current - lastChangeRef.current;
    lastChangeRef.current = current;

    // const currValue = spring.solve(elapsedTime);
    // console.log(currValue);

    // block.style.transitionTimingFunction = `cubic-bezier(0.25, 1, 0.5, 1)`;
    // block.style.transitionTimingFunction = `linear`;
    block.style.transform = `translateX(${e.clientX}px) translateY(${e.clientY}px)`;

    /* posX.set(e.clientX + 24);
      posY.set(e.clientY + 24); */
  }, []);

  return (
    <div onClick={handleClick} className="w-screen h-screen">
      <div ref={blockRef} className="bg-red-600 size-6  rounded-xl"></div>
      {/* <motion.div */}
      {/*   style={{ x: posX, y: posY }} */}
      {/*   className="bg-blue-600 size-6  rounded-xl" */}
      {/* ></motion.div> */}
    </div>
  );
}
