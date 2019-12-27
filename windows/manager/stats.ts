"use strict";
// License: MIT

const NUM_VALUES = 20;

class Sequence {
  protected readonly values: Uint32Array;

  protected fill: number;

  protected full: boolean;

  constructor() {
    this.values = new Uint32Array(NUM_VALUES);
  }

  get validValues() {
    return this.full ? this.values : this.values.slice(0, this.fill);
  }

  get current() {
    return this.fill ? this.values[this.fill - 1] : 0;
  }


  clear() {
    this.fill = 0;
    this.full = false;
  }

  add(value: number) {
    if (!this.full) {
      this.values[this.fill++] = value;
      this.full = this.fill === NUM_VALUES;
    }
    else {
      this.values.copyWithin(0, 1);
      this.values[NUM_VALUES - 1] = value;
    }
  }
}

export class Stats extends Sequence {
  public readonly avgs: Sequence;

  public avg: number;

  private lastTime: number;

  private samplingIntervalMs: number;

  private samplingAcc: number;

  constructor(samplingIntervalMs?: number) {
    super();
    this.avgs = new Sequence();
    this.samplingIntervalMs = samplingIntervalMs || 0;
    this.clear();
    Object.seal(this);
  }

  clear() {
    super.clear();
    this.avgs.clear();
    this.avg = 0;
    this.lastTime = 0;
    this.samplingAcc = 0;
  }

  add(value: number) {
    const now = Date.now();
    value += this.samplingAcc;

    if (this.lastTime) {
      const diff = now - this.lastTime;
      if (diff < this.samplingIntervalMs) {
        this.samplingAcc = value;
        return false;
      }
      value = (value / diff * 1000) | 0;
    }
    this.lastTime = now;

    super.add(value);

    const valid = this.validValues;
    const cavg = valid.reduce((p, c) => p + c, 0) / valid.length;
    if (this.avg < 1000) {
      this.avg = cavg;
    }
    else {
      // eslint-disable-next-line no-magic-numbers
      this.avg = this.avg * 0.85 + cavg * 0.15;
    }
    this.avgs.add(this.avg);

    return true;
  }
}
