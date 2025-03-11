import { 
  ApiV3PoolInfoStandardItemCpmm
} from '@raydium-io/raydium-sdk-v2';
import { initSdk, walletManager } from './src/config';
import BN from 'bn.js';
import { getTokenDecimals } from './src/utils';
import { NATIVE_MINT } from '@solana/spl-token';
import { VolumeTracker } from './src/volumeTracker';
import { PriorityFeeManager } from './src/priorityFeeManager';
import { Logger } from './src/logger';
import { TradeExecutor } from './src/tradeExecutor';
import { BotConfig } from './src/botConfig';
import { BalanceManager } from './src/balanceManager';
import './src/healthcheck';

class TradingBot {
  private volumeTracker: VolumeTracker | null;
  private feeManager: PriorityFeeManager;
  private tradeExecutor: TradeExecutor;
  private balanceManager: BalanceManager;
  private config: BotConfig;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private executingTrade = false;
  private sweptWallets: Set<string> = new Set();
  private totalWallets: number = 0;
  private recentTrades: Array<{ isBuy: boolean; volume: number }> = [];
  private tokenDecimals: number | null = null;

  constructor() {
    this.config = new BotConfig();
    this.volumeTracker = this.config.sweepMode ? null : new VolumeTracker(this.config.targetVolume);
    this.feeManager = new PriorityFeeManager(this.config.priorityFee);
    this.tradeExecutor = new TradeExecutor(this.feeManager);
    this.balanceManager = new BalanceManager();
  }

  private async initialize(): Promise<void> {
    try {
      const raydium = await initSdk(walletManager.getAllWallets()[0]);
      const [poolData] = await raydium.api.fetchPoolById({ ids: this.config.poolId });
      const poolInfo = poolData as ApiV3PoolInfoStandardItemCpmm;
      const tokenMint = poolInfo.mintA.address === NATIVE_MINT.toBase58() ? poolInfo.mintB.address : poolInfo.mintA.address;
      this.tokenDecimals = await getTokenDecimals(raydium.connection, tokenMint);
      Logger.setTokenDecimals(this.tokenDecimals);

      if (this.config.sweepMode) {
        this.totalWallets = walletManager.getAllWallets().length;
        console.log('\n🧹 Running in Sweep Mode');
        console.log(`Will sweep all SOL above ${this.config.sweepThreshold} SOL from ${this.totalWallets} wallets`);
        console.log('Bot will terminate after sweeping all wallets\n');
      }
    } catch (error) {
      Logger.logError('Failed to initialize bot', error);
      throw error;
    }
  }

  private addRecentTrade(isBuy: boolean, volume: number): void {
    this.recentTrades.push({ isBuy, volume });
    if (this.recentTrades.length > this.config.recentTradesToTrack) {
      this.recentTrades.shift();
    }
  }

  private getVolumeImbalanceAdjustment(): number {
    if (this.recentTrades.length === 0) return 0;

    let buyVolume = 0;
    let sellVolume = 0;

    for (const trade of this.recentTrades) {
      if (trade.isBuy) {
        buyVolume += trade.volume;
      } else {
        sellVolume += trade.volume;
      }
    }

    const totalVolume = buyVolume + sellVolume;
    if (totalVolume === 0) return 0;

    const imbalance = (sellVolume - buyVolume) / totalVolume;
    return imbalance * this.config.volumeImbalanceWeight;
  }

  private getRandomAmount(min: number, max: number): number {
    return Math.floor(min + (Math.random() * (max - min)));
  }

  private getRandomizedAmount(baseAmount: number): number {
    const minAmount = baseAmount * (1 - this.config.amountVariance);
    const maxAmount = baseAmount * (1 + this.config.amountVariance);
    return this.getRandomAmount(minAmount, maxAmount);
  }

  private calculateTradeAmount(currentBalance: number, tokenBalance: number, buy: boolean): BN {
    if (this.config.sweepMode) {
      if (!buy) return new BN(0);
      const availableBalance = Math.max(0, currentBalance - this.config.getSweepThresholdInLamports());
      return new BN(availableBalance.toString());
    }

    const remainingVolume = this.volumeTracker?.getRemainingVolume() ?? 0;
    if (remainingVolume <= 0) {
      return new BN(0);
    }

    let tradeAmount: number;
    if (buy) {
      const availableBalance = Math.max(0, currentBalance - this.config.getSweepThresholdInLamports());
      
      if (availableBalance < this.config.minTradeAmount) {
        return new BN(0);
      }

      if (this.config.sweepMode) {
        tradeAmount = Math.min(availableBalance, remainingVolume);
      } else {
        const randomAmount = this.getRandomAmount(
          Math.min(this.config.buyAmount.min, availableBalance),
          Math.min(this.config.buyAmount.max, availableBalance)
        );
        
        tradeAmount = Math.min(randomAmount, remainingVolume);
        tradeAmount = Math.max(
          Math.min(this.getRandomizedAmount(tradeAmount), availableBalance),
          this.config.minTradeAmount
        );
      }
    } else {
      if (this.config.sweepMode) {
        return new BN(0);
      }
      if (tokenBalance <= 0) {
        return new BN(0);
      }

      if (!this.tokenDecimals) {
        throw new Error('Token decimals not initialized');
      }
      
      const sellAmount = this.config.getSellAmount(this.tokenDecimals);
      const randomAmount = this.getRandomAmount(
        Math.min(sellAmount.min, tokenBalance),
        Math.min(sellAmount.max, tokenBalance)
      );
      
      tradeAmount = Math.min(this.getRandomizedAmount(randomAmount), tokenBalance);
    }

    return new BN(tradeAmount.toString());
  }

