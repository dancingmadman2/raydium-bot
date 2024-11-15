# Raydium Trading Bot

A very simple configurable trading bot for executing trades on the Raydium DEX, built with the Raydium SDK.
https://github.com/raydium-io/raydium-sdk-V2-demo


### Prerequisites

- [Node.js](https://nodejs.org/) (version 16 or higher)
- [Yarn](https://yarnpkg.com/)
- A Solana wallet with private keys
- Access to a Solana RPC provider

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/dancingmadman2/raydium-trading-bot.git
   cd raydium-trading-bot

2. Install dependencies

    ```bash
    yarn install

3. Setup your environment
    ```
    WALLET_INDEX=0 (default)
    PRIVATE_KEY_0=yourSolWalletsPrivateKeyString
    PRIVATE_KEY_1=yourSolWalletsPrivateKeyString
    PRIVATE_KEY_2=yourSolWalletsPrivateKeyString

4. Configure setup.ts
    ```typescript
    export const CONFIG = {
    poolId: '4AZRPNEfCJ7iw28rJu5aUyeQhYcvdcNm8cswyL51AY9i', // (default: SOL/Pnut) change to any CPMM pool you want
    minAmount: 1000000, // Minimum amount for a trade (default: 0.0.001 SOL)
    maxAmount: 5000000, // Maximum amount for a trade (default: 0.005 SOL)
    timeInterval: 90, // Time interval between trades in seconds (default: 90 seconds) To lower time interval i suggest using third party RPC endpoints
    buySellRatio: 0.5, // Ratio for deciding buy/sell (e.g., 0.7 for 70% more likely to buy than sell)
    slippage: 0.1, // (default: 0.1%)
    compute: 60000, // (default: 6000)
    priorityFee: 10000000, // Increase, if transactions fail even though simulations succeed (default: 10000000 microlamports)
    connection: 'https://api.mainnet-beta.solana.com' // (default: cluster('mainnet-beta') RPC endpoint, i suggest using third party endpoints for more consistent transactions (e.g., quicknode, alchemy etc...)
    };
  
### Usage

```bash
WALLET_INDEX=0 yarn dev volume_bot.ts
```
```bash
WALLET_INDEX=1 yarn dev volume_bot.ts
```
You can run multiple instances and create volume using multiple wallets.

