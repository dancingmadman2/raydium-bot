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
  