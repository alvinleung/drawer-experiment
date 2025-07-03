const allPlots: Record<string, Graph> = {};
let basePlotElm: HTMLDivElement;

export function plot(key: string, value: number) {
  if (!basePlotElm) {
    basePlotElm = document.createElement("div");
    Object.assign(basePlotElm.style, {
      position: "fixed",
      top: "0px",
      right: "0px",
      zIndex: "10000000000",
    } as CSSStyleDeclaration);
    document.body.appendChild(basePlotElm);
  }
  if (!allPlots[key]) {
    allPlots[key] = new Graph(key);
    basePlotElm.appendChild(allPlots[key].canvas);
  }
  const plot = allPlots[key];
  plot.plot(value);
}
//https://chatgpt.com/share/68634f98-5604-8009-adc6-27f17f1f7a54
class Graph {
  public canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private points: number[] = [];
  private graphName: string;

  constructor(name: string, width: number = 120, height: number = 40) {
    this.graphName = name;
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;

    const context = this.canvas.getContext("2d");
    if (!context) throw "Unable to initialize canvas";

    this.canvas.style.border = "1px solid #444";
    this.context = context;
  }

  plot(value: number) {
    this.points.push(value);
    this.render();
  }

  private getMinMax(): [number, number] {
    if (this.points.length === 0) return [-1, 1];
    let min = Infinity;
    let max = -Infinity;
    for (const val of this.points) {
      if (val < min) min = val;
      if (val > max) max = val;
    }
    if (min === max) {
      min -= 1;
      max += 1;
    }
    return [min, max];
  }

  private drawGrid(xStep: number, yStep: number) {
    const ctx = this.context;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;

    // Vertical grid lines
    for (let x = 0; x <= width; x += xStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let y = 0; y <= height; y += yStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  render(xStep = 5, yStep = 5) {
    const ctx = this.context;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Background
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, width, height);

    // Grid
    this.drawGrid(xStep, yStep);

    const maxVisiblePoints = Math.floor(width / xStep);
    const visiblePoints = this.points.slice(-maxVisiblePoints);
    const [min, max] = this.getMinMax();

    const valueRange = max - min;
    const valueToY = (v: number) => {
      const norm = (v - min) / valueRange;
      return height - norm * height;
    };

    // y = 0 line
    if (min < 0 && max > 0) {
      const yZero = valueToY(0);
      ctx.beginPath();
      ctx.moveTo(0, yZero);
      ctx.lineTo(width, yZero);
      ctx.strokeStyle = "#888";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Graph line
    const startX = width - visiblePoints.length * xStep;
    ctx.beginPath();
    visiblePoints.forEach((value, index) => {
      const x = startX + index * xStep;
      const y = valueToY(value);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#4FC3F7";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Graph name + latest value
    const latest = visiblePoints[visiblePoints.length - 1];
    const label = `${this.graphName}: ${latest.toFixed(2)}`;
    ctx.fillStyle = "#ccc";
    ctx.font = "12px sans-serif";
    ctx.fillText(label, 4, height - 4);
  }
}
