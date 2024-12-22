import { 
  ApiV3PoolInfoStandardItemCpmm, 
  CpmmKeys, 
  CpmmRpcData, 
  CurveCalculator 
} from '@raydium-io/raydium-sdk-v2';
import { getSolBalance, getTokenBalance, initSdk } from './src/config';
import BN from 'bn.js';
import { isValidCpmm } from './src/utils';
import { NATIVE_MINT } from '@solana/spl-token';
import { CONFIG } from './src/setup';

class TradingBot {
  private static readonly LAMPORTS_PER_SOL = 1e9;
  private static readonly TARGET_VOLUME = CONFIG.targetVolume* TradingBot.LAMPORTS_PER_SOL;
  private static readonly BASE_TRADE_PERCENTAGE = CONFIG.baseTradePercentage; 
  private static readonly TRADE_PERCENTAGE_VARIANCE = 0.1
  private static readonly MIN_TRADE_AMOUNT = 0.0005 * TradingBot.LAMPORTS_PER_SOL; 
  private static readonly THRESHOLD_SOL_BALANCE = 0.02 * TradingBot.LAMPORTS_PER_SOL; 

  private volumeTracker: VolumeTracker;
  private feeManager: PriorityFeeManager;
  private startBalance: number | null = null;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private executingTrade = false; 

  constructor() {
    this.volumeTracker = new VolumeTracker(TradingBot.TARGET_VOLUME);
    this.feeManager = new PriorityFeeManager(CONFIG.priorityFee);
  }

  private getRandomTradePercentage(): number {
    const minPercentage = TradingBot.BASE_TRADE_PERCENTAGE - TradingBot.TRADE_PERCENTAGE_VARIANCE;
    const maxPercentage = TradingBot.BASE_TRADE_PERCENTAGE + TradingBot.TRADE_PERCENTAGE_VARIANCE;
    return minPercentage + (Math.random() * (maxPercentage - minPercentage));
  }

  private calculateTradeAmount(currentBalance: number, tokenBalance: number, buy: boolean): BN {
    const remainingVolume = this.volumeTracker.getRemainingVolume();
    if (remainingVolume <= 0) {
      return new BN(0);
    }

    const balanceToUse = buy ? currentBalance : Number(tokenBalance);
    const tradePercentage = this.getRandomTradePercentage();
    let tradeAmount = Math.floor(balanceToUse * tradePercentage);

    const variance = 0.05;
    const randomFactor = 1 - variance + (Math.random() * (2 * variance));
    tradeAmount = Math.floor(tradeAmount * randomFactor);

    if (buy) {
      tradeAmount = Math.max(tradeAmount, TradingBot.MIN_TRADE_AMOUNT);
    }

    return new BN(tradeAmount.toString());
  }

  private async executeSwap(buy: boolean, tradeAmount: BN): Promise<boolean> {
    try {
      const raydium = await initSdk();
      const poolId = CONFIG.poolId;
      const inputMint = NATIVE_MINT.toBase58();

      let poolInfo: ApiV3PoolInfoStandardItemCpmm;
      let poolKeys: CpmmKeys | undefined;
      let rpcData: CpmmRpcData;

      if (raydium.cluster === 'mainnet') {
        const [data] = await raydium.api.fetchPoolById({ ids: poolId });
        poolInfo = data as ApiV3PoolInfoStandardItemCpmm;
        if (!isValidCpmm(poolInfo.programId)) throw new Error('Invalid CPMM pool');
        rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true);
      } else {
        const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
        poolInfo = data.poolInfo;
        poolKeys = data.poolKeys;
        rpcData = data.rpcData;
      }

      if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address) {
        throw new Error('Input mint mismatch');
      }

      const baseIn = buy;
      const swapResult = CurveCalculator.swap(
        tradeAmount,
        baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
        baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
        rpcData.configInfo!.tradeFeeRate
      );

      const { execute } = await raydium.cpmm.swap({
        poolInfo,
        poolKeys,
        inputAmount: tradeAmount,
        swapResult,
        slippage: CONFIG.slippage,
        baseIn,
        computeBudgetConfig: {
          units: CONFIG.compute,
          microLamports: this.feeManager.getCurrentFee(),
        },
      });

      const solBalance = await getSolBalance();
      const tokenBalance = await getTokenBalance();
      
      const formattedAmount = buy ? 
        `${(tradeAmount.toNumber() / 1e9).toFixed(4)} SOL` :
        `${tradeAmount.toNumber()} TOKEN`;

      Logger.logTrade(
        buy ? 'buying' : 'selling',
        formattedAmount,
        solBalance,
        tokenBalance,
        this.feeManager.getCurrentFee()
      );

      const preTradeSolBalance = await getSolBalance();
      const { txId } = await execute({ sendAndConfirm: true });
      
