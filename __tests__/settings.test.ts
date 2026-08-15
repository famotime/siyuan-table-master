import { describe, expect, it, vi } from "vitest";
import { clearSettings, defaultSettings, loadSettings, saveSettings } from "../src/settings";

describe("defaultSettings", () => {
  it("has enableDragReorder disabled by default", () => {
    expect(defaultSettings.enableDragReorder).toBe(false);
  });
});

describe("loadSettings & saveSettings", () => {
  it("loads and saves settings correctly", async () => {
    const mockStorage: Record<string, any> = {};
    const plugin = {
      loadData: vi.fn(async (key: string) => mockStorage[key]),
      saveData: vi.fn(async (key: string, data: any) => {
        mockStorage[key] = data;
      }),
    };

    const loaded = await loadSettings(plugin);
    expect(loaded).toEqual(defaultSettings);

    loaded.fixCJKWidth = false;
    await saveSettings(plugin, loaded);
    expect(plugin.saveData).toHaveBeenCalledWith("config", {
      ...defaultSettings,
      fixCJKWidth: false,
    });
  });

  it("merges existing storage with default settings", async () => {
    const plugin = {
      loadData: vi.fn(async () => ({ fixCJKWidth: false, enableLog: true })),
      saveData: vi.fn(async () => {}),
    };

    const loaded = await loadSettings(plugin);
    expect(loaded.fixCJKWidth).toBe(false);
    expect(loaded.enableLog).toBe(true);
    expect(loaded.showFloatingToolbar).toBe(true);
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


