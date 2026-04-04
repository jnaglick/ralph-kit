import fs from "node:fs";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function timestampNow() {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}_${hh}${mm}${ss}`;
}

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

function normalizeOutputLine(line) {
  return stripAnsi(line).trim();
}

function signalProcessTree(child, signal, useProcessGroup) {
  if (!child || typeof child.pid !== "number" || child.pid <= 0) {
    return;
  }

  if (useProcessGroup) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall through to direct child signal.
    }
  }

  try {
    child.kill(signal);
  } catch {
    // Ignore process already exited / signal errors.
  }
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`Setup error: ${label} not found: ${filePath}`);
  }
}

function ensureDirectory(dirPath, label) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    fail(`Setup error: ${label} does not exist: ${dirPath}`);
  }
}

export {
  ensureDirectory,
  ensureFile,
  fail,
  normalizeOutputLine,
  signalProcessTree,
  stripAnsi,
  timestampNow
};
