export class SimulatedFailureError extends Error {
  constructor(step: string) {
    super(`Simulated failure at step: ${step}`);
    this.name = 'SimulatedFailureError';
  }
}
