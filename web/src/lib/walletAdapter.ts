import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import type {
  MidnightProvider,
  UnboundTransaction,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { Transaction } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { bytesToHex, hexToBytes } from "@qb/witnesses";

type FinalizedLike = {
  serialize: () => Uint8Array;
  identifiers: () => string[];
};

function txIdFromFinalized(tx: FinalizedLike): string {
  const id = tx.identifiers().at(-1);
  if (!id) throw new Error("Finalized transaction has no identifier");
  return id;
}

/**
 * Bridge Midnight ConnectedAPI (1AM / Lace / …) ↔ midnight-js providers.
 */
export function createWalletProvidersFromConnector(
  api: ConnectedAPI,
  shielded: {
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  },
): { walletProvider: WalletProvider; midnightProvider: MidnightProvider } {
  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => shielded.shieldedCoinPublicKey as never,
    getEncryptionPublicKey: () =>
      shielded.shieldedEncryptionPublicKey as never,
    async balanceTx(tx: UnboundTransaction) {
      const hex = bytesToHex(tx.serialize());
      const { tx: balancedHex } = await api.balanceUnsealedTransaction(hex, {
        payFees: true,
      });
      return Transaction.deserialize(
        "signature",
        "proof",
        "binding",
        hexToBytes(balancedHex),
      ) as never;
    },
  };

  const midnightProvider: MidnightProvider = {
    async submitTx(tx) {
      const finalized = tx as unknown as FinalizedLike;
      const id = txIdFromFinalized(finalized);
      await api.submitTransaction(bytesToHex(finalized.serialize()));
      return id as never;
    },
  };

  return { walletProvider, midnightProvider };
}
