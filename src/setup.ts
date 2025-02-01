import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.config' });

function parseRange(value: string | undefined, defaultMin: number, defaultMax: number): [number, number] {
  if (!value) return [defaultMin, defaultMax];
  
  const parts = value.split(',').map(p => Number(p.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]];
  }
  
  const singleValue = Number(value);
  return isNaN(singleValue) ? [defaultMin, defaultMax] : [singleValue, singleValue];
}

const [buyMin, buyMax] = parseRange(process.env.BUY_AMOUNT, 0.1, 0.1);
const [sellMinHuman, sellMaxHuman] = parseRange(process.env.SELL_AMOUNT, 1000, 1000);

export const CONFIG = {
  poolId: process.env.POOL_ID ,
  tokenMint: process.env.TOKEN_MINT,
  targetVolume: Number(process.env.TARGET_VOLUME) || 1,
  buyAmount: { min: buyMin, max: buyMax },
  sellAmount: { min: sellMinHuman, max: sellMaxHuman },
  solLimit: Number(process.env.SOL_LIMIT) || 1,
  timeInterval: Number(process.env.TIME_INTERVAL) || 15,
  slippage: Number(process.env.SLIPPAGE) || 0.01,
  compute: Number(process.env.COMPUTE) || 120000,
  priorityFee: Number(process.env.PRIORITY_FEE) || 100000,
  sweepMode: process.env.SWEEP_MODE === 'true',
  sweepThreshold: Number(process.env.SWEEP_THRESHOLD) || 0.1,
};