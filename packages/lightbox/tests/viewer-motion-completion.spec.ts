import { describe, expect, it, vi } from "vitest";
import {
  clearViewerMotion,
  completeViewerMotion,
  ViewerMotionCompletion,
  waitForViewerMotion,
} from "../src/viewer-motion-completion";

describe("ViewerMotionCompletion", () => {
  it("settles every waiter at its semantic boundary", async () => {
    const completion = new ViewerMotionCompletion();
    const first = vi.fn();
    const second = vi.fn();
    void completion.wait("open").then(first);
    void completion.wait("open").then(second);

    completion.complete("open");
    await Promise.resolve();

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("keeps different motion kinds independent", async () => {
    const completion = new ViewerMotionCompletion();
    const opened = vi.fn();
    const closed = vi.fn();
    void completion.wait("open").then(opened);
    void completion.wait("close").then(closed);

    completion.complete("open");
    await Promise.resolve();

    expect(opened).toHaveBeenCalledOnce();
    expect(closed).not.toHaveBeenCalled();
  });

  it("settles an aborted waiter and removes it from later completion", async () => {
    const completion = new ViewerMotionCompletion();
    const controller = new AbortController();
    const settled = vi.fn();
    void completion.wait("selection", controller.signal).then(settled);

    controller.abort();
    await Promise.resolve();
    completion.complete("selection");

    expect(settled).toHaveBeenCalledOnce();
  });

  it("clears pending work during teardown", async () => {
    const completion = new ViewerMotionCompletion();
    const opened = vi.fn();
    const closed = vi.fn();
    void completion.wait("open").then(opened);
    void completion.wait("close").then(closed);

    completion.clear();
    await Promise.resolve();

    expect(opened).toHaveBeenCalledOnce();
    expect(closed).toHaveBeenCalledOnce();
  });

  it("keeps the compatibility adapter channel outside the owner API", async () => {
    const owner = {};
    const settled = vi.fn();
    void waitForViewerMotion(owner, "open").then(settled);

    completeViewerMotion(owner, "open");
    await Promise.resolve();
    clearViewerMotion(owner);

    expect(settled).toHaveBeenCalledOnce();
    expect(Object.keys(owner)).toEqual([]);
  });
});