      // check balance after 15 seconds to confirm tx
      setTimeout(async () => {
        try {
          const postTradeSolBalance = await getSolBalance();
          const volumeChange = Math.abs(postTradeSolBalance - preTradeSolBalance);
          if (volumeChange > 0) {
            const targetReached = this.volumeTracker.addVolume(volumeChange);
            Logger.logVolume(this.volumeTracker.getAccumulatedVolume(), TradingBot.TARGET_VOLUME);
            
            if (targetReached) {
              Logger.logSuccess(`Target volume of ${(TradingBot.TARGET_VOLUME / 1e9).toFixed(4)} SOL has been achieved! 🎯`);
              this.stop();
              process.exit(0);
            }
          }
        } catch (error) {
          Logger.logError('Balance check failed', error);
        }
      }, 15000);

      this.feeManager.onSuccess();
      
      Logger.logTransaction(txId);
      Logger.logVolume(this.volumeTracker.getAccumulatedVolume(), TradingBot.TARGET_VOLUME);

      return true;
    } catch (error) {
      this.feeManager.onError();
      Logger.logError('Swap failed', error);
      return false;
    }
  }

  private async executeTradingCycle(): Promise<void> {
    // prevent concurrent executions
    if (this.executingTrade || !this.isRunning) return;
    
    try {
      this.executingTrade = true;
      const solBalance = await getSolBalance();
      const tokenBalance = await getTokenBalance();

      if (!this.startBalance) {
        this.startBalance = solBalance;
      }

      const buy = solBalance >= TradingBot.THRESHOLD_SOL_BALANCE && 
                  solBalance >= this.startBalance * 0.95;
      
      const tradeAmount = this.calculateTradeAmount(solBalance, tokenBalance, buy);
      if (tradeAmount.eqn(0)) return;

      await this.executeSwap(buy, tradeAmount);
      
    } catch (error) {
      Logger.logError('Trading cycle failed', error);
    } finally {
      this.executingTrade = false;
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    await this.executeTradingCycle();
    this.intervalId = setInterval(
      () => this.executeTradingCycle(), 
      CONFIG.timeInterval * 1000
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

class VolumeTracker {
  private accumulatedVolume: number;
  
  constructor(private targetVolume: number) {
    this.accumulatedVolume = 0;
  }

  public addVolume(amount: string | number): boolean {
    this.accumulatedVolume += Number(amount);
    return this.accumulatedVolume >= this.targetVolume;
  }

  public getRemainingVolume(): number {
    return Math.max(0, this.targetVolume - this.accumulatedVolume);
  }

  public getAccumulatedVolume(): number {
    return this.accumulatedVolume;
  }

  public hasReachedTarget(): boolean {
    return this.accumulatedVolume >= this.targetVolume;
  }
}

class PriorityFeeManager {
  private static readonly FEE_INCREASE = 25000;
  private static readonly MAX_FEE = 100000;
  private static readonly MIN_FEE = 10000;
  
  private currentFee: number;
  private consecutiveFailures: number = 0;

  constructor(initialFee: number) {
    this.currentFee = Math.max(PriorityFeeManager.MIN_FEE, initialFee);
  }

  public getCurrentFee(): number {
    return this.currentFee;
  }

  public onError(): void {
    this.consecutiveFailures++;
    this.currentFee = Math.min(
      this.currentFee + PriorityFeeManager.FEE_INCREASE * this.consecutiveFailures,
      PriorityFeeManager.MAX_FEE
    );
  }

  public onSuccess(): void {
    if (this.consecutiveFailures > 0) {
      this.consecutiveFailures = 0;
      this.currentFee = Math.max(
        this.currentFee - PriorityFeeManager.FEE_INCREASE,
        PriorityFeeManager.MIN_FEE
      );
    }
  }
}

class Logger {
  static logTrade(action: string, amount: string, solBalance: number, tokenBalance: number, priorityFee: number): void {
    console.log(`\n🔄 ${action.toUpperCase()}`);
    console.log(`Amount: ${amount}`);
    console.log(`SOL Balance: ${(solBalance / 1e9).toFixed(4)} SOL`);
    console.log(`Token Balance: ${tokenBalance}`);
    console.log(`Priority Fee: ${priorityFee} microlamports\n`);
  }

  static logVolume(current: number, target: number): void {
    const currentInSol = current / 1e9;
    const targetInSol = target / 1e9;
    const percentage = (current / target) * 100;
    console.log(`📊 Volume Progress: ${currentInSol.toFixed(4)} / ${targetInSol.toFixed(4)} SOL (${percentage.toFixed(2)}%)\n`);
  }

  static logTransaction(txId: string): void {
    console.log(`✅ Transaction completed: https://explorer.solana.com/tx/${txId}\n`);
  }

  static logWarning(message: string): void {
    console.warn(`⚠️  ${message}\n`);
  }

  static logError(message: string, error: unknown): void {
    console.error(`❌ ${message}:`, error instanceof Error ? error.message : 'Unknown error\n');
  }

  static logSuccess(message: string): void {
    console.log(`\n🤡 ${message}`);
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