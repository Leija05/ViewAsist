const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 8000);
const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const projectRoot = path.resolve(__dirname, '..', '..');

const isPackaged = app.isPackaged;
let backendProcess = null;
let backendExitInfo = null;
const backendStderrBuffer = [];

function appendBackendStderr(chunk) {
  const text = chunk.toString();
  process.stderr.write(text);

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  backendStderrBuffer.push(...lines);
  if (backendStderrBuffer.length > 60) {
    backendStderrBuffer.splice(0, backendStderrBuffer.length - 60);
  }
}

function getBackendStartupHelp() {
  if (!backendExitInfo) {
    return `No se pudo iniciar/alcanzar el backend en ${BACKEND_URL}.\n\nVerifica que Python y las dependencias del backend estén instaladas y vuelve a intentar.`;
  }

  const moduleMissingLine = backendStderrBuffer.find((line) => line.includes('ModuleNotFoundError:'));
  const missingModuleMatch = moduleMissingLine && moduleMissingLine.match(/No module named '([^']+)'/);

  const processSummary = backendExitInfo.signal
    ? `El backend terminó por señal ${backendExitInfo.signal}.`
    : `El backend terminó con código ${backendExitInfo.code}.`;

  if (missingModuleMatch) {
    return `${processSummary}\n\nFalta el módulo de Python "${missingModuleMatch[1]}".\nInstala dependencias del backend (por ejemplo: pip install -r backend/requirements.txt) y vuelve a intentar.`;
  }

  return `${processSummary}\n\nRevisa la consola para ver el traceback completo del backend y vuelve a intentar.`;
}

function getPythonCandidates() {
  if (process.env.ELECTRON_PYTHON_PATH) {
    return [[process.env.ELECTRON_PYTHON_PATH, []]];
  }

  if (process.platform === 'win32') {
    return [
      ['py', ['-3']],
      ['python', []],
      ['python3', []],
    ];
  }

  return [
    ['python3', []],
    ['python', []],
  ];
}

function isBackendHealthy(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(`${BACKEND_URL}/api/`, { timeout: timeoutMs }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForBackend(maxAttempts = 40, delayMs = 500) {
  for (let i = 0; i < maxAttempts; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await isBackendHealthy();
    if (ok) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

async function spawnBackendProcess(pythonCmd, pythonCmdArgs, backendArgs) {
  backendExitInfo = null;
  backendStderrBuffer.length = 0;

  const child = spawn(pythonCmd, [...pythonCmdArgs, ...backendArgs], {
    cwd: projectRoot,
    env: {
      ...process.env,
      FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });

  if (child.stdout) {
    child.stdout.on('data', (chunk) => process.stdout.write(chunk.toString()));
  }
  if (child.stderr) {
    child.stderr.on('data', appendBackendStderr);
  }
  child.on('exit', (code, signal) => {
    backendExitInfo = { code, signal };
  });

  backendProcess = child;
  return child;
}

function startBackendIfNeeded() {
  return new Promise(async (resolve, reject) => {
    const alreadyRunning = await isBackendHealthy();
    if (alreadyRunning) {
      resolve(false);
      return;
    }

    const backendArgs = ['-m', 'uvicorn', 'backend.server:app', '--host', BACKEND_HOST, '--port', String(BACKEND_PORT)];
    const pythonCandidates = getPythonCandidates();

    for (const [pythonCmd, pythonCmdArgs] of pythonCandidates) {
      try {
        await spawnBackendProcess(pythonCmd, pythonCmdArgs, backendArgs);
        resolve(true);
        return;
      } catch (error) {
        if (error && error.code === 'ENOENT') {
          // Try next candidate.
          // eslint-disable-next-line no-continue
          continue;
        }
        reject(error);
        return;
      }
    }

    const envVarHint = process.env.ELECTRON_PYTHON_PATH
      ? `No se pudo ejecutar ELECTRON_PYTHON_PATH="${process.env.ELECTRON_PYTHON_PATH}".`
      : 'No se encontró una instalación de Python (probado: py -3, python, python3).';
    reject(new Error(`${envVarHint}\nInstala Python 3 y vuelve a intentar.`));
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isPackaged) {
  
    win.loadFile(path.join(__dirname, '../build/index.html'));
  } else {
    win.loadURL(process.env.ELECTRON_START_URL || 'http://localhost:3000');
  }
}

app.whenReady().then(() => {
  (async () => {
    try {
      await startBackendIfNeeded();
      const ready = await waitForBackend();
      if (!ready) {
        dialog.showErrorBox(
          'Backend no disponible',
          getBackendStartupHelp()
        );
      }
      createWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    } catch (error) {
      dialog.showErrorBox('Error iniciando backend', String(error));
      createWindow();
    }
  })();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGTERM');
  }
});
