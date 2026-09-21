import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";

export type AnalyticsSettings = {
  trackingEnabled: boolean;
  heatmapEnabled: boolean;
  dataRetentionDays: number;
  searchConsole: {
    connected: boolean;
    siteUrl: string;
  };
};

const SETTINGS_KEY = "analyticsSettings";

const DEFAULT_ANALYTICS_SETTINGS: AnalyticsSettings = {
  trackingEnabled: true,
  heatmapEnabled: true,
  dataRetentionDays: 180,
  searchConsole: {
    connected: false,
    siteUrl: "",
  },
};

export async function loadAnalyticsSettings(): Promise<AnalyticsSettings> {
  const row = await prisma.global.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return DEFAULT_ANALYTICS_SETTINGS;
  const value = row.value as Partial<AnalyticsSettings> | null;
  return {
    ...DEFAULT_ANALYTICS_SETTINGS,
    ...value,
    searchConsole: {
      ...DEFAULT_ANALYTICS_SETTINGS.searchConsole,
      ...value?.searchConsole,
    },
  };
}

type AnalyticsSettingsPatch = Partial<Omit<AnalyticsSettings, "searchConsole">> & {
  searchConsole?: Partial<AnalyticsSettings["searchConsole"]>;
};

export async function saveAnalyticsSettings(patch: AnalyticsSettingsPatch): Promise<AnalyticsSettings> {
  const current = await loadAnalyticsSettings();
  const merged: AnalyticsSettings = {
    ...current,
    ...patch,
    searchConsole: { ...current.searchConsole, ...patch.searchConsole },
  };
  await prisma.global.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: merged as unknown as Prisma.InputJsonValue },
    create: { key: SETTINGS_KEY, value: merged as unknown as Prisma.InputJsonValue },
  });
  return merged;
}
