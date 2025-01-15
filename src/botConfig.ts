import { CONFIG } from './setup';

export class BotConfig {
  private static readonly LAMPORTS_PER_SOL = 1e9;

  public readonly targetVolume: number;
  public readonly buyAmount: { min: number; max: number };
  public readonly amountVariance: number = 0.05;
  public readonly minTradeAmount: number;
  public readonly recentTradesToTrack: number = 10;
  public readonly volumeImbalanceWeight: number = 0.6;
  public readonly thresholdSolBalance: number;
  public readonly targetSolBalance: number;
  public readonly sweepMode: boolean;
  public readonly poolId: string;
  public readonly timeInterval: number;
  public readonly slippage: number;
  public readonly compute: number;
  public readonly priorityFee: number;
  public readonly sweepThreshold: number;

  constructor() {
    if (!CONFIG.poolId) {
      throw new Error('Pool ID is not set');
    }

    this.targetVolume = CONFIG.targetVolume * BotConfig.LAMPORTS_PER_SOL;
    this.buyAmount = {
      min: CONFIG.buyAmount.min * BotConfig.LAMPORTS_PER_SOL,
      max: CONFIG.buyAmount.max * BotConfig.LAMPORTS_PER_SOL
    };
    this.minTradeAmount = 0.0005 * BotConfig.LAMPORTS_PER_SOL;
    
    this.thresholdSolBalance = Math.max(
      this.buyAmount.min * 0.3,
      0.03 * BotConfig.LAMPORTS_PER_SOL
    );
    
    this.targetSolBalance = Math.max(
      this.buyAmount.max * 1.2,
      0.08 * BotConfig.LAMPORTS_PER_SOL
    );

    this.sweepMode = CONFIG.sweepMode;
    this.poolId = CONFIG.poolId;
    this.timeInterval = CONFIG.timeInterval;
    this.slippage = CONFIG.slippage;
    this.compute = CONFIG.compute;
    this.priorityFee = CONFIG.priorityFee;
    this.sweepThreshold = CONFIG.sweepThreshold;
  }

  public getSellAmount(tokenDecimals: number): { min: number; max: number } {
    const multiplier = Math.pow(10, tokenDecimals);
    return {
      min: CONFIG.sellAmount.min * multiplier,
      max: CONFIG.sellAmount.max * multiplier
    };
  }

  public getSweepThresholdInLamports(): number {
    return this.sweepThreshold * BotConfig.LAMPORTS_PER_SOL;
  }

  public static lamportsToSol(lamports: number): number {
    return lamports / BotConfig.LAMPORTS_PER_SOL;
  }

  public static solToLamports(sol: number): number {
    return sol * BotConfig.LAMPORTS_PER_SOL;
  }
} 