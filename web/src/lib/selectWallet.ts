import type { InitialAPI } from "@midnight-ntwrk/dapp-connector-api";

/** Prefer 1AM (`window.midnight['1am']`), then any injected Midnight wallet. */
export function listWallets(): InitialAPI[] {
  const injected = window.midnight;
  if (!injected) return [];
  return Object.values(injected).filter(
    (w): w is InitialAPI => !!w && typeof w.connect === "function",
  );
}

export function selectWallet(): InitialAPI {
  const injected = window.midnight ?? {};

  const byKey = injected["1am"];
  if (byKey && typeof byKey.connect === "function") {
    return byKey;
  }

  const wallets = listWallets();
  if (wallets.length === 0) {
    throw new Error(
      "No Midnight wallet found. Install 1AM (https://1am.xyz) and refresh.",
    );
  }

  const oneAm = wallets.find(
    (w) => /^1am$/i.test(w.name) || /1am/i.test(w.rdns ?? ""),
  );
  if (oneAm) return oneAm;

  return wallets[0]!;
}
