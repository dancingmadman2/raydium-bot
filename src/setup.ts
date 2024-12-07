import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.config' });


export const CONFIG = {
  poolId: process.env.POOL_ID || 'AQJVhQXcZqXRCv2w6GHjsVFBm52NY2Wa9YmAQTNYdTaU',
  minAmount: Number(process.env.MIN_AMOUNT) || 5000000,
  maxAmount: Number(process.env.MAX_AMOUNT) || 10000000,
  timeInterval: Number(process.env.TIME_INTERVAL) || 15,
  buySellRatio: Number(process.env.BUY_SELL_RATIO) || 0.5,
  slippage: Number(process.env.SLIPPAGE) || 0.1,
  compute: Number(process.env.COMPUTE) || 60000,
  priorityFee: Number(process.env.PRIORITY_FEE) || 11000000,
  connection: process.env.RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com'
} as const;