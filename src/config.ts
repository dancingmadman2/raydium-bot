import { Raydium, TxVersion, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2'
import { Connection, Keypair, clusterApiUrl, PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import bs58 from 'bs58'
import * as dotenv from 'dotenv';
import { CONFIG } from './setup'; 
import { fetchTokenBalance } from './utils';

dotenv.config();

class RpcManager {
  private endpoints: string[] = [];
  private currentIndex: number = 0;
  private connections: Map<string, Connection> = new Map();
  private lastUsed: Map<string, number> = new Map();
  private static readonly COOLDOWN_MS = 1000; 

  constructor() {
    let endpointIndex = 0;
    while (process.env[`RPC_ENDPOINT_${endpointIndex}`]) {
      this.endpoints.push(process.env[`RPC_ENDPOINT_${endpointIndex}`]!);
      endpointIndex++;
    }

    if (this.endpoints.length === 0) {
      this.endpoints.push(clusterApiUrl('mainnet-beta'));
    }

    
    this.endpoints.forEach(endpoint => {
      this.connections.set(endpoint, new Connection(endpoint));
      this.lastUsed.set(endpoint, 0);
    });
  }

  public getCurrentEndpoint(): string {
    return this.endpoints[this.currentIndex];
  }

  public getCurrentConnection(): Connection {
    const endpoint = this.getCurrentEndpoint();
    return this.connections.get(endpoint)!;
  }

  public rotateEndpoint(): void {
    this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
  }

  public async getOptimalConnection(): Promise<Connection> {
    const now = Date.now();
    let bestEndpoint = this.getCurrentEndpoint();
    let minLastUsed = this.lastUsed.get(bestEndpoint)!;

    for (const [endpoint, lastUsed] of this.lastUsed.entries()) {
      if (lastUsed < minLastUsed) {
        minLastUsed = lastUsed;
        bestEndpoint = endpoint;
      }
    }

    if (now - minLastUsed < RpcManager.COOLDOWN_MS) {
      this.rotateEndpoint();
      bestEndpoint = this.getCurrentEndpoint();
    }

    this.lastUsed.set(bestEndpoint, now);
    return this.connections.get(bestEndpoint)!;
  }
}

export const rpcManager = new RpcManager();

class WalletManager {
  private wallets: Keypair[] = [];
  private currentIndex: number = 0;
  private lastUsed: Map<string, number> = new Map();
  private consecutiveUses: Map<string, number> = new Map();
  private static readonly COOLDOWN_MS = 2000
  private static readonly MAX_CONSECUTIVE_USES = 2;

  constructor() {
    this.loadWallets();
    if (this.wallets.length === 0) {
      throw new Error('No valid wallets found in environment variables');
    }
    
    this.currentIndex = Math.floor(Math.random() * this.wallets.length);
    this.wallets.forEach(wallet => {
      const pubkey = wallet.publicKey.toBase58();
      this.lastUsed.set(pubkey, 0);
      this.consecutiveUses.set(pubkey, 0);
    });
    console.log(`Loaded ${this.wallets.length} wallets for trading`);
  }

  private loadWallets(): void {
    let walletIndex = 0;
    while (process.env[`PRIVATE_KEY_${walletIndex}`]) {
      const privateKey = process.env[`PRIVATE_KEY_${walletIndex}`]!;
      try {
        const keyBytes = this.parsePrivateKey(privateKey);
        const wallet = Keypair.fromSecretKey(keyBytes);
        this.wallets.push(wallet);
        this.lastUsed.set(wallet.publicKey.toBase58(), 0);
        this.consecutiveUses.set(wallet.publicKey.toBase58(), 0);
        console.log(`Loaded wallet ${walletIndex}: ${wallet.publicKey.toBase58()}`);
      } catch (error: any) {
        console.warn(`Failed to load wallet ${walletIndex}: ${error?.message || 'Unknown error'}`);
      }
      walletIndex++;
    }
  }

  private parsePrivateKey(key: string): Uint8Array {
    try {
      const arrayKey = JSON.parse(key);
      if (Array.isArray(arrayKey)) {
        return new Uint8Array(arrayKey);
      }
    } catch {
      return bs58.decode(key);
    }
    return bs58.decode(key);
  }

  public async getOptimalWallet(sweepMode: boolean = false): Promise<Keypair> {
    const now = Date.now();

  
    for (const [pubkey, lastUsedTime] of this.lastUsed.entries()) {
      if (now - lastUsedTime > WalletManager.COOLDOWN_MS * 2) {
        this.consecutiveUses.set(pubkey, 0);
      }
    }

  
    if (sweepMode) {
  
      const wallet = this.wallets[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.wallets.length;
      return wallet;
    }

    const availableWallets = this.wallets.filter(wallet => {
      const pubkey = wallet.publicKey.toBase58();
      const lastUsed = this.lastUsed.get(pubkey) ?? 0;
      const consecutiveUses = this.consecutiveUses.get(pubkey) ?? 0;
      return now - lastUsed >= WalletManager.COOLDOWN_MS && 
             consecutiveUses < WalletManager.MAX_CONSECUTIVE_USES;
    });

    if (availableWallets.length === 0) {
      let bestWallet = this.wallets[0];
      let minLastUsed = this.lastUsed.get(bestWallet.publicKey.toBase58())!;

      for (const wallet of this.wallets) {
        const lastUsed = this.lastUsed.get(wallet.publicKey.toBase58())!;
        if (lastUsed < minLastUsed) {
          minLastUsed = lastUsed;
          bestWallet = wallet;
        }
      }

      this.consecutiveUses.set(bestWallet.publicKey.toBase58(), 1);
      this.lastUsed.set(bestWallet.publicKey.toBase58(), now);
      return bestWallet;
    }

    const weightedWallets = availableWallets.map(wallet => {
      const pubkey = wallet.publicKey.toBase58();
      const timeSinceLastUse = now - (this.lastUsed.get(pubkey) ?? 0);
      const weight = Math.min(timeSinceLastUse / WalletManager.COOLDOWN_MS, 5);
      return { wallet, weight };
    });

    const totalWeight = weightedWallets.reduce((sum, { weight }) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    let selectedWallet = weightedWallets[0].wallet;
    for (const { wallet, weight } of weightedWallets) {
      random -= weight;
      if (random <= 0) {
        selectedWallet = wallet;
        break;
      }
    }

    const selectedPubkey = selectedWallet.publicKey.toBase58();
    this.lastUsed.set(selectedPubkey, now);
    this.consecutiveUses.set(selectedPubkey, (this.consecutiveUses.get(selectedPubkey) ?? 0) + 1);

    for (const wallet of this.wallets) {
      const pubkey = wallet.publicKey.toBase58();
      if (pubkey !== selectedPubkey) {
        this.consecutiveUses.set(pubkey, 0);
      }
    }

    return selectedWallet;
  }

  public getAllWallets(): Keypair[] {
    return this.wallets;
  }

  public async getTotalSolBalance(): Promise<number> {
    const connection = await rpcManager.getOptimalConnection();
    let total = 0;
    for (const wallet of this.wallets) {
      total += await connection.getBalance(wallet.publicKey);
    }
    return total;
  }

  public async getTotalTokenBalance(tokenMint: string): Promise<number> {
    if (!tokenMint) throw new Error('Token mint address is required');
    let total = 0;
    const connection = await rpcManager.getOptimalConnection();
    for (const wallet of this.wallets) {
      total += await fetchTokenBalance(connection, wallet.publicKey, tokenMint);
    }
    return total;
  }
}

export const walletManager = new WalletManager();

export const getSolBalance = async (wallet?: Keypair) => {
  const connection = await rpcManager.getOptimalConnection();
  if (wallet) {
    return await connection.getBalance(wallet.publicKey);
  }
  return await walletManager.getTotalSolBalance();
}

export const getTokenBalance = async (wallet?: Keypair) => {
  const connection = await rpcManager.getOptimalConnection();
  if (!CONFIG.tokenMint) throw new Error('Token mint address is not configured');
  if (wallet) {
    return await fetchTokenBalance(connection, wallet.publicKey, CONFIG.tokenMint);
  }
  return await walletManager.getTotalTokenBalance(CONFIG.tokenMint);
}

export const txVersion = TxVersion.V0
const cluster = 'mainnet'

let raydium: Raydium | undefined
export const initSdk = async (wallet: Keypair, params?: { loadToken?: boolean}) => {
  const connection = await rpcManager.getOptimalConnection();
  
  if (connection.rpcEndpoint === clusterApiUrl('mainnet-beta'))
    console.warn('using free rpc node might cause unexpected error, strongly suggest uses paid rpc node')
  console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`)

  console.log(`Initializing Raydium SDK with wallet: ${wallet.publicKey.toBase58()}`);

  return await Raydium.load({
    owner: wallet,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: 'finalized',
  })
}

export const fetchTokenAccountData = async (wallet: Keypair) => {
  console.log(`Fetching token account data for wallet: ${wallet.publicKey.toBase58()}`);

  const connection = await rpcManager.getOptimalConnection();
  const solAccountResp = await connection.getAccountInfo(wallet.publicKey)
  const tokenAccountResp = await connection.getTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_PROGRAM_ID })
  const token2022Req = await connection.getTokenAccountsByOwner(wallet.publicKey, { programId: TOKEN_2022_PROGRAM_ID })
  const tokenAccountData = parseTokenAccountResp({
    owner: wallet.publicKey,
    solAccountResp,
    tokenAccountResp: {
      context: tokenAccountResp.context,
      value: [...tokenAccountResp.value, ...token2022Req.value],
    },
  })
  return tokenAccountData
}