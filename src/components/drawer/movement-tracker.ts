/**
 * MovenetTracker is a utility class that observes how a value changes
 * across time. Right now only calculateVelocity is implemented, but
 * one may imagine impelmented extra functionality like finding a smoothed
 * out average of a value etc etc.
 */
export class MovementTracker {
  private movementBufferSize = 3;
  private movementBuffer: number[] = [];

  track(val: number) {
    this.movementBuffer.push(val);
    if (this.movementBuffer.length > this.movementBufferSize) {
      this.movementBuffer.shift();
    }
  }

  calculateVelocity(window: number = 2) {
    // needs at least 2 entry to calculate velocity
    if (this.movementBuffer.length <= 2) {
      return 0;
    }

    let sumOfVel = 0;
    const count = Math.min(this.movementBuffer.length, window);
    for (let i = 1; i < count; i++) {
      const vel = this.movementBuffer[i] - this.movementBuffer[i - 1];
      sumOfVel += vel;
    }

    return sumOfVel / count;
  }

  getMovement() {
    return [...this.movementBuffer];
  }

  reset() {
    this.movementBuffer.length = 0;
  }
}
