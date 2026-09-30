# QuietBallot — deployment

| Field | Value |
|---|---|
| Network | **Preview** (temporary — Preprod faucet was down) |
| Contract address | `PENDING_PREVIEW_DEPLOY` |
| Deployer unshielded | `(deploy via 1AM UI)` |
| Timestamp (UTC) | pending |
| Indexer | `https://indexer.preview.midnight.network/api/v4/graphql` |
| Node / RPC | `https://rpc.preview.midnight.network` |
| Faucet | `https://faucet.preview.midnight.network` |

## How to deploy (you)

1. 1AM → network **Preview**
2. Fund: https://faucet.preview.midnight.network/
3. Open https://quiet-ballot.vercel.app/
4. Connect 1AM → **Deploy ballot box**
5. Copy the address from status line and paste here / chat

## Record helper

```bash
MIDNIGHT_NETWORK=preview MIDNIGHT_CONTRACT_ADDRESS=<addr> RECORD_ONLY=1 npm run deploy:preview
```
