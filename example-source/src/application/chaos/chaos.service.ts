import { Injectable } from '@nestjs/common';

export type FailAtStep = 'inventory' | 'payment' | null;

@Injectable()
export class ChaosService {
  failAtStep: FailAtStep = null;

  shouldFail(step: string): boolean {
    return this.failAtStep === step;
  }
}
