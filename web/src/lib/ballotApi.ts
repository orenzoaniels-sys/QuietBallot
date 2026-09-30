import { CompiledContract } from "@midnight-ntwrk/compact-js";
import {
  createCircuitCallTxInterface,
  deployContract,
  verifyContractState,
} from "@midnight-ntwrk/midnight-js-contracts";
import { ContractExecutable } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { sampleSigningKey } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { Contract, ledger } from "@qb/contract";
import {
  createPrivateState,
  PRIVATE_STATE_ID,
  witnesses,
  bytesToHex,
  type QuietBallotPrivateState,
} from "@qb/witnesses";
import type { QuietBallotProviders } from "./providers";

export type PublicLedgerView = {
  lastBallotValid: boolean;
  ballotsCast: bigint;
  latestBallotCommitmentHex: string;
};

const compiledContract = CompiledContract.make("quiet-ballot", Contract).pipe(
  CompiledContract.withWitnesses(witnesses as never),
);

export type DeployedQuietBallot = {
  deployTxData: {
    private: {
      signingKey: string;
      initialPrivateState: QuietBallotPrivateState;
    };
    public: {
      contractAddress: string;
      initialContractState: unknown;
    };
  };
  callTx: ReturnType<typeof createCircuitCallTxInterface>;
};

function bindPrivateState(
  providers: QuietBallotProviders,
  contractAddress: string,
): void {
  providers.privateStateProvider.setContractAddress(contractAddress);
}

function makeCallTx(providers: QuietBallotProviders, contractAddress: string) {
  return createCircuitCallTxInterface(
    providers,
    compiledContract,
    contractAddress,
    PRIVATE_STATE_ID,
  );
}

export async function deployQuietBallot(
  providers: QuietBallotProviders,
  choiceForInitialState = 0n,
): Promise<{ contract: DeployedQuietBallot; address: string }> {
  const contract = await deployContract(providers, {
    compiledContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: createPrivateState(choiceForInitialState),
  });
  const address = contract.deployTxData.public.contractAddress;
  bindPrivateState(providers, address);
  return {
    contract: {
      ...(contract as unknown as DeployedQuietBallot),
      callTx: makeCallTx(providers, address),
    },
    address,
  };
}

/**
 * Attach to an already-deployed Preview contract.
 * Uses HTTP indexer queries (no watchForDeployTxData hang after later calls).
 */
export async function joinQuietBallot(
  providers: QuietBallotProviders,
  contractAddress: string,
  privateState?: QuietBallotPrivateState,
): Promise<DeployedQuietBallot> {
  const address = contractAddress.trim();
  if (!address) throw new Error("Contract address required");

  bindPrivateState(providers, address);

  const currentContractState =
    await providers.publicDataProvider.queryContractState(address);
  if (!currentContractState) {
    throw new Error(`No contract found on Preview at ${address}`);
  }

  const initialContractState =
    (await providers.publicDataProvider.queryDeployContractState(address)) ??
    currentContractState;

  const circuitIds =
    ContractExecutable.make(compiledContract).getProvableCircuitIds();
  const verifierKeys =
    await providers.zkConfigProvider.getVerifierKeys(circuitIds);
  verifyContractState(verifierKeys, currentContractState);

  const existingKey =
    await providers.privateStateProvider.getSigningKey(address);
  const signingKey = existingKey ?? sampleSigningKey();
  if (!existingKey) {
    await providers.privateStateProvider.setSigningKey(address, signingKey);
  }

  const initialPrivateState = privateState ?? createPrivateState(0n);
  await providers.privateStateProvider.set(
    PRIVATE_STATE_ID,
    initialPrivateState,
  );

  return {
    deployTxData: {
      private: { signingKey, initialPrivateState },
      public: { contractAddress: address, initialContractState },
    },
    callTx: makeCallTx(providers, address),
  };
}

/** Public ledger via indexer HTTP â€” no wallet / prove txs. */
export async function readPublicState(
  providers: QuietBallotProviders,
  contractAddress: string,
): Promise<PublicLedgerView> {
  const state =
    await providers.publicDataProvider.queryContractState(contractAddress);
  if (!state) {
    throw new Error(`No contract state at ${contractAddress}`);
  }
  const view = ledger(state.data);
  return {
    lastBallotValid: Boolean(view.lastBallotValid),
    ballotsCast: view.ballotsCast as bigint,
    latestBallotCommitmentHex: bytesToHex(
      view.latestBallotCommitment as Uint8Array,
    ),
  };
}

/**
 * Prove + submit castBallot, then refresh public view from indexer.
 */
export async function castBallot(
  providers: QuietBallotProviders,
  contractAddress: string,
  choiceId: bigint,
): Promise<{
  txHash?: string;
  public: PublicLedgerView;
}> {
  const address = contractAddress.trim();
  if (!address) throw new Error("Contract address required");

  bindPrivateState(providers, address);
  await providers.privateStateProvider.set(
    PRIVATE_STATE_ID,
    createPrivateState(choiceId),
  );

  const before = await readPublicState(providers, address);
  const callTx = makeCallTx(providers, address);
  const txData = await callTx.castBallot(choiceId);
  const pub = txData.public as { txHash?: string; txId?: string };

  let publicView = before;
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 1200));
    publicView = await readPublicState(providers, address);
    if (publicView.ballotsCast !== before.ballotsCast) break;
  }

  return {
    txHash: pub.txHash ?? pub.txId,
    public: publicView,
  };
}

