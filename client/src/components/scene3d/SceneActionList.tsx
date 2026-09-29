import { useTranslation } from "react-i18next";
import type { GameAction, GameObject } from "../../adapter/types.ts";
import { abilityChoiceLabel } from "../../viewmodel/costLabel.ts";

interface SceneActionListProps {
  object: GameObject;
  actions: readonly GameAction[];
  onAction: (action: GameAction) => void;
  onClose: () => void;
}

export function SceneActionList({ object, actions, onAction, onClose }: SceneActionListProps) {
  const { t } = useTranslation("game");
  if (actions.length === 0) return null;
  return (
    <section
      className="pointer-events-auto absolute right-3 top-1/2 z-20 w-56 -translate-y-1/2 rounded-lg border border-amber-700/60 bg-gray-950/95 p-2 text-white shadow-xl"
      data-context-menu-ignore
      aria-label={object.name}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <strong className="truncate text-sm">{object.name}</strong>
        <button
          type="button"
          className="rounded px-1 text-gray-300 hover:bg-white/10"
          aria-label={t("dialogShell.close")}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {actions.map((action, index) => {
          const { label, description } = abilityChoiceLabel(action, object);
          return (
            <button
              key={`${action.type}-${index}`}
              type="button"
              className="rounded bg-amber-950/70 px-2 py-1.5 text-left text-sm hover:bg-amber-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
              title={description}
              onClick={() => onAction(action)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
