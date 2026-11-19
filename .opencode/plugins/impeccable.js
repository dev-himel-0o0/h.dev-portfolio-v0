import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Plugin } from "@opencode/plugin";

const HOOK_REL = [".agents", "skills", "impeccable", "scripts", "hook.mjs"];

// OpenCode runs as a Bun standalone binary, so process.execPath points at the
// OpenCode executable rather than a JavaScript runtime. The Impeccable hook is
// a Node script, so invoke Node explicitly (override with IMPECCABLE_NODE).
const NODE_BIN = process.env.IMPECCABLE_NODE || "node";

function resolveFilePath(input, cwd) {
  if (!input || typeof input !== "object") return null;
  const first =
    input.filePath || input.path || input.absolutePath || input.file_path || null;
  if (typeof first !== "string" || !first) return null;
  return path.isAbsolute(first) ? first : path.resolve(cwd, first);
}

function parseEnvelope(stdout) {
  const raw = (stdout || "").toString().trim();
  if (!raw) return "";
  try {
    const json = JSON.parse(raw);
    return (
      json?.hookSpecificOutput?.additionalContext ||
      json?.additionalContext ||
      ""
    );
  } catch {
    return raw;
  }
}

function runHook(hookEntry, cwd, event) {
  const res = spawnSync(NODE_BIN, [hookEntry], {
    input: JSON.stringify(event),
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (res.error) return "";
  return (res.stdout || "").toString();
}

function appendContext(result, context) {
  if (!result || !context) return;

  if (typeof result.content === "string") {
    result.content = `${result.content}\n\n${context}`.trim();
    return;
  }
  if (Array.isArray(result.content)) {
    result.content = [...result.content, { type: "text", text: context }];
    return;
  }
  if (typeof result.output === "string") {
    result.output = `${result.output}\n\n${context}`.trim();
    return;
  }
  result.content = [{ type: "text", text: context }];
}

export default Plugin.define({
  id: "impeccable",
  async setup(ctx) {
    const directory = ctx.location.directory;
    const hookEntry = path.join(directory, ...HOOK_REL);
    if (!fs.existsSync(hookEntry)) return;

    let lastSessionID;

    await ctx.tool.hook("execute.after", (event) => {
      lastSessionID = event.sessionID;

      if (event.status !== "completed") return;

      const filePath = resolveFilePath(event.input, directory);
      if (!filePath) return;

      const context = parseEnvelope(
        runHook(hookEntry, directory, {
          hook_event_name: "PostToolUse",
          session_id: event.sessionID,
          cwd: directory,
          tool_name: String(event.tool || "").toLowerCase(),
          tool_input: { ...(event.input || {}), file_path: filePath },
        }),
      );

      if (context) appendContext(event.result, context);
    });

    const controller = new AbortController();
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({
          types: ["session.idle"],
          signal: controller.signal,
        })) {
          const sessionID = event.data.sessionID || lastSessionID;
          if (!sessionID) continue;

          const context = parseEnvelope(
            runHook(hookEntry, directory, {
              hook_event_name: "Stop",
              session_id: sessionID,
              cwd: directory,
            }),
          );
          if (context) console.log(`[impeccable] ${context}`);
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("[impeccable] event subscription failed", error);
        }
      }
    })();

    return () => controller.abort();
  },
});
