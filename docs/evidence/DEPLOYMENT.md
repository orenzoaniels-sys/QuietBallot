# QuietBallot — deployment

| Field | Value |
|---|---|
| Network | **Preprod** (Level 2 — Waxing Crescent) |
| Contract address | `PENDING_PREPROD_DEPLOY` |
| Deployer unshielded | `(deploy via 1AM UI)` |
| Timestamp (UTC) | pending |
| Indexer | `https://indexer.preprod.midnight.network/api/v4/graphql` |
| Node / RPC | `https://rpc.preprod.midnight.network` |
| Faucet | `https://faucet.preprod.midnight.network` |

## How to deploy

1. 1AM → network **Preprod**
2. Fund unshielded: https://faucet.preprod.midnight.network/
3. Open https://quiet-ballot.vercel.app/
4. Connect 1AM → **Deploy ballot box**
5. Copy address from status → paste in chat / here

## Record helper

```bash
MIDNIGHT_CONTRACT_ADDRESS=<addr> RECORD_ONLY=1 npm run deploy:preprod
```
