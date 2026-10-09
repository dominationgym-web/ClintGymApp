import { describe, expect, it, vi } from "vitest";

vi.mock("expo-image-manipulator", () => ({ ImageManipulator: {}, SaveFormat: { JPEG: "jpeg" } }));

import { shrunkSize } from "./shrinkPhoto";

describe("shrunkSize", () => {
  it("scales the long side of a tall phone photo down to 1600px", () => {
    expect(shrunkSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it("scales a wide photo by its width", () => {
    expect(shrunkSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  it("leaves a photo that's already small enough alone", () => {
    expect(shrunkSize(1080, 1600)).toBeNull();
    expect(shrunkSize(800, 600)).toBeNull();
  });

  it("leaves a photo with unknown size alone", () => {
    expect(shrunkSize(0, 0)).toBeNull();
  });
});
