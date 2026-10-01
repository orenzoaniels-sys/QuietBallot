import { useCallback, useEffect, useRef, useState } from "react";
import "@midnight-ntwrk/dapp-connector-api";
import { useMidnightWallet } from "./hooks/useMidnightWallet";
import { clearProvidersCache, getProviders } from "./lib/providers";
import {
  castBallot,
  deployQuietBallot,
  joinQuietBallot,
  readPublicState,
  type PublicLedgerView,
} from "./lib/ballotApi";
import {
  BALLOT_OPTIONS,
  DEFAULT_CONTRACT_ADDRESS,
  NETWORK,
  NETWORK_ID,
} from "./lib/config";
import "./styles.css";

function shortAddr(value: string): string {
  if (value.length < 20) return value;
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function formatActionError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (
    lower.includes("insufficient") ||
    lower.includes("balance") ||
    lower.includes("not enough") ||
    lower.includes("funds")
  ) {
    return `Not enough Preprod funds. Fund your UNSHIELDED address at ${NETWORK.faucetUrl} then retry Deploy.`;
  }
  if (
    lower.includes("network") ||
    lower.includes("preprod") ||
    lower.includes("preview") ||
    lower.includes("wrong chain")
  ) {
    return `1AM must be on Preprod (not Preview). Switch network in 1AM, reconnect, then Deploy. Detail: ${raw}`;
  }
  if (
    lower.includes("proof") ||
    lower.includes("proving") ||
    lower.includes("127.0.0.1:6300") ||
    lower.includes("failed to fetch")
  ) {
    return `Proving failed. Keep 1AM open, approve the prove prompt, and retry. Detail: ${raw}`;
  }
  if (lower.includes("no midnight wallet") || lower.includes("1am")) {
    return raw;
  }
  return raw;
}

