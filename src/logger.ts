import { CONFIG } from './setup';
import { VolumeStats, WalletStats } from './volumeTracker';

export class Logger {
  private static readonly LAMPORTS_PER_SOL = 1e9;
  private static tokenDecimals: number | null = null;

  static setTokenDecimals(decimals: number): void {
    Logger.tokenDecimals = decimals;
  }

  private static getTokenMultiplier(): number {
    if (Logger.tokenDecimals === null) {
      throw new Error('Token decimals not set. Call setTokenDecimals first.');
    }
    return Math.pow(10, Logger.tokenDecimals);
  }

  static logTrade(
    action: string, 
    amount: string, 
    wallet: string,
    solBalance: number, 
    tokenBalance: number, 
    priorityFee: number,
    buyProbability?: number
  ): void {
    console.log(`\n🔄 ${action.toUpperCase()} with wallet: ${wallet}`);
    if (amount.includes('TOKEN')) {
      const tokenAmount = amount.replace(' TOKEN', '');
      const humanAmount = (Number(tokenAmount) / this.getTokenMultiplier()).toFixed(2);
      console.log(`Amount: ${humanAmount} TOKEN (${tokenAmount} raw)`);
    } else {
      console.log(`Amount: ${amount}`);
    }
    console.log(`SOL Balance: ${(solBalance / Logger.LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    console.log(`Token Balance: ${(tokenBalance / this.getTokenMultiplier()).toFixed(2)} TOKEN (${tokenBalance} raw)`);
    console.log(`Priority Fee: ${priorityFee} microlamports`);
    if (typeof buyProbability === 'number') {
      console.log(`Buy Probability: ${(buyProbability * 100).toFixed(2)}%`);
    }
    console.log();
  }

  static logVolume(current: number, target: number): void {
    if (CONFIG.sweepMode) return;
    const currentInSol = current / 1e9;
    const targetInSol = target / 1e9;
    const percentage = (current / target) * 100;
    console.log(`📊 Volume Progress: ${currentInSol.toFixed(4)} / ${targetInSol.toFixed(4)} SOL (${percentage.toFixed(2)}%)\n`);
  }

  static logVolumeStats(stats: VolumeStats): void {
    console.log('\n📈 Overall Trading Statistics:');
    console.log(`Total Volume: ${((stats.buyVolume + stats.sellVolume) / 1e9).toFixed(4)} SOL`);
    console.log(`Buy Volume: ${(stats.buyVolume / 1e9).toFixed(4)} SOL (${stats.buyTrades} trades)`);
    console.log(`Sell Volume: ${(stats.sellVolume / 1e9).toFixed(4)} SOL (${stats.sellTrades} trades)`);
    console.log(`Total Trades: ${stats.buyTrades + stats.sellTrades}`);
    const volumeRatio = stats.sellVolume > 0 ? stats.buyVolume / stats.sellVolume : 0;
    console.log(`Buy/Sell Ratio: ${volumeRatio.toFixed(2)}\n`);
  }

  static logBalanceChanges(changes: {
    totalSolChange: number;
    totalTokenChange: number;
    perWalletChanges: Array<{ wallet: string; solChange: number; tokenChange: number; }>;
  }): void {
    console.log('💰 Balance Changes:');
    console.log(`Total SOL Change: ${(changes.totalSolChange / Logger.LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    console.log(`Total Token Change: ${(changes.totalTokenChange / this.getTokenMultiplier()).toFixed(2)} TOKEN (${changes.totalTokenChange} raw)`);
    
    console.log('\nPer Wallet Changes:');
    for (const change of changes.perWalletChanges) {
      console.log(`\nWallet: ${change.wallet}`);
      console.log(`SOL Change: ${(change.solChange / Logger.LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      console.log(`Token Change: ${(change.tokenChange / this.getTokenMultiplier()).toFixed(2)} TOKEN (${change.tokenChange} raw)`);
    }
    console.log();
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

  private static formatSol(lamports: number): string {
    return (lamports / Logger.LAMPORTS_PER_SOL).toFixed(4);
  }

  private static formatToken(amount: number): string {
    return (amount / this.getTokenMultiplier()).toFixed(2);
  }

  private static formatChange(value: number, isToken: boolean = false): string {
    const formatted = isToken ? 
      Logger.formatToken(value) : 
      Logger.formatSol(value);
    return value >= 0 ? `+${formatted}` : formatted;
  }

  static logDetailedStats(
    volumeStats: VolumeStats,
    walletStats: Map<string, WalletStats>
  ): void {
    console.log('\n🎯 Target Volume Achieved! Detailed Statistics:\n');

    this.logVolumeStats(volumeStats);

    console.log('📊 Per-Wallet Performance:\n');
    
    console.log('┌──────────────────────────────────────────────────────────────────────┐');
    console.log('│ Wallet          │ Buy Vol │ Sell Vol │ # Trades │ SOL Chg │ Token Chg│');
    console.log('├──────────────────────────────────────────────────────────────────────┤');

    let totalBuyVol = 0;
    let totalSellVol = 0;
    let totalTrades = 0;
    let totalSolChange = 0;
    let totalTokenChange = 0;

    for (const [wallet, stats] of walletStats.entries()) {
      const shortWallet = `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
      const buyVol = Logger.formatSol(stats.buyVolume);
      const sellVol = Logger.formatSol(stats.sellVolume);
      const trades = stats.buyTrades + stats.sellTrades;
      const solChange = Logger.formatChange(stats.solChange);
      const tokenChange = Logger.formatChange(stats.tokenChange, true);

      totalBuyVol += stats.buyVolume;
      totalSellVol += stats.sellVolume;
      totalTrades += trades;
      totalSolChange += stats.solChange;
      totalTokenChange += stats.tokenChange;

      console.log(
        `│ ${shortWallet.padEnd(14)} │` +
        ` ${buyVol.padStart(7)} │` +
        ` ${sellVol.padStart(6)} │` +
        ` ${trades.toString().padStart(8)} │` +
        ` ${solChange.padStart(6)} │` +
        ` ${tokenChange.padStart(7)} │`
      );
    }

    console.log('├──────────────────────────────────────────────────────────────────────┤');
    
    console.log(
      `│ TOTALS          │` +
      ` ${Logger.formatSol(totalBuyVol).padStart(6)} │` +
      ` ${Logger.formatSol(totalSellVol).padStart(6)} │` +
      ` ${totalTrades.toString().padStart(8)} │` +
      ` ${Logger.formatChange(totalSolChange).padStart(6)} │` +
      ` ${Logger.formatChange(totalTokenChange, true).padStart(8)} │`
    );

    console.log('└──────────────────────────────────────────────────────────────────────┘\n');
  }
} 