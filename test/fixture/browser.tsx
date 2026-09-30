import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createNativeIntegration } from "../../src/client/native-integration";
import { type Webview } from "../../src/client/native-session";
import { en } from "../../src/client/locales";
import "./dsh-theme.css";

// A test adapter for Electron's two webview methods/events, not a real Electron shell.
function Browser() {
  const view = useRef<Webview | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  return (
    <div style={{ height: "100%" }}>
      <form style={{ height: 38 }}>http://localhost/browser-page.html</form>
      {React.createElement(
        "webview",
        {
          "data-sidebar-browser-frame": "webview",
          style: { display: "block", height: "calc(100% - 38px)" },
          ref: (node: Webview | null): void => {
            view.current = node;
            if (node) {
              node.getURL = () => frame.current!.contentWindow!.location.href;
              node.executeJavaScript = async (code: string) =>
                (frame.current!.contentWindow as any).eval(code);
            }
          },
        },
        <iframe
          ref={frame}
          title="Browser test page"
          src="/browser-page.html"
          style={{ width: "100%", height: "100%", border: 0 }}
          onLoad={() =>
            view.current?.dispatchEvent(new Event("did-finish-load"))
          }
        />,
      )}
    </div>
  );
}
const integration = createNativeIntegration((key) => en[key]);
const NativeBrowser = integration.browserBody(Browser);
const signal = new AbortController().signal;
const useTabInfo = () => ({ tab: { id: "browser", signal, visible: true } });
function Fixture() {
  const [draft, setDraft] = useState("Existing draft.");
  return (
    <main style={{ display: "flex", height: "100vh" }}>
      <aside style={{ width: 340, padding: 20 }}>
        <h1>Browser transport test adapter</h1>
        <textarea
          aria-label="Composer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{ width: "100%", height: 360 }}
        />
      </aside>
      <div style={{ flex: 1, minWidth: 0 }}>
        <NativeBrowser
          sessionId="browser-test"
          useTabInfo={useTabInfo}
          inputActions={{
            captureInsertion: () => ({
              start: draft.length,
              end: draft.length,
              draftRev: 0,
            }),
            insertText: (text: string) => {
              setDraft((s) => s + text);
              return true;
            },
          }}
        />
      </div>
    </main>
  );
}
document.body.style.margin = "0";
createRoot(document.getElementById("root")!).render(<Fixture />);
