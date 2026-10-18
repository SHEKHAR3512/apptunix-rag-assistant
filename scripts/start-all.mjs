#!/usr/bin/env node

/**
 * Apptunix Knowledge Desk — Unified Startup Orchestrator
 *
 * Starts and connects all required services with a single command:
 * 1. Ollama local LLM server (gemma3:4b + embeddinggemma, D:\Ollama\models)
 * 2. Backend FastAPI service (127.0.0.1:8000)
 * 3. Frontend Vite application (127.0.0.1:5173)
 * 4. Automatically opens the browser
 * 5. Handles clean teardown on Ctrl+C (no zombie processes)
 */

import { spawn, execSync, exec } from "node:child_process";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const BACKEND_DIR = path.join(ROOT, "backend");
const FRONTEND_DIR = path.join(ROOT, "frontend");

// Enforce required local environment variables
process.env.OLLAMA_MODELS = process.env.OLLAMA_MODELS || "D:\\Ollama\\models";
process.env.OLLAMA_NO_CLOUD = "1";

const spawnedProcesses = [];
let isShuttingDown = false;

// ANSI Colors for readable logging
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

function log(prefix, color, message) {
  const p = `${color}${colors.bold}[${prefix}]${colors.reset}`;
  console.log(`${p} ${message}`);
}

function checkHttp(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname + u.search,
          method: "GET",
          timeout: timeoutMs,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, data });
          });
        }
      );
      req.on("error", () => resolve({ ok: false }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false });
      });
      req.end();
    } catch {
      resolve({ ok: false });
    }
  });
}

async function waitForHttp(url, name, maxRetries = 30, intervalMs = 500) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await checkHttp(url);
    if (res.ok) return res;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${name} at ${url}`);
}

function killTree(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGTERM");
    }
  } catch {
    // Process already exited
  }
}

function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${colors.yellow}Shutting down Apptunix Knowledge Desk services...${colors.reset}`);
  for (const proc of spawnedProcesses) {
    if (proc && proc.pid) {
      log("Shutdown", colors.yellow, `Stopping process ${proc.pid} (${proc.name})...`);
      killTree(proc.pid);
    }
  }
  console.log(`${colors.green}All services stopped cleanly. Goodbye!${colors.reset}\n`);
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", () => {
  if (!isShuttingDown) {
    for (const proc of spawnedProcesses) {
      if (proc && proc.pid) killTree(proc.pid);
    }
  }
});

function openBrowser(url) {
  if (process.argv.includes("--no-open")) return;
  try {
    if (process.platform === "win32") {
      exec(`start "" "${url}"`);
    } else if (process.platform === "darwin") {
      exec(`open "${url}"`);
    } else {
      exec(`xdg-open "${url}"`);
    }
  } catch {
    // Non-fatal if browser cannot be launched automatically
  }
}

async function startOllama() {
  log("Ollama", colors.cyan, "Checking local Ollama service...");
  const ping = await checkHttp("http://127.0.0.1:11434/api/tags");
  if (ping.ok) {
    log("Ollama", colors.green, "Ollama server is active and running.");
  } else {
    log("Ollama", colors.yellow, "Ollama is not running. Starting local Ollama server...");
    const winOllama = path.join(
      process.env.LOCALAPPDATA || "",
      "Programs",
      "Ollama",
      "ollama.exe"
    );
    const ollamaCmd = fs.existsSync(winOllama) ? winOllama : "ollama";

    const proc = spawn(ollamaCmd, ["serve"], {
      env: {
        ...process.env,
        OLLAMA_MODELS: process.env.OLLAMA_MODELS,
        OLLAMA_NO_CLOUD: "1",
      },
      stdio: "ignore",
      detached: false,
    });
    proc.name = "ollama";
    spawnedProcesses.push(proc);

    await waitForHttp("http://127.0.0.1:11434/api/tags", "Ollama server", 20);
    log("Ollama", colors.green, "Ollama started successfully.");
  }

  // Verify models
  try {
    const res = await checkHttp("http://127.0.0.1:11434/api/tags");
    if (res.ok) {
      const parsed = JSON.parse(res.data);
      const names = (parsed.models || []).map((m) => m.name);
      log("Ollama", colors.gray, `Storage directory: ${process.env.OLLAMA_MODELS}`);
      log("Ollama", colors.gray, `Loaded models: ${names.join(", ") || "none"}`);
    }
  } catch {
    // Non-fatal
  }
}

