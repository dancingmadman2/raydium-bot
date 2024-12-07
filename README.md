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
    ```

### Configuration

#### Wallet and RPC Settings (.env)
| Parameter | Description | Value |
|-----------|-------------|---------|
| WALLET_INDEX | Index of the wallet to use from your private keys. You dont need to touch this, look at the usage below. | 0 |
| PRIVATE_KEY_X | Private key in base58 string format | yourSolWalletsPrivateKeyString |
| RPC_ENDPOINT | Your RPC endpoint URL, will default to public endpoint change  it to a dedicated private endpoint | https://api.mainnet-beta.solana.com |

Example `.env`:
```ini
WALLET_INDEX=0
PRIVATE_KEY_0=yourSolWalletsPrivateKeyString
PRIVATE_KEY_1=yourSolWalletsPrivateKeyString
PRIVATE_KEY_2=yourSolWalletsPrivateKeyString
RPC_ENDPOINT=https://summer-omniscient-gadget.solana-mainnet.quiknode.pro/apiKey
```

#### Trading parameters (.env.config)
| Parameter | Description | Value |
|-----------|-------------|---------|
| POOL_ID | Raydium CPMM pool ID for trading | 93tjgwff5Ac5ThyMi8C4WejVVQq4tuMeMuYW1LEYZ7bu |
| MIN_AMOUNT | Minimum trade amount in lamports (1 SOL = 1,000,000,000 lamports) | 5000000 (0.005 SOL) |
| MAX_AMOUNT | Maximum trade amount in lamports | 10000000 (0.01 SOL) |
| TIME_INTERVAL | Time between trades in seconds. Lower intervals require better RPC endpoints | 15 |
| BUY_SELL_RATIO | Probability ratio for buy vs sell (0.6 = 60% buy, 40% sell) | 0.6 |
| SLIPPAGE | Maximum allowed slippage percentage | 0.1 |
| COMPUTE | Compute units limit for transactions | 60000 |
| PRIORITY_FEE | Priority fee in microlamports. Increase if transactions fail | 11000000 |


Example `.env.config`:
```ini
POOL_ID=93tjgwff5Ac5ThyMi8C4WejVVQq4tuMeMuYW1LEYZ7bu
MIN_AMOUNT=5000000  # 0.005 SOL
MAX_AMOUNT=10000000 # 0.01 SOL
TIME_INTERVAL=15 
BUY_SELL_RATIO=0.6 
SLIPPAGE=0.1
COMPUTE=60000
PRIORITY_FEE=11000000
```
  
### Usage

```bash
WALLET_INDEX=0 yarn dev volume_bot.ts
```
```bash
WALLET_INDEX=1 yarn dev volume_bot.ts
```
You can run multiple instances and create volume using multiple wallets.

### Things to know
* Make sure to hold both the BASE and the QUOTE token.
* 1 SOL = 1000000000 lamports.
* Min and Max amount are in lamports.
* Priority fee is in microlamports with default settings it is set to 0.0006 SOL.
* If you get too many failed transactions you could try increasing the priority fee.
* If you want to actively use the bot don't use the public RPC endpoint.


**Now you can have fun creating fake volume for your dead shitcoins in dexscreener.** 
