import { describe, expect, it, vi } from "vitest";
import { clearSettings } from "../src/settings";

describe("clearSettings", () => {
  it("removes the same storage key used for plugin settings", async () => {
    const removeData = vi.fn().mockResolvedValue(undefined);

    await clearSettings({ removeData });

    expect(removeData).toHaveBeenCalledOnce();
    expect(removeData).toHaveBeenCalledWith("config");
  });
});
