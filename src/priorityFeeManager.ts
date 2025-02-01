export class PriorityFeeManager {
  private static readonly FEE_INCREASE = 25000;
  private static readonly VARIANCE_BELOW = 0.05;
  private static readonly VARIANCE_ABOVE = 0.10;
  
  private baseFee: number;
  private consecutiveFailures: number = 0;

  constructor(initialFee: number) {
    this.baseFee = Math.max(initialFee);
  }

  private getRandomizedFee(): number {
    const minFee = this.baseFee * (1 - PriorityFeeManager.VARIANCE_BELOW);
    const maxFee = this.baseFee * (1 + PriorityFeeManager.VARIANCE_ABOVE);
    return Math.floor(minFee + (Math.random() * (maxFee - minFee)));
  }

  public getCurrentFee(): number {
    return this.getRandomizedFee();
  }

  public onError(): void {
    this.consecutiveFailures++;
    this.baseFee = Math.min(
      this.baseFee + PriorityFeeManager.FEE_INCREASE * this.consecutiveFailures,
    );
  }

  public onSuccess(): void {
    if (this.consecutiveFailures > 0) {
      this.consecutiveFailures = 0;
      this.baseFee = Math.max(
        this.baseFee - PriorityFeeManager.FEE_INCREASE
      );
    }
  }
} 