import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const input = process.argv[2];
const frameArgument = process.argv.find((value) => value.startsWith("--frame="));
if (!input) {
  console.error("Usage: bun run inspect:video <video.webm> [--frame=N]");
  process.exit(1);
}
const video = resolve(input);
const output = resolve(dirname(video), `${basename(video, ".webm")}-inspection`);
await mkdir(output, { recursive: true });

async function run(command: string[]) {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(child.stdout).text();
  const stderr = await new Response(child.stderr).text();
  const exit = await child.exited;
  if (exit !== 0) throw new Error(`${command[0]} exited ${exit}: ${stderr}`);
  return stdout;
}

const probe = JSON.parse(
  await run([
    "ffprobe",
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_frames",
    "-show_entries",
    "frame=best_effort_timestamp_time,pkt_duration_time",
    "-of",
    "json",
    video,
  ]),
) as { frames: Array<{ best_effort_timestamp_time?: string; pkt_duration_time?: string }> };
const frames = probe.frames.map((frame, index) => ({
  index,
  videoTimeSeconds: Number(frame.best_effort_timestamp_time ?? 0),
  durationSeconds: Number(frame.pkt_duration_time ?? 0),
}));
await writeFile(
  resolve(output, "frames.json"),
  JSON.stringify({ video, frameCount: frames.length, frames }, null, 2),
);
if (frameArgument) {
  const index = Number(frameArgument.split("=")[1]);
  if (!Number.isInteger(index) || index < 0 || index >= frames.length)
    throw new Error(`Frame must be 0–${frames.length - 1}`);
  const path = resolve(output, `frame-${String(index).padStart(4, "0")}.png`);
  await run([
    "ffmpeg",
    "-y",
    "-v",
    "error",
    "-i",
    video,
    "-vf",
    `select=eq(n\\,${index})`,
    "-frames:v",
    "1",
    path,
  ]);
  await writeFile(
    resolve(output, "frames.json"),
    JSON.stringify({ video, frameCount: frames.length, frames }, null, 2),
  );
  console.log(`${path} at ${frames[index]!.videoTimeSeconds}s`);
} else {
  for (const name of await readdir(output)) {
    if (/^contact-\d{3}\.jpg$/.test(name)) await Bun.file(resolve(output, name)).delete();
  }
  const pattern = resolve(output, "contact-%03d.jpg");
  await run([
    "ffmpeg",
    "-y",
    "-v",
    "error",
    "-i",
    video,
    "-vf",
    "scale=240:-2,drawtext=text='%{n}':x=3:y=3:fontsize=12:fontcolor=white:box=1:boxcolor=black@0.8,tile=8x10",
    "-fps_mode",
    "vfr",
    pattern,
  ]);
  const sheets = (await readdir(output)).filter((name) => /^contact-\d{3}\.jpg$/.test(name)).sort();
  if (sheets[0]) await copyFile(resolve(output, sheets[0]), resolve(output, "contact-sheet.jpg"));
  await writeFile(
    resolve(output, "frames.json"),
    JSON.stringify(
      {
        video,
        frameCount: frames.length,
        contactSheets: sheets.map((name, index) => ({
          file: name,
          firstFrame: index * 80,
          lastFrame: Math.min(frames.length - 1, index * 80 + 79),
        })),
        frames,
      },
      null,
      2,
    ),
  );
  console.log(
    `${output}: ${frames.length} frames across ${sheets.length} numbered contact sheet(s)`,
  );
}
