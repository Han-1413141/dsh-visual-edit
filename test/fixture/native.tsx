import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { createNativeIntegration } from "../../src/client/native-integration";
import { en } from "../../src/client/locales";
import "./dsh-theme.css";

const integration = createNativeIntegration((key) => en[key]);
const address =
  "dsh-resource://file/session/native-test/C:/demo/simple-page.html";
const interactive = !location.search.includes("static");
const signals = [new AbortController(), new AbortController()];
const tabInfo = [0, 1].map((id) => () => ({
  tab: { id: String(id), signal: signals[id].signal, visible: true },
}));
const setResources = () => {};
const html = (updated: boolean) => `<!doctype html><html><head><style>
body{margin:0;background:#201b3d;color:#fff;font:16px system-ui;min-height:100vh;display:grid;place-items:center}
main{padding:50px;background:#ffffff12;border:1px solid #ffffff22;border-radius:24px;text-align:center}
button{background:#b7cdfa;border:0;padding:12px 28px;border-radius:10px;color:#18213d;font:inherit}
</style></head><body><main>
<h1 id="headline">${updated ? "Updated heading" : "Hello, world"}</h1>
<p>Current page, with its state preserved.</p>
<button id="counter" onclick="this.textContent='Clicked '+(++window.count)">Click me</button>
<p id="script-status">Static</p>
</main><script>window.count=0;document.querySelector('#script-status').textContent='Interactive';</script></body></html>`;
const initial = new TextEncoder().encode(html(false));
function Original({ content }: any) {
  return (
    <iframe
      data-html-preview
      sandbox="allow-scripts"
      srcDoc={new TextDecoder().decode(content.data)}
      title="Original preview"
    />
  );
}
const NativeHtml = integration.htmlBody(Original);
const HtmlAction = integration.HtmlAction;
function Fixture() {
  const [data, setData] = useState(initial);
  const [draft, setDraft] = useState("Existing draft.");
  const [second, setSecond] = useState(false);
  const [revision, setRevision] = useState(0);
  function update(source: string) {
    setData(new TextEncoder().encode(source));
    setRevision((n) => n + 1);
  }
  return (
    <main style={{ display: "flex", height: "100vh", fontFamily: "system-ui" }}>
      <div style={{ padding: 20, width: 350 }}>
        <h1>Native preview fixture</h1>
        <p>Test adapter for the DSH document slot.</p>
        <button onClick={() => update(html(true))}>Update source</button>
        <button
          onClick={() =>
            update(
              html(true).replace(
                /<h1[^>]*>.*?<\/h1>/,
                '<p id="replacement">Heading removed</p>',
              ),
            )
          }
        >
          Remove heading
        </button>
        <button onClick={() => update(html(false))}>Reload unchanged</button>
        <button onClick={() => setSecond(!second)}>Second preview</button>
        <button
          onClick={() => document.body.toggleAttribute("data-ds-dark-theme")}
        >
          Theme
        </button>
        <textarea
          aria-label="Composer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{ width: "100%", height: 320 }}
        />
      </div>
      {[0, ...(second ? [1] : [])].map((id) => {
        const props = {
          sessionId: "native-test",
          useTabInfo: tabInfo[id],
          inputActions: {
            captureInsertion: () => ({
              start: draft.length,
              end: draft.length,
              draftRev: 0,
            }),
            insertText: (text: string) => {
              setDraft((s) => s + text);
              return true;
            },
          },
        };
        return (
          <section
            key={id}
            data-preview={id}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <header
              style={{
                height: 38,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 8px",
                background: "var(--dsw-alias-bg-base)",
              }}
            >
              <span>simple-page.html</span>
              <HtmlAction {...props} />
            </header>
            <div style={{ flex: 1, minHeight: 0 }}>
              <NativeHtml
                key={revision}
                {...props}
                content={{ kind: "bytes", data }}
                resourceAddress={address + (id ? ".second" : "")}
                useInteractivePreview={(selector) => selector(interactive)}
                setResources={setResources}
              />
            </div>
          </section>
        );
      })}
    </main>
  );
}
document.body.style.margin = "0";
createRoot(document.getElementById("root")!).render(<Fixture />);
