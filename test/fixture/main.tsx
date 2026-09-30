import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { VisualEditPanel } from "../../src/client/panel";
import { en, zh } from "../../src/client/locales";
function Fixture() {
  const [draft, setDraft] = useState("Existing draft.");
  const [session, setSession] = useState("session-one");
  const copy =
    new URLSearchParams(location.search).get("lang") === "zh" ? zh : en;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 620px",
        height: "100vh",
        background: "#eef1f5",
      }}
    >
      <div style={{ padding: 36, fontFamily: "sans-serif" }}>
        <h1>Integration fixture</h1>
        <p>This is a test adapter, not the DSH host.</p>
        <label>
          Session
          <select
            aria-label="Session"
            value={session}
            onChange={(e) => setSession(e.target.value)}
          >
            <option>session-one</option>
            <option>session-two</option>
          </select>
        </label>
        <textarea
          aria-label="Composer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{ width: "100%", height: 400, marginTop: 20 }}
        />
      </div>
      <VisualEditPanel
        sessionId={session}
        t={(key) => copy[key]}
        inputActions={{
          captureInsertion: () => ({
            start: 0,
            end: draft.length,
            draftRev: 0,
          }),
          insertText: (text) => {
            setDraft((value) => text + value);
            return true;
          },
        }}
      />
    </div>
  );
}
document.body.style.margin = "0";
createRoot(document.getElementById("root")!).render(<Fixture />);