export default function App() {
  const wallet = useMidnightWallet();
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT_ADDRESS);
  const [joined, setJoined] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<bigint | null>(null);
  const [voterNote, setVoterNote] = useState("");
  const [ledger, setLedger] = useState<PublicLedgerView | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [status, setStatus] = useState("Connect 1AM on Preprod to open the booth.");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [provingLocally, setProvingLocally] = useState(false);
  const autoJoinTried = useRef(false);

  const walletLabel = wallet.walletName ?? "1AM";

  const requireApi = useCallback(() => {
    const session = wallet.session.current;
    if (!session) throw new Error("Connect 1AM first");
    return session.api;
  }, [wallet.session]);

  const doJoin = useCallback(
    async (address: string, silent = false) => {
      const trimmed = address.trim();
      if (!trimmed) {
        setActionError("Paste a Preprod ballot-box address first.");
        return false;
      }
      if (!silent) {
        setActionBusy(true);
        setActionError(null);
        setStatus("Joining ballot box (indexer only, no wallet tx)…");
      }
      try {
        const providers = await getProviders(requireApi());
        await joinQuietBallot(providers, trimmed);
        const view = await readPublicState(providers, trimmed);
        setLedger(view);
        setJoined(true);
        setContractAddress(trimmed);
        setStatus(`Joined ${shortAddr(trimmed)} — ready to cast an anonymous ballot`);
        setActionError(null);
        return true;
      } catch (err) {
        setJoined(false);
        setActionError(formatActionError(err));
        setStatus("Join failed — see error below.");
        return false;
      } finally {
        if (!silent) setActionBusy(false);
      }
    },
    [requireApi],
  );

  useEffect(() => {
    if (!wallet.connected) {
      autoJoinTried.current = false;
      setJoined(false);
      clearProvidersCache();
      setStatus("Connect 1AM on Preprod to open the booth.");
      return;
    }
    if (autoJoinTried.current || joined || !contractAddress.trim()) return;
    autoJoinTried.current = true;
    setStatus("Auto-joining known Preprod ballot box…");
    void doJoin(contractAddress, true).then((ok) => {
      if (!ok) {
        setStatus("Connect OK — Deploy a new ballot box or tap Join.");
      }
    });
  }, [wallet.connected, contractAddress, joined, doJoin]);

  async function onDeploy() {
    setActionBusy(true);
    setActionError(null);
    setStatus("Deploying QuietBallot to Preprod (proving may take a minute)…");
    try {
      const session = wallet.session.current;
      if (!session) throw new Error("Connect 1AM first");
      if (session.networkId !== NETWORK_ID) {
        throw new Error(
          `Wallet network is "${session.networkId}" but app expects "${NETWORK_ID}". Switch 1AM to Preprod and reconnect.`,
        );
      }
      const providers = await getProviders(session.api);
      const { address } = await deployQuietBallot(providers, 0n);
      const view = await readPublicState(providers, address);
      setLedger(view);
      setContractAddress(address);
      setJoined(true);
      setStatus(`Ballot box deployed on Preprod: ${address}`);
    } catch (err) {
      setActionError(formatActionError(err));
      setStatus("Deploy failed — see error below.");
    } finally {
      setActionBusy(false);
    }
  }

  async function onJoin() {
    await doJoin(contractAddress, false);
  }

  async function onCast() {
    const trimmed = contractAddress.trim();
    if (!trimmed) {
      setActionError("Paste a Preprod ballot-box address first.");
      return;
    }
    if (selectedChoice === null) {
      setActionError("Select Option A, B, or C on the ballot paper.");
      return;
    }
    const choiceId = selectedChoice;
    setActionBusy(true);
    setActionError(null);
    setProvingLocally(true);
    setStatus("Proving ballot… private choice stays off the public board.");
    try {
      const providers = await getProviders(requireApi());
      if (!joined) {
        setStatus("Attaching to ballot box, then proving…");
        await joinQuietBallot(providers, trimmed);
        setJoined(true);
      } else {
        providers.privateStateProvider.setContractAddress(trimmed);
      }

      const result = await castBallot(providers, trimmed, choiceId);
      setLedger(result.public);
      setTxHash(result.txHash ?? null);
      setSelectedChoice(null);
      setVoterNote("");
      setProvingLocally(false);
      setStatus(
        result.public.lastBallotValid
          ? "Ballot sealed. Public board shows participation + commitment — never your option."
          : "Outside 1–3 range. Cast allowed; lastBallotValid=false — choice still private.",
      );
    } catch (err) {
      setActionError(formatActionError(err));
      setStatus("Ballot cast failed — see error below.");
      setProvingLocally(false);
    } finally {
      setActionBusy(false);
    }
  }

  function onDisconnect() {
    clearProvidersCache();
    setJoined(false);
    autoJoinTried.current = false;
    setSelectedChoice(null);
    wallet.disconnect();
  }

  return (
    <div className="booth">
      <div className="booth-texture" aria-hidden />

      <header className="topbar">
        <div className="brand">
          <span className="stamp">QB</span>
          <span className="brand-name">QuietBallot</span>
        </div>
        <div className="wallet-actions">
          {wallet.connected && wallet.address ? (
            <span className="addr" title={wallet.address}>
              {shortAddr(wallet.address)}
            </span>
          ) : null}
          {wallet.connected ? (
            <button className="btn" type="button" onClick={onDisconnect}>
              Disconnect {walletLabel}
            </button>
          ) : (
            <button
              className="btn btn-ink"
              type="button"
              disabled={wallet.busy}
              onClick={() => void wallet.connect().catch(() => undefined)}
            >
              {wallet.busy ? "Connecting…" : "Connect 1AM"}
            </button>
          )}
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">Private voting · Midnight Preprod</p>
        <h1>QuietBallot</h1>
        <p className="hero-lead">
          Cast an anonymous ballot on Midnight Preprod: the private vote choice
          never appears on the public ledger; observers only see that a valid
          ballot was sealed, how many ballots exist, and a commitment.
        </p>
        <div className="cta-row">
          {!wallet.connected ? (
            <button
              className="btn btn-stamp"
              type="button"
              disabled={wallet.busy}
              onClick={() => void wallet.connect().catch(() => undefined)}
            >
              Open booth with 1AM
            </button>
          ) : (
            <button
              className="btn btn-stamp"
              type="button"
              disabled={actionBusy}
              onClick={() => void onDeploy()}
            >
              Deploy ballot box
            </button>
          )}
        </div>
        {wallet.error ? <p className="err">{wallet.error}</p> : null}
      </section>

      <div className="layout">
        <section className="ballot-paper" aria-label="Private ballot">
          <div className="ballot-head">
            <h2>Official ballot</h2>
            <p>
              Mark <strong>one</strong> private choice. Your selection is proved
              locally and never shown on the public ballot box.
            </p>
          </div>

          <div className="field">
            <label htmlFor="contract">Ballot box address (Preprod)</label>
            <input
              id="contract"
              value={contractAddress}
              onChange={(e) => {
                setContractAddress(e.target.value);
                setJoined(false);
                autoJoinTried.current = false;
              }}
              placeholder="Preprod contract address"
              spellCheck={false}
            />
          </div>

          <div className="choices" role="radiogroup" aria-label="Private vote options">
            {BALLOT_OPTIONS.map((opt) => {
              const active = selectedChoice === opt.id;
              return (
                <button
                  key={opt.letter}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`choice-card ${active ? "selected" : ""}`}
                  disabled={actionBusy}
                  onClick={() => setSelectedChoice(opt.id)}
                >
                  <span className="choice-letter">{opt.letter}</span>
                  <span className="choice-body">
                    <strong>{opt.title}</strong>
                    <span>{opt.blurb}</span>
                  </span>
                  <span className="choice-mark" aria-hidden>
                    {active ? "●" : "○"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="field">
            <label htmlFor="note">
              Local voter note (optional — never sent on-chain)
            </label>
            <input
              id="note"
              value={voterNote}
              onChange={(e) => setVoterNote(e.target.value)}
              placeholder="Personal reminder only"
              maxLength={120}
            />
          </div>

          <div className="cta-row">
            <button
              className="btn btn-stamp"
              type="button"
              disabled={!wallet.connected || actionBusy}
              onClick={() => void onDeploy()}
            >
              {actionBusy ? "Deploying…" : "Deploy ballot box"}
            </button>
            <button
              className="btn"
              type="button"
              disabled={!wallet.connected || actionBusy}
              onClick={() => void onJoin()}
            >
              {joined ? "Re-join box" : "Join ballot box"}
            </button>
            <button
              className="btn btn-stamp"
              type="button"
              disabled={
                !wallet.connected ||
                actionBusy ||
                !contractAddress.trim() ||
                selectedChoice === null
              }
              onClick={() => void onCast()}
            >
              Cast anonymous ballot
            </button>
          </div>
          {!wallet.connected ? (
            <p className="note">
              Connect 1AM on <strong>Preprod</strong> first — Deploy stays disabled until then.
            </p>
          ) : null}

          {joined ? (
            <p className="note">
              Joined — casting needs one wallet confirm for prove/submit.
            </p>
          ) : null}
          {provingLocally ? (
            <p className="note proving">Proving ballot… choice held only in this session.</p>
          ) : null}
          {actionError ? <p className="err">{actionError}</p> : null}
          <p className="status-line">{status}</p>
        </section>

        <section className="ballot-box" aria-label="Public ballot box">
          <h2>Public ballot box</h2>
          <p className="lede">
            What observers can verify — never which option was marked.
            No per-option tallies on-chain at Level 2/3.
          </p>
          <dl className="box-stats">
            <div>
              <dt>ballotsCast</dt>
              <dd>{ledger ? ledger.ballotsCast.toString() : "—"}</dd>
            </div>
            <div>
              <dt>lastBallotValid</dt>
              <dd>
                {ledger ? (
                  <span className={`seal ${ledger.lastBallotValid ? "ok" : "no"}`}>
                    {ledger.lastBallotValid ? "true" : "false"}
                  </span>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>latestBallotCommitment</dt>
              <dd className="mono">
                {ledger
                  ? `${ledger.latestBallotCommitmentHex.slice(0, 20)}…`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>last tx</dt>
              <dd className="mono">{txHash ? shortAddr(txHash) : "—"}</dd>
            </div>
            <div>
              <dt>network</dt>
              <dd>Preprod</dd>
            </div>
          </dl>
          {contractAddress ? (
            <p className="note">
              Indexer address: <code>{shortAddr(contractAddress)}</code>
            </p>
          ) : null}
        </section>
      </div>

      <section className="privacy">
        <h2>Privacy claim</h2>
        <table>
          <tbody>
            <tr>
              <th>Observer CAN</th>
              <td>
                See <code>ballotsCast</code>, <code>lastBallotValid</code>, and{" "}
                <code>latestBallotCommitment</code>
              </td>
            </tr>
            <tr>
              <th>Observer CANNOT</th>
              <td>
                Learn which of A / B / C you marked — choiceId and claim stay
                private (witness only)
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="footer">
        <span>QuietBallot · Level 3 — First Quarter</span>
        <span>
          Faucet:{" "}
          <a href={NETWORK.faucetUrl} target="_blank" rel="noreferrer">
            Preprod
          </a>
        </span>
      </footer>
    </div>
  );
}
