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
  private totalUsages: Map<string, number> = new Map();
  private static readonly MIN_SELECTION_WEIGHT = 0.1;

  constructor() {
    this.loadWallets();
    if (this.wallets.length === 0) {
      throw new Error('No valid wallets found in environment variables');
    }
    
    this.currentIndex = Math.floor(Math.random() * this.wallets.length);
    this.wallets.forEach(wallet => {
      const pubkey = wallet.publicKey.toBase58();
      this.totalUsages.set(pubkey, 0);
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
        this.totalUsages.set(wallet.publicKey.toBase58(), 0);
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
    if (sweepMode) {
      const wallet = this.wallets[this.currentIndex];
      this.currentIndex = (this.currentIndex + 1) % this.wallets.length;
      return wallet;
    }

    // Get min and max usage counts to normalize weights
    let minUsage = Infinity;
    let maxUsage = 0;
    for (const usage of this.totalUsages.values()) {
      minUsage = Math.min(minUsage, usage);
      maxUsage = Math.max(maxUsage, usage);
    }

    // If all wallets have same usage, give them equal weights
    if (minUsage === maxUsage) {
      const randomIndex = Math.floor(Math.random() * this.wallets.length);
      const selectedWallet = this.wallets[randomIndex];
      this.totalUsages.set(selectedWallet.publicKey.toBase58(), 
        (this.totalUsages.get(selectedWallet.publicKey.toBase58()) ?? 0) + 1);
      return selectedWallet;
    }

    // Calculate inverse probability weights
    const usageRange = maxUsage - minUsage;
    const weightedWallets = this.wallets.map(wallet => {
      const usage = this.totalUsages.get(wallet.publicKey.toBase58()) ?? 0;
      // Normalize usage to 0-1 range and invert it
      const normalizedUsage = (usage - minUsage) / usageRange;
      const weight = Math.max(1 - normalizedUsage, WalletManager.MIN_SELECTION_WEIGHT);
      return { wallet, weight };
    });

    // Select wallet using weighted random selection
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

    // Increment usage count for selected wallet
    const selectedPubkey = selectedWallet.publicKey.toBase58();
    this.totalUsages.set(selectedPubkey, (this.totalUsages.get(selectedPubkey) ?? 0) + 1);

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