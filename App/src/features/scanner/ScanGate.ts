/**
 * Decides which barcode detections start a lookup. The camera reports the same code
 * many times per second; a ref-based gate (not React state) makes sure only one
 * lookup runs at a time and a code still in view is not looked up again.
 */
export class ScanGate {
  private busy = false;
  private lastCode: string | null = null;
  private ignoreUntil = 0;

  constructor(
    /** How long the same code is ignored after it was handled. */
    private readonly repeatDelayMs = 4000
  ) {}

  /**
   * Returns true and locks the gate if a lookup for `code` should start now.
   * `explicit` (manual entry, retry) skips the repeat protection.
   */
  tryAcquire(code: string, now: number, explicit = false): boolean {
    if (!explicit && code === this.lastCode && now < this.ignoreUntil) {
      // Still in view: keep ignoring it for as long as the camera keeps seeing it.
      this.ignoreUntil = now + this.repeatDelayMs;
      return false;
    }
    if (this.busy) return false;
    this.busy = true;
    this.lastCode = code;
    this.ignoreUntil = now + this.repeatDelayMs;
    return true;
  }

  /** The lookup finished; other codes may start a new one. */
  release(now: number): void {
    this.busy = false;
    this.ignoreUntil = Math.max(this.ignoreUntil, now + this.repeatDelayMs);
  }

  /**
   * The user closed the result: the same code is accepted again once it has been out
   * of view for `pauseMs` (detections while it stays in view extend the pause).
   */
  dismiss(now: number, pauseMs = 1500): void {
    this.ignoreUntil = now + pauseMs;
  }

  get isBusy(): boolean {
    return this.busy;
  }
}
