// src/ticker.ts
export interface Ticker {
  start(): void;
  stop(): void;
}

export function createTicker(opts: { intervalMs?: number; onTick: () => void }): Ticker {
  const intervalMs = opts.intervalMs ?? 30_000;
  let timer: ReturnType<typeof setInterval> | null = null;

  function fire(): void {
    try {
      opts.onTick();
    } catch {
      /* a throwing tick must never kill the interval or the host */
    }
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(fire, intervalMs);
      // Mandatory (v1 print-mode lesson): timers must not hold the host process open.
      timer.unref?.();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
