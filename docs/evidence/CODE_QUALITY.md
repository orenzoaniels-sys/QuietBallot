# QuietBallot — code quality audit

## Architecture

| Area | Assessment |
|---|---|
| Compact contract | Single focus circuit `castBallot`; getters for public reads; Compact 0.31.1 |
| Witness encoding | LE u64 choiceId + `QuietBal` domain tag; length-checked |
| Providers | Session-cached; `setContractAddress` before join/call; 1AM proof preferred + HTTP fallback |
| Join path | Indexer `queryContractState` — no `watchForDeployTxData` hang |
| Frontend | Ballot-paper UI distinct from survey/gate/auction clones; selection cleared after cast |
| Tests | Vitest covers artifacts, encoding, valid/invalid casts, ledger privacy keys |
| CI | `npm ci` → `npm test` → `web:sync-zk` → web `ci` → web build |
| Secrets | Seeds / `.env` gitignored; evidence docs never store seeds |

## Privacy

- Public: `lastBallotValid`, `ballotsCast`, `latestBallotCommitment` only
- Private: `choiceId`, claim bytes — never rendered on the public ballot-box panel
- No on-chain per-option tallies in L2/L3

## Risks / follow-ups

- Preprod deploy requires funded 1AM; CLI deploy optional
- Demo video URL may remain pending until upload
- Level 4–6 (eligibility, timed tallies) documented in proposal only
