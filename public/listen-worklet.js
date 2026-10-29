/*
 * Turns the mic into 50 ms frames of 16 kHz audio for the listener
 * (src/components/guide/hooks.ts). It runs on the audio thread, so frames
 * keep coming at an even pace however busy the page is.
 */
const RATE = 16000;
const FRAME = 800;

class Listen extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / RATE;
    this.pos = 0;
    this.sum = 0;
    this.n = 0;
    this.out = new Float32Array(FRAME);
    this.k = 0;
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      // each output sample is the average of the input samples it covers: a plain low-pass before dropping the rate
      this.sum += ch[i];
      this.n++;
      if (++this.pos >= this.step) {
        this.pos -= this.step;
        this.out[this.k++] = this.sum / this.n;
        this.sum = 0;
        this.n = 0;
        if (this.k === FRAME) {
          this.port.postMessage(this.out, [this.out.buffer]);
          this.out = new Float32Array(FRAME);
          this.k = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("hackea-listen", Listen);
