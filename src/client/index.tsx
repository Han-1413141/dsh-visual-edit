import React from "react";
import { CursorIcon, VisualEditPanel, type PanelProps } from "./panel";
import { en, zh } from "./locales";

// The host resolves these services; React is supplied by the DSH module loader.
export const inject = ["slots", "locale", "sidebarRight", "sidebarRightTabs"];
export function apply(ctx: any): void {
  const namespace = "dshVisualEdit";
  const t = ctx.locale.bind(namespace);
  ctx.effect(
    () => ctx.locale.register(namespace, { en, zh }),
    "dsh-visual-edit.copy",
  );
  ctx.effect(
    () =>
      ctx.sidebarRightTabs.register({
        id: "dsh-visual-edit",
        kind: "visual-edit",
        multiple: false,
        priority: "extension",
        keepMounted: true,
        title: () => t("title"),
        guide: [
          {
            id: "new",
            order: 35,
            title: () => t("title"),
            description: () => t("description"),
            icon: CursorIcon,
          },
        ],
      }),
    "dsh-visual-edit.type",
  );
  ctx.effect(
    () =>
      ctx.slots.inject("sidebar.right.pane.tab", () =>
        ctx.slots.register(
          {
            name: "sidebar.right.pane.tab",
            key: "dsh-visual-edit",
            locale: namespace,
          },
          (props: PanelProps) => <VisualEditPanel {...props} />,
        ),
      ),
    "dsh-visual-edit.body",
  );
  ctx.effect(
    () =>
      ctx.slots.inject("conversation.session.header.actions", () =>
        ctx.slots.register(
          {
            name: "conversation.session.header.actions",
            id: "dsh-visual-edit.open",
            locale: namespace,
          },
          (props: PanelProps) => (
            <button
              type="button"
              title={props.t("open")}
              aria-label={props.t("open")}
              onClick={() => ctx.sidebarRight.openTab("visual-edit")}
              style={{
                background: "transparent",
                color: "inherit",
                border: 0,
                padding: 5,
                cursor: "pointer",
              }}
            >
              <CursorIcon width="18" height="18" />
            </button>
          ),
        ),
      ),
    "dsh-visual-edit.open",
  );
}
