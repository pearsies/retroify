/**
 * Background Tab Execution Keepalive & Zero-Latency Task Pump
 *
 * Browsers throttle background tabs (setTimeout throttled to 1000ms, GPU deprioritized).
 * This module:
 * 1. Activates an inaudible Web Audio destination stream (registers the tab as an Active Media Tab,
 *    bypassing Chromium background CPU/GPU throttling completely).
 * 2. Requests Screen WakeLock API to keep the display and OS active during conversion.
 * 3. Provides fastYield() using MessageChannel (0ms delay macrotask that is never clamped to 1000ms).
 */

export function fastYield(): Promise<void> {
  if (typeof MessageChannel !== 'undefined') {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(null);
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export class BackgroundKeepalive {
  private wakeLock: unknown = null;
  private audioCtx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private isActive = false;

  public async start() {
    if (this.isActive) return;
    this.isActive = true;

    // 1. Request Screen WakeLock
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        this.wakeLock = await (navigator as unknown as {
          wakeLock: { request: (type: string) => Promise<unknown> };
        }).wakeLock.request('screen');
      }
    } catch {
      // Wake lock not permitted or supported; continue
    }

    // 2. Start inaudible audio keepalive (bypasses Chromium background tab throttling)
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        if (this.audioCtx.state === 'suspended') {
          await this.audioCtx.resume();
        }

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        // Inaudible gain (0.00001) connected to speakers keeps browser audio thread alive
        gain.gain.value = 0.00001;
        osc.frequency.value = 440;
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        this.oscillator = osc;
      }
    } catch {
      // AudioContext keepalive fallback
    }
  }

  public stop() {
    this.isActive = false;

    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch {
        // Ignore
      }
      this.oscillator = null;
    }

    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {
        // Ignore
      }
      this.audioCtx = null;
    }

    if (this.wakeLock) {
      try {
        (this.wakeLock as { release: () => Promise<void> }).release();
      } catch {
        // Ignore
      }
      this.wakeLock = null;
    }
  }
}
