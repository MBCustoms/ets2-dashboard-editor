import { useSettingsStore } from "../store/settingsStore";
import en, { type TranslationKey } from "./en";
import tr from "./tr";

export type { TranslationKey };
export type Language = "en" | "tr";

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "tr", label: "Türkçe" },
];

const dictionaries = { en, tr } as const;

export function useT() {
  const language = useSettingsStore((s) => s.language) as Language;
  const dict = dictionaries[language] ?? en;
  return (key: TranslationKey): string => (dict as Record<string, string>)[key] ?? en[key] ?? key;
}
