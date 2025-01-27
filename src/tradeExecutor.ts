import { 
  ApiV3PoolInfoStandardItemCpmm, 
  CpmmKeys, 
  CpmmRpcData, 
  CurveCalculator,
  TxVersion
} from '@raydium-io/raydium-sdk-v2';
import { Keypair } from '@solana/web3.js';
import { NATIVE_MINT } from '@solana/spl-token';
import BN from 'bn.js';
import { CONFIG } from './setup';
import { initSdk } from './config';
import { isValidCpmm } from './utils';
import { Logger } from './logger';
import { PriorityFeeManager } from './priorityFeeManager';
import { getSolBalance, getTokenBalance } from './config';

export class TradeExecutor {
  private feeManager: PriorityFeeManager;

  constructor(feeManager: PriorityFeeManager) {
    this.feeManager = feeManager;
  }

  public async executeSwap(
    wallet: Keypair,
    buy: boolean,
    tradeAmount: BN,
    buyProbability: number,
    onVolumeChange?: (volumeChange: number) => void
  ): Promise<boolean> {
    try {
      if (!CONFIG.poolId) {
        throw new Error('Pool ID is not set');
      }

      console.log('\n⏳ Preparing swap...');
      
      const raydium = await initSdk(wallet);
      const poolId = CONFIG.poolId;
      const inputMint = NATIVE_MINT.toBase58();

      let poolInfo: ApiV3PoolInfoStandardItemCpmm;
      let poolKeys: CpmmKeys | undefined;
      let rpcData: CpmmRpcData;

      if (raydium.cluster === 'mainnet') {
        const [data] = await raydium.api.fetchPoolById({ ids: poolId });
        poolInfo = data as ApiV3PoolInfoStandardItemCpmm;
        if (!isValidCpmm(poolInfo.programId)) throw new Error('Invalid CPMM pool');
        rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true);
      } else {
        const data = await raydium.cpmm.getPoolInfoFromRpc(poolId);
        poolInfo = data.poolInfo;
        poolKeys = data.poolKeys;
        rpcData = data.rpcData;
      }

      console.log('\n📝 Building transaction...');

      if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address) {
        throw new Error('Input mint mismatch');
      }

      const preTradeSolBalance = !CONFIG.sweepMode ? await getSolBalance(wallet) : 0;

      Logger.logTrade(
        buy ? 'buying' : 'selling',
        buy ? `${(tradeAmount.toNumber() / 1e9).toFixed(4)} SOL` : `${tradeAmount.toNumber()} TOKEN`,
        wallet.publicKey.toBase58(),
        await getSolBalance(wallet),
        await getTokenBalance(wallet),
        this.feeManager.getCurrentFee(),
        buyProbability
      );

      const baseIn = buy;
      const swapResult = CurveCalculator.swap(
        tradeAmount,
        baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
        baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
        rpcData.configInfo!.tradeFeeRate
      );

      const { execute } = await raydium.cpmm.swap({
        poolInfo,
        poolKeys,
        inputAmount: tradeAmount,
        swapResult,
        slippage: CONFIG.slippage,
        baseIn,
        computeBudgetConfig: {
          units: CONFIG.compute,
          microLamports: this.feeManager.getCurrentFee(),
        },
        txVersion: TxVersion.V0,
      });

      console.log('🔄 Processing transaction...');
      const { txId } = await execute({ sendAndConfirm: true });

      if (!CONFIG.sweepMode && onVolumeChange) {
        setTimeout(async () => {
          try {
            const postTradeSolBalance = await getSolBalance(wallet);
            const volumeChange = Math.abs(postTradeSolBalance - preTradeSolBalance);
            if (volumeChange > 0) {
              onVolumeChange(volumeChange);
            }
          } catch (error) {
            Logger.logError('Balance check failed', error);
          }
        }, 15000);
      }

      this.feeManager.onSuccess();
      Logger.logTransaction(txId);

      return true;
    } catch (error) {
      this.feeManager.onError();
      Logger.logError('Swap failed', error);
      return false;
    }
  }
} 