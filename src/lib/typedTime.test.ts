import { describe, expect, it } from "vitest";
import { finishTypedTime, formatTypedTime } from "./typedTime";

// Types one key at a time, the way a phone hands each change to the box.
const typeKeys = (keys: string) => [...keys].reduce((box, key) => formatTypedTime(box + key), "");

describe("formatTypedTime", () => {
  it("puts the colon in as the digits are typed", () => {
    expect(typeKeys("2030")).toBe("20:30");
    expect(typeKeys("730")).toBe("7:30");
    expect(typeKeys("0730")).toBe("07:30");
    expect(typeKeys("1745")).toBe("17:45");
  });

  it("shows the in-between steps", () => {
    expect(formatTypedTime("2")).toBe("2");
    expect(formatTypedTime("20")).toBe("20");
    expect(formatTypedTime("203")).toBe("2:03");
    expect(formatTypedTime("2:030")).toBe("20:30");
  });

  it("keeps a colon the person typed", () => {
    expect(typeKeys("7:30")).toBe("7:30");
    expect(typeKeys("20:30")).toBe("20:30");
    expect(formatTypedTime("7.30")).toBe("7:30");
  });

  it("stops at four digits", () => {
    expect(formatTypedTime("20:305")).toBe("20:30");
  });

  it("lets backspace work normally", () => {
    expect(formatTypedTime("20:3")).toBe("20:3");
    expect(formatTypedTime("20:")).toBe("20:");
    expect(formatTypedTime("2")).toBe("2");
    expect(formatTypedTime("")).toBe("");
  });
});

describe("finishTypedTime", () => {
  it("tidies the time when the box is left", () => {
    expect(finishTypedTime("7")).toBe("07:00");
    expect(finishTypedTime("20")).toBe("20:00");
    expect(finishTypedTime("7:30")).toBe("07:30");
    expect(finishTypedTime("7:")).toBe("07:00");
    expect(finishTypedTime("20:30")).toBe("20:30");
  });

  it("leaves something that isn't a time as typed", () => {
    expect(finishTypedTime("25:00")).toBe("25:00");
    expect(finishTypedTime("7:3")).toBe("7:3");
    expect(finishTypedTime("")).toBe("");
  });
});
