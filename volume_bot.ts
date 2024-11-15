import { ApiV3PoolInfoStandardItemCpmm, CpmmKeys, CpmmRpcData, CurveCalculator } from '@raydium-io/raydium-sdk-v2';
import { initSdk } from './src/config';
import BN from 'bn.js';
import { isValidCpmm } from './src/utils';
import { NATIVE_MINT } from '@solana/spl-token';
import { CONFIG } from './src/setup'; 

const lamportsMultiplier = 10000000;

const getRandomAmount = (min: number, max: number, buy: boolean): BN => {
  const randomAmount = Math.floor(Math.random() * (max - min + 1) + min);
  const amount = buy ? randomAmount : randomAmount * lamportsMultiplier;
  return new BN(amount); // Convert to BN
};

const swap = async (buy: boolean): Promise<void> => {
  const raydium = await initSdk();

  const poolId = CONFIG.poolId; 
  const inputMint = NATIVE_MINT.toBase58();
  const minAmount = CONFIG.minAmount; 
  const maxAmount = CONFIG.maxAmount;
  const inputAmount = getRandomAmount(minAmount, maxAmount, buy);

  console.log(`Input amount for ${buy ? 'buying' : 'selling'}: ${inputAmount.toString()}`);

  let poolInfo: ApiV3PoolInfoStandardItemCpmm;
  let poolKeys: CpmmKeys | undefined;
  let rpcData: CpmmRpcData;

  if (raydium.cluster === 'mainnet') {
    const data = await raydium.api.fetchPoolById({ ids: poolId });
    poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm;
    if (!isValidCpmm(poolInfo.programId)) throw new Error('Target pool is not a CPMM pool');
    rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true);
  } else {
    const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
    poolInfo = data.poolInfo;
    poolKeys = data.poolKeys;
    rpcData = data.rpcData;
  }

  if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address) {
    throw new Error('Input mint does not match pool');
  }

  const baseIn = buy; 

  const swapResult = CurveCalculator.swap(
    inputAmount,
    baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
    baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
    rpcData.configInfo!.tradeFeeRate
  );

  const { execute } = await raydium.cpmm.swap({
    poolInfo,
    poolKeys,
    inputAmount,
    swapResult,
    slippage: CONFIG.slippage,
    baseIn,
    computeBudgetConfig: {
      units: CONFIG.compute,
      microLamports: CONFIG.priorityFee,
    },
  });

  const { txId } = await execute({ sendAndConfirm: true });
  console.log(`Transaction completed:`, {
    txId: `https://explorer.solana.com/tx/${txId}`,
  });
};

const startTradingBot = (): void => {
  setInterval(async () => {
    const buy = Math.random() < CONFIG.buySellRatio; 
    try {
      await swap(buy);
    } catch (error) {
      console.error('Error during swap:', error);
    }
  }, CONFIG.timeInterval*1000); 
};

startTradingBot();