async function startBackend() {
  log("Backend", colors.blue, "Checking backend API on http://127.0.0.1:8000...");
  const ping = await checkHttp("http://127.0.0.1:8000/api/health");
  if (ping.ok) {
    log("Backend", colors.green, "FastAPI backend is already running on http://127.0.0.1:8000.");
    return;
  }

  log("Backend", colors.blue, "Starting FastAPI server...");
  const isWin = process.platform === "win32";
  const pythonPath = isWin
    ? path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe")
    : path.join(BACKEND_DIR, ".venv", "bin", "python");

  if (!fs.existsSync(pythonPath)) {
    throw new Error(
      `Python virtual environment not found at ${pythonPath}. Please run: cd backend && python -m venv .venv && pip install -r requirements.lock.txt`
    );
  }

  const proc = spawn(
    pythonPath,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
      },
      stdio: "pipe",
    }
  );
  proc.name = "backend";
  spawnedProcesses.push(proc);

  proc.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    if (text.includes("Application startup complete") || text.includes("Uvicorn running")) {
      log("Backend", colors.gray, text.trim());
    }
  });

  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    if (text.includes("ERROR") || text.includes("Traceback")) {
      log("Backend", colors.red, text.trim());
    }
  });

  await waitForHttp("http://127.0.0.1:8000/api/health", "Backend API", 25);
  log("Backend", colors.green, "FastAPI backend is healthy and ready.");
}

async function startFrontend() {
  log("Frontend", colors.cyan, "Checking frontend on http://127.0.0.1:5173...");
  const ping = await checkHttp("http://127.0.0.1:5173");
  if (ping.ok) {
    log("Frontend", colors.green, "Vite frontend is already running on http://127.0.0.1:5173.");
    return;
  }

  log("Frontend", colors.cyan, "Starting Vite development server...");
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

  const proc = spawn(npmCmd, ["run", "dev"], {
    cwd: FRONTEND_DIR,
    env: { ...process.env },
    stdio: "pipe",
  });
  proc.name = "frontend";
  spawnedProcesses.push(proc);

  proc.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    if (text.includes("Local:") || text.includes("ready in")) {
      log("Frontend", colors.gray, text.trim());
    }
  });

  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    if (text.includes("error") || text.includes("Error")) {
      log("Frontend", colors.red, text.trim());
    }
  });

  await waitForHttp("http://127.0.0.1:5173", "Frontend Vite", 25);
  log("Frontend", colors.green, "Vite dev server is ready.");
}

async function main() {
  console.log(`
${colors.bold}${colors.cyan}====================================================
   Apptunix Knowledge Desk — Offline RAG Assistant
====================================================${colors.reset}
`);

  try {
    await startOllama();
    await startBackend();
    await startFrontend();

    const appUrl = "http://127.0.0.1:5173";
    const prodUrl = "http://127.0.0.1:8000";

    console.log(`
${colors.bold}${colors.green}✔ All systems connected and operational!${colors.reset}

  ${colors.bold}• Web Application (Vite Dev):${colors.reset}  ${colors.cyan}${appUrl}${colors.reset}
  ${colors.bold}• Web Application (FastAPI):${colors.reset}   ${colors.cyan}${prodUrl}${colors.reset}
  ${colors.bold}• Backend Health API:${colors.reset}          ${colors.gray}${prodUrl}/api/health${colors.reset}
  ${colors.bold}• Local Ollama Server:${colors.reset}         ${colors.gray}http://127.0.0.1:11434${colors.reset}
  ${colors.bold}• Model Directory:${colors.reset}             ${colors.gray}${process.env.OLLAMA_MODELS}${colors.reset}

${colors.gray}Opening browser at ${appUrl}...${colors.reset}
${colors.bold}Press Ctrl+C to stop all services.${colors.reset}
`);

    openBrowser(appUrl);
    // Keep process alive to handle Ctrl+C cleanup
    setInterval(() => {}, 1000 * 60 * 60);
  } catch (err) {
    console.error(`\n${colors.red}${colors.bold}Startup error:${colors.reset} ${err.message}`);
    cleanup();
  }
}

main();
