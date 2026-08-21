export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before tripping (default 3)
  timeoutMs?: number; // Request timeout before counting as failure (default 5000ms)
  resetTimeoutMs?: number; // Duration to remain OPEN before testing HALF_OPEN (default 10000ms)
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private nextAttempt = Date.now();

  private failureThreshold: number;
  private timeoutMs: number;
  private resetTimeoutMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.timeoutMs = options.timeoutMs || 5000;
    this.resetTimeoutMs = options.resetTimeoutMs || 10000;
  }

  public async execute<T>(fn: () => Promise<T>, fallbackFn?: () => T): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() > this.nextAttempt) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        if (fallbackFn) return fallbackFn();
        throw new Error('Circuit breaker is OPEN. Fast-failing external dependency.');
      }
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Dependency timeout exceeded')), this.timeoutMs);
      });

      const result = await Promise.race([fn(), timeoutPromise]);

      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      if (fallbackFn) return fallbackFn();
      throw err;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
      console.warn(`[CircuitBreaker] Circuit TRIPPED to OPEN. Pausing requests for ${this.resetTimeoutMs}ms.`);
    }
  }

  public getState(): CircuitState {
    return this.state;
  }
}
