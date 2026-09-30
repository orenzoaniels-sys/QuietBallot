/**
 * QuietBallot private claim helpers (browser + Node).
 * Encoding: first 8 bytes LE u64 choiceId; trailing tag "QuietBal".
 * Private voting semantics — no eligibility, allowlist, or survey ratings.
 */

export type QuietBallotPrivateState = {
  claim: Uint8Array;
};

export const PRIVATE_STATE_ID = "quietBallotPrivateState";
export const DOMAIN_TAG = "QuietBal";

export function encodeClaim(choiceId: bigint): Uint8Array {
  const claim = new Uint8Array(32);
  const view = new DataView(claim.buffer);
  view.setBigUint64(0, choiceId, true);
  claim.set(new TextEncoder().encode(DOMAIN_TAG), 24);
  return claim;
}

export function createPrivateState(choiceId: bigint): QuietBallotPrivateState {
  return { claim: encodeClaim(choiceId) };
}

export const witnesses = {
  privateBallotClaim(context: {
    privateState: QuietBallotPrivateState;
  }): [QuietBallotPrivateState, Uint8Array] {
    const { claim } = context.privateState;
    if (!(claim instanceof Uint8Array) || claim.length !== 32) {
      throw new Error("privateBallotClaim requires a 32-byte claim");
    }
    return [context.privateState, claim];
  },
};

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/, "");
  if (cleaned.length % 2 !== 0) throw new Error("invalid hex");
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function decodeChoiceId(claim: Uint8Array): bigint {
  if (claim.length !== 32) throw new Error("claim must be 32 bytes");
  return new DataView(claim.buffer, claim.byteOffset, claim.byteLength).getBigUint64(
    0,
    true,
  );
}
