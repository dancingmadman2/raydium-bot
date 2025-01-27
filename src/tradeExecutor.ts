import { 
  ApiV3PoolInfoStandardItemCpmm,
  ApiV3PoolInfoStandardItem,
  CpmmKeys, 
  CpmmRpcData,
  AmmV4Keys,
  AmmV5Keys,
  AmmRpcData,
  CurveCalculator,
  TxVersion,
  ApiV3PoolInfoItem
} from '@raydium-io/raydium-sdk-v2';
import { Keypair } from '@solana/web3.js';
import { NATIVE_MINT } from '@solana/spl-token';
import BN from 'bn.js';
import { CONFIG } from './setup';
import { initSdk } from './config';
import { isValidCpmm, isValidAmm } from './utils';
import { Logger } from './logger';
import { PriorityFeeManager } from './priorityFeeManager';
import { getSolBalance, getTokenBalance } from './config';

export class TradeExecutor {
  private feeManager: PriorityFeeManager;

  constructor(feeManager: PriorityFeeManager) {
    this.feeManager = feeManager;
  }

  private computeMinimumAmountOut(amount: BN, slippage: number): BN {
    const minAmountBN = amount.muln(Math.floor((1 - slippage) * 10000)).divn(10000);
    return minAmountBN;
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

      let poolInfo: ApiV3PoolInfoStandardItemCpmm | ApiV3PoolInfoStandardItem;
      let poolKeys: CpmmKeys | AmmV4Keys | AmmV5Keys | undefined;
      let rpcData: CpmmRpcData | AmmRpcData;
      let isCpmm = false;

      if (raydium.cluster === 'mainnet') {
        const [data] = await raydium.api.fetchPoolById({ ids: poolId });
        
        if (isValidCpmm(data.programId)) {
          isCpmm = true;
          poolInfo = data as ApiV3PoolInfoStandardItemCpmm;
          rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true);
        } else if (isValidAmm(data.programId)) {
          poolInfo = data as ApiV3PoolInfoStandardItem;
          poolKeys = await raydium.liquidity.getAmmPoolKeys(poolId);
          rpcData = await raydium.liquidity.getRpcPoolInfo(poolId);
        } else {
          throw new Error('Invalid pool type - must be either CPMM or AMM');
        }
      } else {
        try {
          const cpmmData = await raydium.cpmm.getPoolInfoFromRpc(poolId);
          poolInfo = cpmmData.poolInfo;
          poolKeys = cpmmData.poolKeys;
          rpcData = cpmmData.rpcData;
          isCpmm = true;
        } catch {
          const ammData = await raydium.liquidity.getPoolInfoFromRpc({ poolId });
          poolInfo = ammData.poolInfo;
          poolKeys = ammData.poolKeys;
          rpcData = ammData.poolRpcData;
        }
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
      let execute;
      
      if (isCpmm) {
        const cpmmRpcData = rpcData as CpmmRpcData;
        const swapResult = CurveCalculator.swap(
          tradeAmount,
          baseIn ? cpmmRpcData.baseReserve : cpmmRpcData.quoteReserve,
          baseIn ? cpmmRpcData.quoteReserve : cpmmRpcData.baseReserve,
          cpmmRpcData.configInfo!.tradeFeeRate
        );

        ({ execute } = await raydium.cpmm.swap({
          poolInfo: poolInfo as ApiV3PoolInfoStandardItemCpmm,
          poolKeys: poolKeys as CpmmKeys,
          inputAmount: tradeAmount,
          swapResult,
          slippage: CONFIG.slippage,
          baseIn,
          computeBudgetConfig: {
            units: CONFIG.compute,
            microLamports: this.feeManager.getCurrentFee(),
          },
          txVersion: TxVersion.V0,
        }));
      } else {
        const ammRpcData = rpcData as AmmRpcData;
        const out = raydium.liquidity.computeAmountOut({
          poolInfo: {
            ...poolInfo as ApiV3PoolInfoStandardItem,
            baseReserve: ammRpcData.baseReserve,
            quoteReserve: ammRpcData.quoteReserve,
            status: ammRpcData.status.toNumber(),
            version: 4,
          },
          amountIn: tradeAmount,
          mintIn: inputMint,
          mintOut: baseIn ? poolInfo.mintB.address : poolInfo.mintA.address,
          slippage: CONFIG.slippage,
        });
        
        ({ execute } = await raydium.liquidity.swap({
          poolInfo: poolInfo as ApiV3PoolInfoStandardItem,
          poolKeys: poolKeys as AmmV4Keys,
          amountIn: tradeAmount,
          amountOut: out.minAmountOut,
          fixedSide: 'in',
          inputMint: inputMint,
          computeBudgetConfig: {
            units: CONFIG.compute,
            microLamports: this.feeManager.getCurrentFee(),
          },
          txVersion: TxVersion.V0,
        }));
      }

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