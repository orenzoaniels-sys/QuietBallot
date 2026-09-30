/**
 * Midnight network endpoints. Level 2 primary target is Preprod.
 */

export type MidnightNetwork = "preview" | "preprod" | "undeployed";

export type NetworkConfig = {
  network: MidnightNetwork;
  proofServerUrl: string;
  indexerUrl: string;
  indexerWsUrl: string;
  nodeUrl: string;
  faucetUrl: string;
};

const PREVIEW: NetworkConfig = {
  network: "preview",
  proofServerUrl: process.env.PROOF_SERVER_URL ?? "http://127.0.0.1:6300",
  indexerUrl: "https://indexer.preview.midnight.network/api/v4/graphql",
  indexerWsUrl: "wss://indexer.preview.midnight.network/api/v4/graphql/ws",
  nodeUrl: "https://rpc.preview.midnight.network",
  faucetUrl: "https://faucet.preview.midnight.network",
};

const PREPROD: NetworkConfig = {
  network: "preprod",
  proofServerUrl: process.env.PROOF_SERVER_URL ?? "http://127.0.0.1:6300",
  indexerUrl: "https://indexer.preprod.midnight.network/api/v4/graphql",
  indexerWsUrl: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  nodeUrl: "https://rpc.preprod.midnight.network",
  faucetUrl: "https://faucet.preprod.midnight.network",
};

export function resolveNetwork(name?: string): NetworkConfig {
  const key = (name ?? process.env.MIDNIGHT_NETWORK ?? "preprod").toLowerCase();
  if (key === "preview") return PREVIEW;
  return PREPROD;
}

export const previewNetwork = PREVIEW;
export const preprodNetwork = PREPROD;
