/**
 * Deploy QuietBallot to Preview or Preprod.
 *
 *   MIDNIGHT_NETWORK=preprod MIDNIGHT_SEED=<64-hex> npm run deploy:preprod
 *   MIDNIGHT_CONTRACT_ADDRESS=<hex> RECORD_ONLY=1 npm run deploy:preprod
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as Rx from "rxjs";
import { Buffer } from "buffer";

import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import { unshieldedToken } from "@midnight-ntwrk/ledger-v8";
import { generateRandomSeed } from "@midnight-ntwrk/wallet-sdk-hd";

import {
  createWallet,
  createProviders,
  compiledContract,
  zkConfigPath,
  CONFIG,
} from "./utils.js";
import { createPrivateState } from "./witnesses.js";
import { resolveNetwork } from "./network.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const netName = (process.env.MIDNIGHT_NETWORK ?? "preprod").toLowerCase();

function assertArtifacts() {
  for (const dir of ["compiler", "contract", "keys", "zkir"]) {
    const p = join(zkConfigPath, dir);
    if (!existsSync(p)) {
      throw new Error(`Missing managed artifact: ${p}. Run npm run compile:wsl`);
    }
  }
  console.log("Managed artifacts OK:", zkConfigPath);
}

function writeDeployEvidence(address: string, deployer: string, extra = "") {
  const evidenceDir = join(root, "docs", "evidence");
  mkdirSync(evidenceDir, { recursive: true });
  const stamp = new Date().toISOString();
  const networkLabel =
    netName === "preprod"
      ? "Preprod (Level 2 — Waxing Crescent)"
      : "Preview (Level 1 — New Moon)";
  const body = `# QuietBallot — deployment

| Field | Value |
|---|---|
| Network | ${networkLabel} |
| Contract address | \`${address}\` |
| Deployer unshielded | \`${deployer}\` |
| Timestamp (UTC) | ${stamp} |
| Proof server | \`${CONFIG.proofServer}\` |
| Indexer | \`${CONFIG.indexer}\` |
| Node / RPC | \`${CONFIG.node}\` |
| Faucet | \`${CONFIG.faucet}\` |

## Notes

- Level 2 requires a **Preprod** address when available.
- 1AM UI deploy is an alternate path: connect wallet → Deploy ballot box.
- Secrets (seeds) are never committed. Use \`.env\` locally only.
${extra}

## Log snippet

\`\`\`
QuietBallot deploy target: ${netName}
Contract: ${address}
Deployer: ${deployer}
At: ${stamp}
\`\`\`
`;

  writeFileSync(join(evidenceDir, "DEPLOYMENT.md"), body);
  writeFileSync(
    join(evidenceDir, `${netName}-deploy.txt`),
    `network=${netName}\ncontract=${address}\ndeployer=${deployer}\nat=${stamp}\n`,
  );
  console.log("Wrote docs/evidence/DEPLOYMENT.md");
}

async function requestFaucet(address: string) {
  const url = CONFIG.faucet.replace(/\/$/, "");
  for (const path of ["/request", "/api/request", "/"]) {
    try {
      const res = await fetch(`${url}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ address }),
      });
      const text = await res.text();
      console.log(`Faucet ${path} → ${res.status}: ${text.slice(0, 200)}`);
      if (res.ok) return true;
    } catch (err) {
      console.log(`Faucet ${path} failed:`, err);
    }
  }
  return false;
}

async function main() {
  resolveNetwork(netName);
  console.log(`\n=== QuietBallot ${netName} deploy ===\n`);
  assertArtifacts();

  const existing = process.env.MIDNIGHT_CONTRACT_ADDRESS?.trim();
  if (existing && process.env.RECORD_ONLY === "1") {
    writeDeployEvidence(
      existing,
      process.env.MIDNIGHT_DEPLOYER_ADDRESS ?? "(provided)",
    );
    return;
  }

  const seed =
    process.env.MIDNIGHT_SEED?.trim() ||
    toHex(Buffer.from(generateRandomSeed()));

  if (!process.env.MIDNIGHT_SEED) {
    console.log("Generated ephemeral seed (NOT saved to disk).");
  }

  console.log(`Creating wallet + syncing ${netName}…`);
  const walletCtx = await createWallet(seed);

  let address = "";
  try {
    address = String(walletCtx.unshieldedKeystore.getBech32Address());
  } catch {
    address = "(address unavailable)";
  }
  console.log(`Deployer unshielded: ${address}`);

  const state = await Promise.race([
    Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.throttleTime(3000),
        Rx.filter((s) => s.isSynced),
      ),
    ),
    new Promise<never>((_, rej) =>
      setTimeout(
        () => rej(new Error(`${netName} wallet sync timed out after 90s`)),
        90_000,
      ),
    ),
  ]).catch(async (err) => {
    writeDeployEvidence(
      "PENDING_PREPROD_DEPLOY",
      address,
      `\n- **Blocker:** ${err instanceof Error ? err.message : String(err)}. Prefer 1AM UI deploy on Preprod.\n`,
    );
    await walletCtx.wallet.stop().catch(() => undefined);
    throw err;
  });

  let balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  console.log(`Balance: ${balance.toString()}`);

  if (balance === 0n) {
    await requestFaucet(address);
    try {
      balance = await Rx.firstValueFrom(
        walletCtx.wallet.state().pipe(
          Rx.throttleTime(8000),
          Rx.filter((s) => s.isSynced),
          Rx.map((s) => s.unshielded.balances[unshieldedToken().raw] ?? 0n),
          Rx.filter((b) => b > 0n),
          Rx.timeout({ first: 120_000 }),
        ),
      );
    } catch {
      writeDeployEvidence(
        "PENDING_PREPROD_DEPLOY",
        address,
        "\n- **Blocker:** faucet did not fund in time. Fund via 1AM + https://faucet.preprod.midnight.network then deploy from the UI.\n",
      );
      await walletCtx.wallet.stop();
      process.exit(2);
    }
  }

  console.log("Deploying QuietBallot…");
  const providers = await createProviders(walletCtx);
  const deployed = await deployContract(providers, {
    compiledContract,
    privateStateId: "quietBallotPrivateState",
    initialPrivateState: createPrivateState(0n),
  });
  const contractAddress = deployed.deployTxData.public.contractAddress;
  console.log(`Deployed: ${contractAddress}`);
  writeDeployEvidence(contractAddress, address);
  await walletCtx.wallet.stop();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
