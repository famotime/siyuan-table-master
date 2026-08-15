import { describe, expect, it, vi } from "vitest";
import { clearSettings, defaultSettings } from "../src/settings";

describe("defaultSettings", () => {
  it("has enableDragReorder disabled by default", () => {
    expect(defaultSettings.enableDragReorder).toBe(false);
  });
});

describe("clearSettings", () => {
  it("removes the same storage key used for plugin settings", async () => {
    const removeData = vi.fn().mockResolvedValue(undefined);

    await clearSettings({ removeData });

    expect(removeData).toHaveBeenCalledOnce();
    expect(removeData).toHaveBeenCalledWith("config");
  });
});

