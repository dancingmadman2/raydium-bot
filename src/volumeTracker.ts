import { CONFIG } from './setup';

export interface VolumeStats {
  buyVolume: number;
  sellVolume: number;
  buyTrades: number;
  sellTrades: number;
}

export interface WalletStats extends VolumeStats {
  solChange: number;
  tokenChange: number;
}

export class VolumeTracker {
  private accumulatedVolume: number;
  private buyVolume: number;
  private sellVolume: number;
  private buyTrades: number;
  private sellTrades: number;
  private walletStats: Map<string, WalletStats> = new Map();
  
  constructor(private targetVolume: number) {
    this.accumulatedVolume = 0;
    this.buyVolume = 0;
    this.sellVolume = 0;
    this.buyTrades = 0;
    this.sellTrades = 0;
  }

  public addVolume(amount: string | number, isBuy: boolean, wallet: string): boolean {
    const volumeAmount = Number(amount);
    this.accumulatedVolume += volumeAmount;
    
    if (isBuy) {
      this.buyVolume += volumeAmount;
      this.buyTrades++;
    } else {
      this.sellVolume += volumeAmount;
      this.sellTrades++;
    }

    if (!this.walletStats.has(wallet)) {
      this.walletStats.set(wallet, {
        buyVolume: 0,
        sellVolume: 0,
        buyTrades: 0,
        sellTrades: 0,
        solChange: 0,
        tokenChange: 0
      });
    }

    const stats = this.walletStats.get(wallet)!;
    if (isBuy) {
      stats.buyVolume += volumeAmount;
      stats.buyTrades++;
    } else {
      stats.sellVolume += volumeAmount;
      stats.sellTrades++;
    }
    
    return this.accumulatedVolume >= this.targetVolume;
  }

  public updateWalletBalanceChanges(wallet: string, solChange: number, tokenChange: number): void {
    if (!this.walletStats.has(wallet)) {
      this.walletStats.set(wallet, {
        buyVolume: 0,
        sellVolume: 0,
        buyTrades: 0,
        sellTrades: 0,
        solChange,
        tokenChange
      });
    } else {
      const stats = this.walletStats.get(wallet)!;
      stats.solChange = solChange;
      stats.tokenChange = tokenChange;
    }
  }

  public getRemainingVolume(): number {
    return Math.max(0, this.targetVolume - this.accumulatedVolume);
  }

  public getAccumulatedVolume(): number {
    return this.accumulatedVolume;
  }

  public getStats(): VolumeStats {
    return {
      buyVolume: this.buyVolume,
      sellVolume: this.sellVolume,
      buyTrades: this.buyTrades,
      sellTrades: this.sellTrades
    };
  }

  public getDetailedStats(): {
    overall: VolumeStats,
    perWallet: Map<string, WalletStats>
  } {
    return {
      overall: this.getStats(),
      perWallet: this.walletStats
    };
  }
} 