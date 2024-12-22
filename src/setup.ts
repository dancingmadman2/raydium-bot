import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.config' });


export const CONFIG = {
  poolId: process.env.POOL_ID || 'AQJVhQXcZqXRCv2w6GHjsVFBm52NY2Wa9YmAQTNYdTaU',
  tokenMint: process.env.TOKEN_MINT,
  targetVolume: Number(process.env.TARGET_VOLUME) || 1,
  baseTradePercentage: Number(process.env.BASE_TRADE_PERCENTAGE) || 0.5,
  timeInterval: Number(process.env.TIME_INTERVAL) || 15,
  slippage: Number(process.env.SLIPPAGE) || 0.1,
  compute: Number(process.env.COMPUTE) || 60000,
  priorityFee: Number(process.env.PRIORITY_FEE) || 11000000,
  connection: process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
  
} as const;