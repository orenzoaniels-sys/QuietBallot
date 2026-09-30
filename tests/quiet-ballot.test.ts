import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  ledger,
} from "../contracts/managed/quiet-ballot/contract/index.js";
import {
  createPrivateState,
  decodeChoiceId,
  encodeClaim,
  DOMAIN_TAG,
  witnesses,
  type QuietBallotPrivateState,
} from "../src/witnesses.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const managed = join(root, "contracts", "managed", "quiet-ballot");

const COIN = "0".repeat(64);
const ADDR = RT.sampleContractAddress();

function setup(choiceId: bigint) {
  const privateState: QuietBallotPrivateState = createPrivateState(choiceId);
  const contract = new Contract(witnesses);
  const ctor = contract.initialState(
    RT.createConstructorContext(privateState, COIN),
  );
  const ctx = RT.createCircuitContext(
    ADDR,
    COIN,
    ctor.currentContractState,
    ctor.currentPrivateState,
  );
  return { contract, ctx, privateState };
}

describe("QuietBallot managed artifacts", () => {
  it("ships compiler, contract, keys, and zkir directories", () => {
    for (const dir of ["compiler", "contract", "keys", "zkir"]) {
      expect(existsSync(join(managed, dir)), `missing ${dir}`).toBe(true);
    }
  });

  it("lists expected circuits and witness in contract-info.json", () => {
    const infoPath = join(managed, "compiler", "contract-info.json");
    expect(existsSync(infoPath)).toBe(true);
    const info = JSON.parse(readFileSync(infoPath, "utf8")) as {
      circuits: { name: string }[];
      witnesses: { name: string }[];
      "compiler-version": string;
    };
    expect(info["compiler-version"]).toBe("0.31.1");
    const names = info.circuits.map((c) => c.name).sort();
    expect(names).toEqual(
      [
        "castBallot",
        "getBallotsCast",
        "getLastBallotValid",
        "getLatestBallotCommitment",
      ].sort(),
    );
    expect(info.witnesses.map((w) => w.name)).toContain("privateBallotClaim");
  });

  it("has prover/verifier keys for every circuit", () => {
    const keys = readdirSync(join(managed, "keys"));
    for (const circuit of [
      "castBallot",
      "getBallotsCast",
      "getLastBallotValid",
      "getLatestBallotCommitment",
    ]) {
      expect(keys).toContain(`${circuit}.prover`);
      expect(keys).toContain(`${circuit}.verifier`);
    }
  });
});

describe("QuietBallot claim encoding", () => {
  it("encodes LE choiceId and QuietBal domain tag", () => {
    const claim = encodeClaim(2n);
    expect(claim.length).toBe(32);
    expect(decodeChoiceId(claim)).toBe(2n);
    expect(new TextDecoder().decode(claim.slice(24))).toBe(DOMAIN_TAG);
  });
});

describe("QuietBallot runtime ledger", () => {
  it("starts with lastBallotValid=false, ballotsCast=0, empty commitment", () => {
    const { ctx } = setup(1n);
    const state = ledger(ctx.currentQueryContext.state);
    expect(state.lastBallotValid).toBe(false);
    expect(state.ballotsCast).toBe(0n);
    expect(state.latestBallotCommitment.every((b) => b === 0)).toBe(true);
  });

  it("marks lastBallotValid=true and bumps count for choice in 1..3", () => {
    const { contract, ctx } = setup(2n);
    const after = contract.impureCircuits.castBallot(ctx, 2n);
    const state = ledger(after.context.currentQueryContext.state);
    expect(state.lastBallotValid).toBe(true);
    expect(state.ballotsCast).toBe(1n);
    expect(state.latestBallotCommitment.some((b) => b !== 0)).toBe(true);

    const valid = contract.impureCircuits.getLastBallotValid(after.context);
    expect(valid.result).toBe(true);
    const count = contract.impureCircuits.getBallotsCast(after.context);
    expect(count.result).toBe(1n);
  });

  it("allows under-demo choice 0 but sets lastBallotValid=false", () => {
    const { contract, ctx } = setup(0n);
    const after = contract.impureCircuits.castBallot(ctx, 0n);
    const state = ledger(after.context.currentQueryContext.state);
    expect(state.lastBallotValid).toBe(false);
    expect(state.ballotsCast).toBe(1n);
    expect(state.latestBallotCommitment.some((b) => b !== 0)).toBe(true);
  });

  it("allows choice 9 (outside range) with lastBallotValid=false", () => {
    const { contract, ctx } = setup(9n);
    const after = contract.impureCircuits.castBallot(ctx, 9n);
    const state = ledger(after.context.currentQueryContext.state);
    expect(state.lastBallotValid).toBe(false);
    expect(state.ballotsCast).toBe(1n);
  });

  it("accepts boundary choices 1 and 3 as lastBallotValid=true", () => {
    const low = setup(1n);
    const afterLow = low.contract.impureCircuits.castBallot(low.ctx, 1n);
    expect(ledger(afterLow.context.currentQueryContext.state).lastBallotValid).toBe(
      true,
    );

    const high = setup(3n);
    const afterHigh = high.contract.impureCircuits.castBallot(high.ctx, 3n);
    expect(
      ledger(afterHigh.context.currentQueryContext.state).lastBallotValid,
    ).toBe(true);
  });

  it("updates commitment and count on successive ballots", () => {
    const { contract, ctx } = setup(1n);
    const first = contract.impureCircuits.castBallot(ctx, 1n);
    const mid = ledger(first.context.currentQueryContext.state);
    const second = contract.impureCircuits.castBallot(first.context, 0n);
    const end = ledger(second.context.currentQueryContext.state);
    expect(mid.ballotsCast).toBe(1n);
    expect(end.ballotsCast).toBe(2n);
    expect(end.lastBallotValid).toBe(false);
    expect(end.latestBallotCommitment.some((b) => b !== 0)).toBe(true);
    const commitment = contract.impureCircuits.getLatestBallotCommitment(
      second.context,
    );
    expect(commitment.result).toEqual(end.latestBallotCommitment);
  });

  it("never exposes choiceId fields on the public ledger view", () => {
    const { contract, ctx } = setup(2n);
    const after = contract.impureCircuits.castBallot(ctx, 2n);
    const state = ledger(after.context.currentQueryContext.state) as Record<
      string,
      unknown
    >;
    expect(Object.keys(state).sort()).toEqual(
      ["ballotsCast", "lastBallotValid", "latestBallotCommitment"].sort(),
    );
    expect(state).not.toHaveProperty("choiceId");
    expect(state).not.toHaveProperty("claim");
  });
});
