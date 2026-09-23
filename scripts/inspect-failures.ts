import { resolve } from "node:path";

const paths = Array.from(
  new Bun.Glob("test-results/**/video.webm").scanSync({ cwd: process.cwd() }),
);
for (const path of paths) {
  const child = Bun.spawn(["bun", "run", "scripts/inspect-video.ts", path], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(child.stdout).text();
  const stderr = await new Response(child.stderr).text();
  if ((await child.exited) !== 0) throw new Error(`${resolve(path)}: ${stderr}`);
  process.stdout.write(stdout);
}
console.log(`Indexed ${paths.length} failure video(s).`);
