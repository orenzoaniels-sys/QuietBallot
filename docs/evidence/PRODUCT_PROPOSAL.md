# QuietBallot — product proposal (Level 3 evidence)

> Non-root evidence file for Idea Submission / First Quarter.

## Product

**QuietBallot** is a private voting booth on Midnight: voters mark Option A / B / C locally, prove a sealed ballot on Preprod, and leave only participation metadata on the public ledger.

**One-liner:** Cast an anonymous ballot on Midnight Preprod — the private vote choice never appears on the public ledger; observers only see that a valid ballot was sealed, how many ballots exist, and a commitment.

## Why Midnight

Midnight’s Compact circuits let the dApp **disclose** only `lastBallotValid`, `ballotsCast`, and `latestBallotCommitment` while keeping `choiceId` + the 32-byte claim as private witness data. That matches civic voting: verifiable turnout without publishing who chose what.

## Data model

| Layer | Fields |
|---|---|
| Public ledger | `lastBallotValid`, `ballotsCast`, `latestBallotCommitment` |
| Private (witness / circuit param) | `choiceId` (1=A, 2=B, 3=C), `privateBallotClaim` (LE u64 + tag `QuietBal`) |
| Local-only UI | Optional voter note — never sent on-chain |

**Explicit non-goal for L2/L3:** on-chain per-option tallies (would weaken the anonymous-ballot story).

## Levels 4–6 scope (proposal only — not implemented)

- **L4:** Multi-election ballot boxes, voter eligibility attestations without linking to choice
- **L5:** Threshold reveal / timed tally ceremony with separate disclosure circuits
- **L6:** Production ops, auditing, and governance UX for DAO / municipal pilots

## Idea Submission copy-paste

**Q1 — Idea name / short description**  
QuietBallot — Private Voting: anonymous ballots with publicly verifiable participation (ballots cast + commitment + validity) without revealing which option a voter chose.

**Q2 — Category**  
Governance (best fit)

**Q2 alt**  
Other — privacy-preserving civic participation
