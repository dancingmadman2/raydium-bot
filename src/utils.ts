import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js';
import { CONFIG } from './setup';
import { getAssociatedTokenAddress, getMint } from '@solana/spl-token';
import { CREATE_CPMM_POOL_PROGRAM, DEV_CREATE_CPMM_POOL_PROGRAM } from '@raydium-io/raydium-sdk-v2';


export function isValidCpmm(programId: string): boolean {
  const validProgramIds = [
    'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',  // Main CPMM program
    'CPMMGL5yxA8Sf5AjwrqhXUJgvqUAMGgjZihWvGwKgGf4',  // Legacy CPMM program
    CREATE_CPMM_POOL_PROGRAM.toBase58(),              // SDK CPMM program
    DEV_CREATE_CPMM_POOL_PROGRAM.toBase58()          // SDK dev CPMM program
  ];
  return validProgramIds.includes(programId);
}

export async function fetchTokenBalance(connection: Connection, walletAddress: PublicKey | string, tokenMintAddress: string): Promise<number> {
    try {
        // const connection = new Connection(clusterApiUrl('mainnet-beta')) 

        const walletPublicKey = typeof walletAddress === 'string' ? new PublicKey(walletAddress) : walletAddress;
        const tokenMintPublicKey = new PublicKey(tokenMintAddress);

        const tokenAccountAddress = await getAssociatedTokenAddress(
            tokenMintPublicKey,
            walletPublicKey
        );

        const tokenAccountInfo = await connection.getAccountInfo(tokenAccountAddress);

        if (!tokenAccountInfo) {
            console.log(`No token account found for the given mint address.`);
            return 0;
        }

        const tokenAccountData = Buffer.from(tokenAccountInfo.data);
        const tokenBalance = tokenAccountData.readBigUInt64LE(64); 
        
        return Number(tokenBalance);
    } catch (error) {
        console.error('Error getting token balance:', error);
        return 0;
    }
}


export async function getTokenDecimals(connection: Connection, mintAddress: string): Promise<number> {
    console.log('🔍 Fetching token decimals for mint:', mintAddress);
    try {
      const mint = await getMint(connection, new PublicKey(mintAddress));
      console.log('✅ Token decimals fetched:', mint.decimals);     
      return mint.decimals;
    } catch (error) {
      console.error('Failed to fetch token decimals:', error);
      throw error;
    }
  }