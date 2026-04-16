# Liteforge Swap

Liteforge Swap is a clean, fast token swap experience for the Liteforge ecosystem.

It is designed to feel simple for first-time users while still looking and behaving like a modern DEX product.

## What this app does

- Lets users connect a wallet and prepare token swaps
- Shows instant quote feedback while users type amounts
- Includes a liquidity area and high-level market stats
- Provides a polished, responsive interface for desktop and mobile

## Who it is for

- Liteforge community members who want quick token exchanges
- Teams prototyping DeFi product flows before mainnet launch
- Developers building on top of a swap-first UI foundation

## Current product status

This version is a functional product demo.

Wallet connection, balances, quotes, and swap execution are currently simulated in src/utils/web3.ts so the flow can be tested end to end without chain dependencies.

## Why this project matters

- Demonstrates the full user journey from connect to swap confirmation
- Gives a strong starting point for production DeFi UX
- Includes a Solidity AMM contract draft in contracts/LiteforgeSwap.sol for backend evolution

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL shown in your terminal (typically http://localhost:5173).

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Next product milestones

- Replace simulated web3 functions with real wallet and RPC integration
- Connect UI actions to deployed swap contracts
- Add transaction history, slippage controls, and clearer failure states
- Add integration tests for critical swap flows
