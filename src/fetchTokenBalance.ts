import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { CONFIG } from './setup';
import { getAssociatedTokenAddress, getMint } from '@solana/spl-token';

export  async function fetchTokenBalance(walletAddress: any, tokenMintAddress:any): Promise<any>{
try {
        const connection = new Connection(CONFIG.connection) 

        const walletPublicKey = new PublicKey(walletAddress);
        const tokenMintPublicKey = new PublicKey(tokenMintAddress);

    
        const tokenAccountAddress = await getAssociatedTokenAddress(
            tokenMintPublicKey,
            walletPublicKey
        );
        // console.log(`tokenAccountAddress: ${tokenAccountAddress}`)

        const tokenAccountInfo = await connection.getAccountInfo(tokenAccountAddress);

        if (!tokenAccountInfo) {
            console.log(`No token account found for the given mint address.`);
            return;
        }
        const tokenAccountData = Buffer.from(tokenAccountInfo.data);
        const tokenBalance = tokenAccountData.readBigUInt64LE(64); 
        // console.log(`Token Balance: ${tokenBalance}`);
        return tokenBalance;
            
        
    } catch (error) {
        console.error('Error getting token balance:', error);
    }
}

async function getTokenDecimals(tokenMintAddress:any, connection:any) {
    const mintInfo = await getMint(connection, new PublicKey(tokenMintAddress));
    return mintInfo.decimals;
}