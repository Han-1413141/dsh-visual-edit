import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
async function inspect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, item.name);
    if (item.isDirectory()) await inspect(file);
    else if (/\.(html|js|css)$/.test(file)) {
      const text = await readFile(file, "utf8");
      for (const marker of [
        "data-dsh-ve-source",
        "dsh-visual-edit/v1",
        "/@dsh-visual-edit/inspector.js",
      ]) {
        if (text.includes(marker))
          throw new Error(`Development bridge leaked into ${file}`);
      }
    }
  }
}
await inspect("demo/dist");
console.log(
  "Production demo contains no Visual Edit bridge or source markers.",
);
