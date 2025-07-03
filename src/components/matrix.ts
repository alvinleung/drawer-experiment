type TransformConfig = {
  scaleX?: number;
  scaleY?: number;
  skewX?: number; // degrees
  skewY?: number; // degrees
  rotate?: number; // degrees
  x?: number; // translateX
  y?: number; // translateY
};

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

export function matrix(config: TransformConfig = {}): string {
  const { scaleX = 1, scaleY = 1, skewX, skewY, rotate, x = 0, y = 0 } = config;

  let a = scaleX;
  let b = 0;
  let c = 0;
  let d = scaleY;

  const hasRotation = typeof rotate === "number";
  const hasSkew = typeof skewX === "number" || typeof skewY === "number";

  if (hasRotation || hasSkew) {
    let cos = 1,
      sin = 0;

    if (hasRotation) {
      const rad = toRadians(rotate!);
      cos = Math.cos(rad);
      sin = Math.sin(rad);
    }

    a = scaleX * cos;
    b = scaleX * sin;
    c = -scaleY * sin;
    d = scaleY * cos;

    if (typeof skewX === "number") {
      c += Math.tan(toRadians(skewX));
    }
    if (typeof skewY === "number") {
      b += Math.tan(toRadians(skewY));
    }
  }

  return `matrix(${a}, ${b}, ${c}, ${d}, ${x}, ${y})`;
}