  private calculateBuyProbability(solBalance: number, wallet: string): number {
    if (this.config.sweepMode) {
      return solBalance > this.config.getSweepThresholdInLamports() ? 1 : 0;
    }

    if (solBalance < this.config.thresholdSolBalance) {
      return 0;
    }

    if (solBalance >= this.config.targetSolBalance) {
      return 1;
    }

    const range = this.config.targetSolBalance - this.config.thresholdSolBalance;
    const position = solBalance - this.config.thresholdSolBalance;
    const baseProbability = position / range;

    const volumeAdjustment = this.getVolumeImbalanceAdjustment();
    return Math.min(Math.max(baseProbability + volumeAdjustment, 0), 1);
  }

  private async executeTradingCycle(): Promise<void> {
    if (this.executingTrade || !this.isRunning) return;
    
    try {
      this.executingTrade = true;
      const wallet = await walletManager.getOptimalWallet(this.config.sweepMode);
      const currentBalance = await this.balanceManager.getCurrentBalance(wallet);
      const walletPubkey = wallet.publicKey.toBase58();

      if (!this.balanceManager.hasInitialBalance(wallet)) {
        await this.balanceManager.recordInitialBalance(wallet);
      }

      const buyProbability = this.calculateBuyProbability(currentBalance.sol, walletPubkey);

      if (this.config.sweepMode && this.sweptWallets.has(walletPubkey)) {
        this.executingTrade = false;
        return;
      }

      const buy = Math.random() < buyProbability;
      const tradeAmount = this.calculateTradeAmount(currentBalance.sol, currentBalance.token, buy);
      if (tradeAmount.eqn(0)) {
        if (this.config.sweepMode && !this.sweptWallets.has(walletPubkey)) {
          if (currentBalance.sol <= this.config.getSweepThresholdInLamports()) {
            this.sweptWallets.add(walletPubkey);
            const remaining = this.totalWallets - this.sweptWallets.size;
            console.log(`\n✨ Wallet ${walletPubkey} swept. ${remaining} wallets remaining.`);
            
            if (this.sweptWallets.size === this.totalWallets) {
              console.log('\n🎉 All wallets have been swept!');
              this.stop();
              process.exit(0);
            }
          }
        }
        this.executingTrade = false;
        return;
      }

      const success = await this.tradeExecutor.executeSwap(
        wallet, 
        buy, 
        tradeAmount, 
        buyProbability,
        (volumeChange: number) => {
          this.addRecentTrade(buy, volumeChange);
          if (!this.config.sweepMode) {
            const targetReached = this.volumeTracker?.addVolume(volumeChange, buy, walletPubkey) ?? false;
            Logger.logVolume(this.volumeTracker?.getAccumulatedVolume() ?? 0, this.config.targetVolume);
            
            if (targetReached) {
              this.displayFinalStats().then(() => {
                this.stop();
                process.exit(0);
              });
            }
          }
        }
      );
      
      if (this.config.sweepMode && !success) {
        console.log(`\n🔄 Will retry sweeping wallet ${walletPubkey} on next cycle...`);
      }
      
    } catch (error) {
      Logger.logError('Trading cycle failed', error);
    } finally {
      this.executingTrade = false;
    }
  }

  private async updateFinalStats(): Promise<void> {
    const changes = await this.balanceManager.getAllBalanceChanges(walletManager.getAllWallets());
    changes.forEach((change, pubkey) => {
      this.volumeTracker?.updateWalletBalanceChanges(pubkey, change.sol, change.token);
    });
  }

  private async displayFinalStats(): Promise<void> {
    await this.updateFinalStats();
    const { overall, perWallet } = this.volumeTracker?.getDetailedStats() ?? { 
      overall: { buyVolume: 0, sellVolume: 0, buyTrades: 0, sellTrades: 0 }, 
      perWallet: new Map() 
    };
    Logger.logDetailedStats(overall, perWallet);
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    
    await this.initialize();
    this.isRunning = true;
    await this.executeTradingCycle();
    this.intervalId = setInterval(
      () => this.executeTradingCycle(), 
      this.config.timeInterval * 1000
    );
  }

  public stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

const bot = new TradingBot();
bot.start().catch(error => {
  Logger.logError('Fatal error', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  bot.stop();
  console.log('\nBot stopped gracefully');
  process.exit(0);
}); 