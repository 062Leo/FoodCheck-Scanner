import { ScanGate } from '../ScanGate';

const A = '4006381333931';
const B = '96385074';

/** Simulates the camera reporting `code` every 100 ms between `from` and `to`. */
function detect(gate: ScanGate, code: string, from: number, to: number): number {
  let accepted = 0;
  for (let t = from; t <= to; t += 100) {
    if (gate.tryAcquire(code, t)) {
      accepted++;
      gate.release(t + 50);
    }
  }
  return accepted;
}

describe('ScanGate', () => {
  it('lets only one lookup run at a time', () => {
    const gate = new ScanGate();
    expect(gate.tryAcquire(A, 0)).toBe(true);
    expect(gate.tryAcquire(A, 10)).toBe(false);
    expect(gate.tryAcquire(B, 20)).toBe(false);
  });

  it('looks a code up once while it stays in front of the camera, however long', () => {
    const gate = new ScanGate(4000);
    expect(detect(gate, A, 0, 20000)).toBe(1);
  });

  it('accepts the same code again after it was out of view for the repeat delay', () => {
    const gate = new ScanGate(4000);
    detect(gate, A, 0, 2000);
    expect(gate.tryAcquire(A, 5000)).toBe(false);
    expect(gate.tryAcquire(A, 9500)).toBe(true);
  });

  it('accepts a different code right after a lookup finished', () => {
    const gate = new ScanGate();
    gate.tryAcquire(A, 0);
    gate.release(500);

    expect(gate.tryAcquire(B, 600)).toBe(true);
  });

  it('after closing the result, waits until the code has been out of view briefly', () => {
    const gate = new ScanGate(4000);
    gate.tryAcquire(A, 0);
    gate.release(500);
    gate.dismiss(1000, 1500);

    // Out of view after closing: accepted once the pause is over.
    expect(gate.tryAcquire(A, 2600)).toBe(true);
  });

  it('after closing the result, keeps ignoring the code while it stays in view', () => {
    const gate = new ScanGate(4000);
    gate.tryAcquire(A, 0);
    gate.release(500);
    gate.dismiss(1000, 1500);

    expect(detect(gate, A, 1100, 10000)).toBe(0);
  });

  it('lets manual entry and retry skip the repeat protection but not a running lookup', () => {
    const gate = new ScanGate(4000);
    gate.tryAcquire(A, 0);
    expect(gate.tryAcquire(A, 100, true)).toBe(false);
    gate.release(500);
    expect(gate.tryAcquire(A, 600, true)).toBe(true);
  });
});
