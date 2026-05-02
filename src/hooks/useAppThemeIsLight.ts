import { useEffect, useState } from "react";

import { useSettingsStore } from "../store/settingsStore";

/** Light vs dark shell (respects system when theme is `system`). */
export function useAppThemeIsLight(): boolean {
  const theme = useSettingsStore((s) => s.theme);
  const [light, setLight] = useState(false);

  useEffect(() => {
    const apply = () => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setLight(theme === "light" || (theme === "system" && !prefersDark));
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  return light;
}
