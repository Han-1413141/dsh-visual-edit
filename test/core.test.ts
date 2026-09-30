import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { instrumentSource, visualEdit } from "../src/vite";
import {
  previewUrl,
  sourceLocation,
  validSnapshot,
  createNote,
  feedbackText,
  type Snapshot,
} from "../src/shared/model";
const sample: Snapshot = {
  url: "http://localhost:5173/",
  pageKey: "hash",
  capturedAt: new Date().toISOString(),
  viewport: { width: 1024, height: 640 },
  locator: {
    selector: "#cta",
    tag: "button",
    source: { file: "src/App.tsx", line: 2, column: 1 },
  },
  text: "Click me",
  styles: { color: "black" },
  rect: { x: 0, y: 0, width: 80, height: 20 },
};
test("only separate local development origins are allowed", () => {
  assert.equal(
    previewUrl("http://localhost:5173/a"),
    "http://localhost:5173/a",
  );
  assert.equal(previewUrl("http://[::1]:5173/"), "http://[::1]:5173/");
  for (const url of [
    "https://example.com",
    "http://localhost.example.com",
    "file:///tmp/a",
    "http://u:p@localhost:5173",
  ])
    assert.throws(() => previewUrl(url));
  assert.throws(() =>
    previewUrl("http://localhost:3080/a", "http://localhost:3080"),
  );
});
test("rejects oversized, malformed and absolute source metadata", () => {
  assert(validSnapshot(sample));
  assert(
    !validSnapshot({ ...sample, image: "data:image/svg+xml,<svg></svg>" }),
  );
  assert(!validSnapshot({ ...sample, text: "x".repeat(2001) }));
  assert(
    !validSnapshot({ ...sample, viewport: { width: Infinity, height: 640 } }),
  );
  for (const file of [
    "../secret",
    "C:/secret",
    "/etc/passwd",
    "src/../secret",
    "src\\App.tsx",
  ])
    assert.equal(sourceLocation({ file, line: 1, column: 1 }), undefined);
});
test("JSX instrumentation preserves source lines and only annotates DOM tags", () => {
  const source = 'const x = <Card>\n  <button id="cta">Go</button>\n</Card>;';
  const changed = instrumentSource(
    source,
    resolve("src/App.tsx"),
    process.cwd(),
  )!;
  assert(changed.code.includes("<Card>"));
  assert.equal(changed.code.match(/data-dsh-ve-source/g)?.length, 1);
  assert(changed.code.includes('\\"line\\":2'));
  assert.equal(changed.code.split("\n").length, source.split("\n").length);
  assert.equal(
    instrumentSource(source, resolve("node_modules/a/App.tsx"), process.cwd()),
    undefined,
  );
  assert.equal(
    instrumentSource(source, resolve("../App.tsx"), process.cwd()),
    undefined,
  );
  assert.equal(visualEdit().apply, "serve");
  assert.throws(() => visualEdit({ allowedOrigins: ["*"] }));
  assert.throws(() =>
    visualEdit({ allowedOrigins: ["http://localhost:3080/path"] }),
  );
});
test("agent feedback includes user intent and source, but never snapshot bytes", () => {
  const note = createNote(
    "test",
    { ...sample, image: "data:image/png;base64,YQ==" },
    "  Make this blue  ",
  );
  const text = feedbackText([note]);
  assert.equal(note.comment, "Make this blue");
  assert(text.includes("src/App.tsx"));
  assert(text.includes("Make this blue"));
  assert(!text.includes("base64"));
  assert(!text.includes("pageKey"));
  assert.throws(() => createNote("test", sample, "   "));
});
