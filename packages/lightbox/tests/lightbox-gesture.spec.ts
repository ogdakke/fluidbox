import { describe, expect, test } from "vitest";
import {
  boundDismissOffset,
  boundDismissVelocity,
  dismissCloseValue,
  dismissRadiusProgress,
  dismissReturnValue,
  dragDistance,
  type LightboxDragState,
} from "../src/lightbox-gesture";

describe("dismiss bounds", () => {
  test("tracks the finger before reaching an edge", () => {
    expect(boundDismissOffset(40, "x")).toBe(40);
    expect(boundDismissOffset(-70, "y")).toBe(-70);
  });

  test("engages the horizontal edge before the vertical edge", () => {
    expect(boundDismissOffset(60, "x")).toBeLessThan(60);
    expect(boundDismissOffset(60, "y")).toBe(60);
    expect(boundDismissOffset(90, "y")).toBeLessThan(90);
  });

  test("resists each edge independently without creating a hard wall", () => {
    expect(boundDismissOffset(-240, "x")).toBe(-boundDismissOffset(240, "x"));
    expect(boundDismissOffset(10_000, "x")).toBeGreaterThan(boundDismissOffset(1_000, "x"));
    expect(boundDismissOffset(10_000, "y")).toBeGreaterThan(boundDismissOffset(1_000, "y"));
    expect(boundDismissOffset(10_000, "x")).toBeLessThan(1_000);
    expect(boundDismissOffset(10_000, "y")).toBeLessThan(1_000);
  });

  test("uses a rectangular distance instead of a radial distance", () => {
    const state = { x: 120, y: 120, wheelTarget: undefined } as LightboxDragState;
    expect(dragDistance(state)).toBe(120);
  });

  test("reduces outward flick velocity near an edge", () => {
    const centered = boundDismissVelocity(0, 3, "x");
    const nearEdge = boundDismissVelocity(45, 3, "x");

    expect(centered).toBeGreaterThan(nearEdge);
    expect(nearEdge).toBeGreaterThan(0);
    expect(boundDismissVelocity(-45, -3, "x")).toBe(-nearEdge);
  });

  test("does not resist a flick returning toward the destination", () => {
    expect(boundDismissVelocity(100, -0.5, "y")).toBe(-0.5);
  });

  test("finishes rounding halfway to the soft edge on either axis", () => {
    expect(dismissRadiusProgress(12, 0)).toBe(0.5);
    expect(dismissRadiusProgress(0, 20)).toBe(0.5);
    expect(dismissRadiusProgress(24, 0)).toBe(1);
    expect(dismissRadiusProgress(0, 40)).toBe(1);
  });

  test("starts gently and settles within the dismissal window", () => {
    expect(dismissReturnValue(100, 0, 0, 16)).toBeGreaterThan(90);
    expect(dismissReturnValue(100, 0, 0, 100)).toBeLessThan(30);
    expect(Math.abs(dismissReturnValue(100, 0, 0, 220))).toBeLessThan(1);
  });

  test("never crosses the thumbnail target while closing", () => {
    const cases: Array<[number, number, number]> = [
      [100, 0, 0],
      [100, 0, -5],
      [0, 100, 5],
      [-40, 20, 3],
    ];
    for (const [from, to, velocity] of cases) {
      const values = Array.from({ length: 61 }, (_, index) =>
        dismissCloseValue(from, to, velocity, (220 * index) / 60),
      );
      expect(values.every((value) => value >= Math.min(from, to))).toBe(true);
      expect(values.every((value) => value <= Math.max(from, to))).toBe(true);
      expect(Math.abs(values.at(-1)! - to)).toBeLessThan(1);
    }
  });

  test("starts a long offscreen close without skipping hundreds of pixels", () => {
    const firstFrame = dismissCloseValue(0, 5_000, 0, 16, 480, 720);
    expect(firstFrame).toBeGreaterThan(0);
    expect(firstFrame).toBeLessThan(60);
    expect(dismissCloseValue(0, 5_000, 0, 480, 480, 720)).toBe(5_000);
  });
});
