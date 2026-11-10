import { describe, expect, it } from "vitest";
import {
  afterWrongPin,
  isFullPin,
  isWeakPin,
  newSalt,
  pinHash,
  sha256,
  shouldLockAfterAway,
  waitSecondsLeft,
  WRONG_TRIES_BEFORE_WAIT,
} from "./appLockRules";

describe("sha256", () => {
  it("matches the standard test values", () => {
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    );
  });
});

describe("PIN", () => {
  it("is stored salted, so the same PIN looks different on two phones", () => {
    const a = pinHash("2580", "aa");
    expect(a).not.toContain("2580");
    expect(pinHash("2580", "aa")).toBe(a);
    expect(pinHash("2580", "bb")).not.toBe(a);
  });

  it("needs four digits", () => {
    expect(isFullPin("2580")).toBe(true);
    expect(isFullPin("258")).toBe(false);
    expect(isFullPin("25a0")).toBe(false);
  });

  it("turns down easy-to-guess PINs", () => {
    for (const p of ["0000", "1111", "1234", "4321", "6789", "9876"]) expect(isWeakPin(p)).toBe(true);
    for (const p of ["2580", "1357", "8042"]) expect(isWeakPin(p)).toBe(false);
  });

  it("makes a 32-character salt", () => {
    expect(newSalt()).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("locking", () => {
  it("locks once the app has been away for the chosen time", () => {
    expect(shouldLockAfterAway(59_000, 1)).toBe(false);
    expect(shouldLockAfterAway(60_000, 1)).toBe(true);
    expect(shouldLockAfterAway(4 * 60_000, 5)).toBe(false);
    expect(shouldLockAfterAway(-5, 1)).toBe(false);
    expect(shouldLockAfterAway(NaN, 1)).toBe(false);
  });

  it("makes you wait 30 seconds after five wrong PINs", () => {
    let state = { wrongTries: 0, waitUntil: null as number | null };
    for (let i = 1; i < WRONG_TRIES_BEFORE_WAIT; i++) {
      state = afterWrongPin(state.wrongTries, 1000);
      expect(state.waitUntil).toBeNull();
    }
    state = afterWrongPin(state.wrongTries, 1000);
    expect(state).toEqual({ wrongTries: 0, waitUntil: 31_000 });
    expect(waitSecondsLeft(state.waitUntil, 1000)).toBe(30);
    expect(waitSecondsLeft(state.waitUntil, 30_500)).toBe(1);
    expect(waitSecondsLeft(state.waitUntil, 31_000)).toBe(0);
  });
});
