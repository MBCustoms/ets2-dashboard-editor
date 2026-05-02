import { useState } from "react";

import { useProjectStore } from "../../store/projectStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useT } from "../../i18n";

export function GameRootWarning() {
  const t = useT();
  const gameRoot = useSettingsStore((s) => s.gameRootPath);
  const projectRoot = useProjectStore((s) => s.project?.gameRootPath);
  const [dismissed, setDismissed] = useState(false);

  const effectiveRoot = (projectRoot?.trim() || gameRoot.trim());
  if (effectiveRoot || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-amber-600/50 bg-amber-950/90 px-4 py-3 shadow-2xl">
      <span className="text-lg text-amber-400">⚠</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-300">{t("warning_game_root_title")}</p>
        <p className="mt-0.5 text-[11px] text-amber-400/80">
          {t("warning_game_root_desc")}
        </p>
      </div>
      <button
        type="button"
        className="shrink-0 text-lg leading-none text-amber-500 hover:text-amber-200"
        onClick={() => setDismissed(true)}
        title={t("warning_dismiss")}
      >
        ×
      </button>
    </div>
  );
}
