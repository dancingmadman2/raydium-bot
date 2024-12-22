import { Raydium, TxVersion, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2'
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import bs58 from 'bs58'
import * as dotenv from 'dotenv';
import { CONFIG } from './setup'; 
import { fetchTokenBalance } from './fetchTokenBalance';

dotenv.config();

const WALLET_INDEX = parseInt(process.env.WALLET_INDEX ?? '0');

const wallets: Keypair[] = [];

let walletIndex = 0;
while (process.env[`PRIVATE_KEY_${walletIndex}`]) {
  const privateKey = process.env[`PRIVATE_KEY_${walletIndex}`]!;
  wallets.push(Keypair.fromSecretKey(bs58.decode(privateKey)));
  walletIndex++;
}

const selectedWallet = wallets[WALLET_INDEX] || wallets[0];

console.log(`Selected wallet: ${selectedWallet.publicKey.toBase58()}`);

export const connection = new Connection(CONFIG.connection) 


export const getSolBalance = async() =>{

  return await connection.getBalance(selectedWallet.publicKey)
}

export const getTokenBalance = async() => {
  return await fetchTokenBalance(selectedWallet.publicKey,CONFIG.tokenMint);
}

export const txVersion = TxVersion.V0 // or TxVersion.LEGACY
const cluster = 'mainnet' // 'mainnet' | 'devnet'

let raydium: Raydium | undefined
export const initSdk = async (params?: { loadToken?: boolean}) => {

  if (raydium) return raydium 
  if (connection.rpcEndpoint === clusterApiUrl('mainnet-beta'))
    console.warn('using free rpc node might cause unexpected error, strongly suggest uses paid rpc node')
  console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`)

  console.log(`Initializing Raydium SDK with wallet: ${selectedWallet.publicKey.toBase58()}`);



  raydium = await Raydium.load({
    owner: selectedWallet,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: 'finalized',
    // urlConfigs: {
    //   BASE_HOST: '<API_HOST>', // api url configs, currently api doesn't support devnet
    // },
  })

  /**
   * By default: sdk will automatically fetch token account data when need it or any sol balace changed.
   * if you want to handle token account by yourself, set token account data after init sdk
   * code below shows how to do it.
   * note: after call raydium.account.updateTokenAccount, raydium will not automatically fetch token account
   */

  /*  
  raydium.account.updateTokenAccount(await fetchTokenAccountData())
  connection.onAccountChange(owner.publicKey, async () => {
    raydium!.account.updateTokenAccount(await fetchTokenAccountData())
  })
  */

  return raydium
}

export const fetchTokenAccountData = async () => {
  console.log(`Fetching token account data for wallet: ${selectedWallet.publicKey.toBase58()}`);

  const solAccountResp = await connection.getAccountInfo(selectedWallet.publicKey)
  const tokenAccountResp = await connection.getTokenAccountsByOwner(selectedWallet.publicKey, { programId: TOKEN_PROGRAM_ID })
  const token2022Req = await connection.getTokenAccountsByOwner(selectedWallet.publicKey, { programId: TOKEN_2022_PROGRAM_ID })
  const tokenAccountData = parseTokenAccountResp({
    owner: selectedWallet.publicKey,
    solAccountResp,
    tokenAccountResp: {
      context: tokenAccountResp.context,
      value: [...tokenAccountResp.value, ...token2022Req.value],
    },
  })
  return tokenAccountData
}