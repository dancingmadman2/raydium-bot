# Raydium Trading Bot

A simple configurable trading bot for executing trades on the Raydium DEX, built with the Raydium SDK.
https://github.com/raydium-io/raydium-sdk-V2-demo


### Prerequisites
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
| PRIVATE_KEY_X | Private keys in base58 string or in byte array format (X starts from 0) | yourSolWalletsPrivateKeyString, [11,22,33,44,...]  |
| RPC_ENDPOINT_X | RPC endpoint URLs (X starts from 0) | https://your-first-rpc-endpoint.com/apiKey |

Example `.env`:
```ini
# Private keys can be in either format:
PRIVATE_KEY_0=yourSolWalletsPrivateKeyString
PRIVATE_KEY_1=[1,2,3,4,...]
PRIVATE_KEY_2=[11,22,33,44,...]
RPC_ENDPOINT_0=https://your-first-rpc-endpoint.com/apiKey
RPC_ENDPOINT_1=https://your-second-rpc-endpoint.com/apiKey
RPC_ENDPOINT_2=https://your-third-rpc-endpoint.com/apiKey
```

#### Trading parameters (.env.config)
| Parameter | Description | Value |
|-----------|-------------|---------|
| POOL_ID | Raydium CPMM pool ID for trading | 93tjgwff5Ac5ThyMi8C4WejVVQq4tuMeMuYW1LEYZ7bu |
| TOKEN_MINT | Mint address of the quote token | Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump |
| TARGET_VOLUME | The volume you want to achieve in SOL | 1.2 |
| BUY_AMOUNT | Amount of SOL to use per buy trade (can be range or single value) | 0.15,0.6 |
| SELL_AMOUNT | Amount of tokens to use per sell trade (can be range or single value) | 100000,450000 |
| SWEEP_MODE | Enable sweep mode to clean the wallets | false |
| SWEEP_THRESHOLD | Amount of SOL to keep in each wallet when sweeping | 0.1 |
| TIME_INTERVAL | Time between trades in seconds | 15 |
| SLIPPAGE | Maximum allowed slippage percentage | 0.01 |
| COMPUTE | Compute units limit for transactions | 120000 |
| PRIORITY_FEE | Priority fee in microlamports. Increase if transactions keep failing | 200000 |


Example `.env.config`:
```ini
POOL_ID=93tjgwff5Ac5ThyMi8C4WejVVQq4tuMeMuYW1LEYZ7bu
TOKEN_MINT=Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump  # mint address of the quote token
TARGET_VOLUME=1.2 # in sol
BUY_AMOUNT=0.15,0.6 # Amount of SOL per buy trade (range or single value)
SELL_AMOUNT=100000,450000 # Amount of tokens per sell trade (range or single value)
SWEEP_MODE=false # set to true to sweep all wallets
SWEEP_THRESHOLD=0.1 # Amount of SOL to keep in each wallet
TIME_INTERVAL=15
SLIPPAGE=0.01
COMPUTE=120000
PRIORITY_FEE=200000
```
  
### Usage

```bash
yarn dev volumeBot.ts
```

The bot handles multiple wallets in a single instance with smart wallet rotation, RPC management and a sweep mode to clean out all the wallets above a certain threshold:
- Automatically rotates between wallets
- Manages multiple RPC endpoints to handle failover
- Tracks volume and balance changes per wallet
- Balanced trading
- Detailed statistics and progress tracking
- Detailed per-wallet performance tracking

### Example Output
```bash

🔄 BUYING with wallet: 9xKt8PdxvK3ZwqULRHyXM1Zc5YvMQiZvGZDYtjxT4nWr
Amount: 0.3876 SOL
SOL Balance: 0.8234 SOL
Token Balance: 2845931.54 TOKEN (284593154287465 raw)
Priority Fee: 187719 microlamports

✅ Transaction completed: https://explorer.solana.com/tx/signature

📊 Volume Progress: 0.3876 / 2.0000 SOL (19.38%)

🔄 SELLING with wallet: EhR5DGjW7vYqhGbmcYnV3mWgC4PYgJrXkxGmuJwKXmNs
Amount: 524876.32 TOKEN (52487632198745 raw)
SOL Balance: 1.2456 SOL
Token Balance: 1987452.23 TOKEN (198745223654789 raw)
Priority Fee: 190184 microlamports

✅ Transaction completed: https://explorer.solana.com/tx/signature

📊 Volume Progress: 0.9125 / 2.0000 SOL (45.62%)

-----------------------------------------------------

Target volume of 2.0 SOL has been achieved! 🎯

📈 Trading Statistics:
Buy Volume: 0.3876 SOL (1 trade)
Sell Volume: 0.5249 SOL (1 trade)
Buy/Sell Ratio: 0.74


📊 Per-Wallet Performance:

┌───────────────────────────────────────────────────────────────────────────────
│ Wallet          │ Buy Vol │ Sell Vol │ \# Trades │ SOL Change │ Token Change │
├───────────────────────────────────────────────────────────────────────────────
│ Hk4R...w9Pq    │  0.4521 │   0.3891 │        4 │    -0.0630 │  +124563.45 │
│ 7Ymt...kN3x    │  0.2845 │   0.4267 │        3 │    +0.1422 │  -234891.67 │
│ Bx9p...vM5s    │  0.3167 │   0.2988 │        2 │    -0.0179 │   +45672.23 │
│ 5nKj...qL7d    │  0.1890 │   0.4123 │        3 │    +0.2233 │  -312456.78 │
│ PwY2...h6Rk    │  0.2756 │   0.1987 │        2 │    -0.0769 │   +89234.56 │
│ mN4x...t9Wv    │  0.3412 │   0.2845 │        3 │    -0.0567 │   +67823.12 │
│ Qs7g...k2Pn    │  0.1654 │   0.3678 │        3 │    +0.2024 │  -278945.34 │
│ 3vXm...b5Jh    │  0.2987 │   0.2134 │        2 │    -0.0853 │   +98672.45 │
│ Ry9k...m4Ws    │  0.4123 │   0.3256 │        4 │    -0.0867 │  +112345.67 │
│ 8tPq...n7Vx    │  0.2645 │   0.3831 │        3 │    +0.1186 │  -156789.23 │ 
└─────────────────────────────────────────────────────────────────────────────


💰 Balance Changes:
SOL: +0.2100 SOL
Token: -54567123
```

### Things to know
* Make sure to hold both the BASE and the QUOTE token.
* 1 SOL = 1000000000 lamports.
* Min and Max amount are in lamports.
* Priority fee is in microlamports with default settings it is set to 100000(~0.000012 SOL).
* You can use multiple RPC endpoints to avoid rate limiting.


**Now you can have fun creating fake volume for your dead shitcoins.** 
