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
| TOKEN_MINT | Mint address of the quote token | Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump |
| TARGET_VOLUME | The volume you want to achieve in SOL.  | 0.1 |
| BASE_TRADE_PERCENTAGE | Percentage of the account to use in one trade| 0.5 |
| TIME_INTERVAL | Time between trades in seconds. Lower intervals require better RPC endpoints | 15 |
| SLIPPAGE | Maximum allowed slippage percentage | 0.1 |
| COMPUTE | Compute units limit for transactions | 120000 |
| PRIORITY_FEE | Priority fee in microlamports. Increase if transactions keep failing | 100000 |


Example `.env.config`:
```ini
POOL_ID=93tjgwff5Ac5ThyMi8C4WejVVQq4tuMeMuYW1LEYZ7bu
TOKEN_MINT=Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump # mint address of the quote token
TARGET_VOLUME=0.1 # in sol 
BASE_TRADE_PERCENTAGE=0.5 # percentage of account to use in one trade
TIME_INTERVAL=15 
SLIPPAGE=0.01
COMPUTE=120000
PRIORITY_FEE=100000
```
  
### Usage

```bash
WALLET_INDEX=0 yarn dev volume_bot.ts
```
```bash
WALLET_INDEX=1 yarn dev volume_bot.ts
```
You can run multiple instances and create volume using multiple wallets.

### Example Output
```bash
🔄 BUYING
Amount: 0.0367 SOL
SOL Balance: 0.0598 SOL
Token Balance: 41483843214175
Priority Fee: 100000 microlamports

✅ Transaction completed: https://explorer.solana.com/tx/signature

📊 Volume Progress: 0.0880 / 2.0000 SOL (4.40%)

-----------------------------------------------------

Target volume of 0.0500 SOL has been achieved! 🎯

📈 Trading Statistics:
Buy Volume: 0.0273 SOL (1 trade)
Sell Volume: 0.0319 SOL (1 trade)
Buy/Sell Ratio: 1.17


💰 Balance Changes:
SOL: +0.0046 SOL
Token: -31574092420809
```

### Things to know
* Make sure to hold both the BASE and the QUOTE token.
* 1 SOL = 1000000000 lamports.
* Min and Max amount are in lamports.
* Priority fee is in microlamports with default settings it is set to 100000(~0.000012 SOL).
* If you get too many failed transactions you could try increasing the priority fee.
* If you want to actively use the bot don't use the public RPC endpoint.


**Now you can have fun creating fake volume for your dead shitcoins.** 
