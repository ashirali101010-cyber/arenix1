import { access, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const target = new URL("../.env", import.meta.url);
try {
  await access(target);
  console.log(".env already exists; preserved without changes.");
} catch {
  const template = await readFile(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );
  await writeFile(
    target,
    template.replace(
      "replace-with-at-least-32-random-characters",
      randomBytes(48).toString("hex"),
    ),
    { flag: "wx" },
  );
  console.log(
    "Created .env with a random session secret. Secret values are not printed.",
  );
}
