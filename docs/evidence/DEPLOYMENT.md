# QuietBallot — deployment

| Field | Value |
|---|---|
| Network | Preprod (Level 2 — Waxing Crescent) |
| Contract address | `PENDING_PREPROD_DEPLOY` |
| Deployer unshielded | `(deploy via 1AM UI)` |
| Timestamp (UTC) | pending |
| Proof server | wallet / `http://127.0.0.1:6300` |
| Indexer | `https://indexer.preprod.midnight.network/api/v4/graphql` |
| Node / RPC | `https://rpc.preprod.midnight.network` |
| Faucet | `https://faucet.preprod.midnight.network` |

## Notes

- Prefer **Deploy ballot box** in the live UI with funded 1AM on Preprod.
- After deploy, paste the address here and into README / `VITE_CONTRACT_ADDRESS`.
- CLI path: `MIDNIGHT_SEED=… npm run deploy:preprod` (requires local proof server).

## Record helper

```bash
MIDNIGHT_CONTRACT_ADDRESS=<addr> MIDNIGHT_DEPLOYER_ADDRESS=<addr> RECORD_ONLY=1 npm run deploy:preprod
```
