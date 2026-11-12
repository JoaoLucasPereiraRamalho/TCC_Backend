/**
 * Porta do relógio. Código de regra nunca chama new Date() ou Date.now():
 * recebe um Clock, o que torna a gamificação determinística e testável (RNF06).
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Relógio fixo para testes. Pode ser avançado manualmente. */
export class FixedClock implements Clock {
  private current: Date;

  constructor(initial: Date | string) {
    this.current = new Date(initial);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(instant: Date | string): void {
    this.current = new Date(instant);
  }

  advanceBy(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
