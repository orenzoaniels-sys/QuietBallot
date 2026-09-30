export const NETWORK_ID = "preview" as const;

/** Active deploy target — Preview (faucet up). Switch back to preprod when L2 faucet recovers. */
export const NETWORK = {
  network: NETWORK_ID,
  indexerUrl: "https://indexer.preview.midnight.network/api/v4/graphql",
  indexerWsUrl: "wss://indexer.preview.midnight.network/api/v4/graphql/ws",
  nodeUrl: "https://rpc.preview.midnight.network",
  faucetUrl: "https://faucet.preview.midnight.network",
  proofServerUrl:
    import.meta.env.VITE_PROOF_SERVER_URL ?? "http://127.0.0.1:6300",
  explorerContractBase: "https://explorer.preview.midnight.network/contract",
  label: "Preview",
};

/** @deprecated use NETWORK — kept so older imports keep working */
export const PREPROD = NETWORK;

/** Prefill Join field — env override or known Preview deploy. */
export const DEFAULT_CONTRACT_ADDRESS =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined)?.trim() || "";

export const ZK_ASSET_BASE = "/zk/quiet-ballot";

export const BALLOT_OPTIONS = [
  { id: 1n, letter: "A", title: "Option A", blurb: "Approve the proposal" },
  { id: 2n, letter: "B", title: "Option B", blurb: "Request revisions" },
  { id: 3n, letter: "C", title: "Option C", blurb: "Reject / abstain path" },
] as const;
