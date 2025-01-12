import { Keypair } from '@solana/web3.js';
import { getSolBalance, getTokenBalance } from './config';

export interface BalanceSnapshot {
  sol: number;
  token: number;
}

export class BalanceManager {
  private startBalances: Map<string, BalanceSnapshot> = new Map();

  public async recordInitialBalance(wallet: Keypair): Promise<BalanceSnapshot> {
    const solBalance = await getSolBalance(wallet);
    const tokenBalance = await getTokenBalance(wallet);
    const walletPubkey = wallet.publicKey.toBase58();

    const snapshot = { sol: solBalance, token: tokenBalance };
    this.startBalances.set(walletPubkey, snapshot);
    return snapshot;
  }

  public async getCurrentBalance(wallet: Keypair): Promise<BalanceSnapshot> {
    return {
      sol: await getSolBalance(wallet),
      token: await getTokenBalance(wallet)
    };
  }

  public async getBalanceChanges(wallet: Keypair): Promise<BalanceSnapshot> {
    const walletPubkey = wallet.publicKey.toBase58();
    const startBalance = this.startBalances.get(walletPubkey);
    if (!startBalance) {
      throw new Error('No initial balance recorded for wallet');
    }

    const currentBalance = await this.getCurrentBalance(wallet);
    return {
      sol: currentBalance.sol - startBalance.sol,
      token: currentBalance.token - startBalance.token
    };
  }

  public hasInitialBalance(wallet: Keypair): boolean {
    return this.startBalances.has(wallet.publicKey.toBase58());
  }

  public async getAllBalanceChanges(wallets: Keypair[]): Promise<Map<string, BalanceSnapshot>> {
    const changes = new Map<string, BalanceSnapshot>();
    
    for (const wallet of wallets) {
      const walletPubkey = wallet.publicKey.toBase58();
      if (this.startBalances.has(walletPubkey)) {
        changes.set(walletPubkey, await this.getBalanceChanges(wallet));
      }
    }

    return changes;
  }
} 