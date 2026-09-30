import { test } from "node:test";
import assert from "node:assert/strict";
import { instrumentHtml } from "../src/client/native-html";
import { snapshotUrl, pageLabel } from "../src/shared/model";
import { parseBackup, serializeBackup } from "../src/shared/backup";
import { createNote, type Snapshot } from "../src/shared/model";

test("HTML coordinates refer to original bytes, ignoring implied tags, comments and script text", () => {
  const input =
    '<!-- <button>fake</button> -->\n<script>const x="<h2>ignore</h2>";</script>\n<p>one<p id="two">two\n<BUTTON id="ok">Go</BUTTON>';
  const result = instrumentHtml(
    input,
    "dsh-resource://file/session/test/C:/demo/page.html",
  );
  assert.equal(result.match(/data-dsh-ve-source/g)?.length, 3);
  assert(
    result.includes(
      "file&quot;:&quot;page.html&quot;,&quot;line&quot;:4,&quot;column&quot;:1",
    ),
  );
  assert(result.includes('<script>const x="<h2>ignore</h2>";</script>'));
  assert.equal(result.replace(/ data-dsh-ve-source="[^"]*"/g, ""), input);
});

test("native page references survive backup without granting file access or retaining URL secrets", () => {
  const url =
    "dsh-resource://file/session/test/C:/demo/%E7%BD%91%E9%A1%B5.html";
  assert.equal(pageLabel(url), "C:/demo/网页.html");
  assert.equal(
    snapshotUrl("https://example.com/page?token=secret#private"),
    "https://example.com/page",
  );
  assert.equal(snapshotUrl(url + "?token=secret#private"), url);
  for (const bad of [
    "file:///C:/secret",
    "javascript:alert(1)",
    "dsh-resource://other/session/test/a",
    "dsh-resource://file/session/test/",
    "https://u:p@example.com/",
  ])
    assert.throws(() => snapshotUrl(bad));
  const sample: Snapshot = {
    url,
    pageKey: "a".repeat(64),
    capturedAt: new Date().toISOString(),
    viewport: { width: 600, height: 700 },
    locator: { selector: "#a", tag: "button" },
    text: "Go",
    styles: {},
    rect: { x: 0, y: 0, width: 30, height: 20 },
  };
  const note = createNote("test", sample, "Widen this button.");
  assert.equal(parseBackup(serializeBackup([note])).notes[0].before.url, url);
});
