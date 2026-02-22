import { getPromptOverride, savePromptOverride } from "@/lib/promptOverrides.server";
import {
  SITE_COPY_SETTINGS_FILENAME,
  getDefaultSiteCopySettings,
  normalizeSiteCopySettings,
  parseSiteCopySettingsInput,
  type SiteCopySettings,
} from "@/lib/siteCopySettings";

export async function getRuntimeSiteCopySettings(): Promise<SiteCopySettings> {
  const fallback = getDefaultSiteCopySettings();
  const override = await getPromptOverride(SITE_COPY_SETTINGS_FILENAME);
  if (!override?.content) return fallback;

  try {
    const parsed = JSON.parse(override.content) as unknown;
    return normalizeSiteCopySettings(parsed);
  } catch {
    return fallback;
  }
}

export async function saveRuntimeSiteCopySettings(payload: unknown): Promise<SiteCopySettings> {
  const normalized = parseSiteCopySettingsInput(payload);
  await savePromptOverride(
    SITE_COPY_SETTINGS_FILENAME,
    JSON.stringify(normalized, null, 2),
  );
  return normalized;
}
