# Testnet Deployment Guide

## Prerequisites

- Foundry installed locally (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- A funded testnet wallet (ETH for gas from https://faucet.testnet.chain.robinhood.com)
- Testnet USDG from https://faucet.paxos.com/?network=robinhood

## Steps

### 1. Install dependencies

```bash
cd packages/contracts
forge install
```

### 2. Create .env

```bash
cp .env.example .env
# Edit .env with your values
```

Required values:
```
DEPLOYER_PRIVATE_KEY=0x<your testnet key>
TREASURY=0x<address to receive protocol fees>
```

The default settlement asset is testnet USDG at `0x7E955252E15c84f5768B83c41a71F9eba181802F`.
Do not change this unless you have a specific reason.

### 3. Test locally first

```bash
forge test
```

All 73 tests must pass before deploying.

### 4. Deploy

```bash
source .env
forge script script/DeployTestnet.s.sol \
  --rpc-url https://rpc.testnet.chain.robinhood.com \
  --chain-id 46630 \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url https://explorer.testnet.chain.robinhood.com/api \
  -vvvv
```

### 5. Record addresses

After deploy succeeds, the script prints the Board address.  
Update `BACKEND_PROOF.md`:
- Board address
- Settlement asset address (USDG: 0x7E955252E15c84f5768B83c41a71F9eba181802F)
- Deployment block

### 6. Verify on explorer

Visit https://explorer.testnet.chain.robinhood.com and confirm:
- Board contract is verified
- Owner and treasury are correct

## Using MockUSDC instead of USDG

If USDG faucet is unavailable, deploy with MockUSDC:

```bash
DEPLOY_MOCK_USDC=true forge script script/DeployTestnet.s.sol \
  --rpc-url https://rpc.testnet.chain.robinhood.com \
  --chain-id 46630 \
  --broadcast \
  -vvvv
```

This deploys MockUSDC, mints 1,000,000 USDC to deployer, then deploys Board.  
Record the MockUSDC address in BACKEND_PROOF.md as the settlement asset.

## Testnet Lifecycle

After deploying, run the 8-scenario lifecycle:

1. Approve USDG spend on Board contract
2. `takeVacantSeat(seatId, price, prepaid)` — take a vacant seat
3. `setSeatPrice(seatId, newPrice)` — reprice
4. `topUpSeat(seatId, amount)` — top up
5. From a second wallet: `takeSeat(...)` — takeover
6. Let balance deplete (or warp time in a fork) — seat enters GRACE
7. `topUpSeat(...)` from grace owner — recovery
8. Let deplete again → foreclose with `forecloseSeat(seatId)`
9. `takeVacantSeat(seatId, ...)` again — same seat, new owner

Record every tx hash in BACKEND_PROOF.md.
