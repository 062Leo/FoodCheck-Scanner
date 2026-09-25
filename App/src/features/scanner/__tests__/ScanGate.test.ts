import { ScanGate } from '../ScanGate';

describe('ScanGate', () => {
  it('lets only one lookup run at a time', () => {
    const gate = new ScanGate();
    expect(gate.tryAcquire('4006381333931', 0)).toBe(true);
    expect(gate.tryAcquire('4006381333931', 10)).toBe(false);
    expect(gate.tryAcquire('96385074', 20)).toBe(false);
  });

  it('ignores the same code while it stays in view after the lookup', () => {
    const gate = new ScanGate(4000);
    gate.tryAcquire('4006381333931', 0);
    gate.release(500);

    expect(gate.tryAcquire('4006381333931', 3000)).toBe(false);
    expect(gate.tryAcquire('4006381333931', 4600)).toBe(true);
  });

  it('accepts a different code right after a lookup finished', () => {
    const gate = new ScanGate();
    gate.tryAcquire('4006381333931', 0);
    gate.release(500);

    expect(gate.tryAcquire('96385074', 600)).toBe(true);
  });

  it('allows the same code again shortly after the result was closed', () => {
    const gate = new ScanGate(4000);
    gate.tryAcquire('4006381333931', 0);
    gate.release(500);
    gate.dismiss(1000, 1500);

    expect(gate.tryAcquire('4006381333931', 2000)).toBe(false);
    expect(gate.tryAcquire('4006381333931', 2600)).toBe(true);
  });

  it('lets manual entry and retry skip the repeat protection but not a running lookup', () => {
    const gate = new ScanGate(4000);
    gate.tryAcquire('4006381333931', 0);
    expect(gate.tryAcquire('4006381333931', 100, true)).toBe(false);
    gate.release(500);
    expect(gate.tryAcquire('4006381333931', 600, true)).toBe(true);
  });
});
