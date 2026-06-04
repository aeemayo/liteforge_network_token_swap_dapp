# Lite Swap

Lite Swap is a clean, fast token swap experience for the Liteforge ecosystem.

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

This version is a functional dApp prototype with live wallet and contract wiring.

- Wallet connection is real (EIP-1193 compatible wallets)
- Quote reads are on-chain via LiteforgeSwap.getSwapQuote
- Swap execution is on-chain with allowance checks and approval flow
- Token availability is zkLTC-first with user-added Liteforge ERC-20 tokens by address

Live ERC-20 wallet balances are shown for selected tokens.

Note: Liquidity dashboard cards are still placeholder UI values.

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

## Environment variables

Configure these values in .env:

```bash
VITE_SWAP_CONTRACT_ADDRESS=0xYourDeployedSwapContract
VITE_LITEFORGE_CHAIN_ID=4441
VITE_EXPLORER_TX_URL=https://liteforge.explorer.caldera.xyz/tx/{txHash}
```

If VITE_EXPLORER_TX_URL does not contain {txHash}, the app appends the hash to the end of the URL.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Next product milestones

- Replace static liquidity pool cards with on-chain pool analytics
- Add transaction history and richer slippage configuration
- Add integration tests for critical swap flows
