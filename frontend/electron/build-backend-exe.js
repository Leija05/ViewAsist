const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const backendDir = path.join(repoRoot, 'backend');
const entryPoint = path.join(backendDir, 'run_server.py');
const distDir = path.join(backendDir, 'dist');
const buildDir = path.join(backendDir, 'build');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.error) {
    return { ok: false, error: result.error };
  }

  return { ok: result.status === 0, status: result.status };
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

function ensureCleanDirs() {
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });
}

function buildWithPython(pythonCmd, pythonArgs) {
  console.log(`\n[build-backend-exe] Usando Python: ${pythonCmd} ${pythonArgs.join(' ')}`);

  const install = run(pythonCmd, [...pythonArgs, '-m', 'pip', 'install', 'pyinstaller']);
  if (!install.ok) {
    console.error('[build-backend-exe] No se pudo instalar/verificar pyinstaller.');
    return false;
  }

  const build = run(pythonCmd, [
    ...pythonArgs,
    '-m',
    'PyInstaller',
    '--onefile',
    '--name',
    'server',
    '--distpath',
    distDir,
    '--workpath',
    buildDir,
    '--specpath',
    backendDir,
    '--noconsole',
    '--paths',
    backendDir,
    entryPoint,
  ]);

  if (!build.ok) {
    console.error('[build-backend-exe] PyInstaller falló.');
    return false;
  }

  return true;
}

function main() {
  ensureCleanDirs();

  const pythonCandidates = getPythonCandidates();
  let built = false;

  for (const [pythonCmd, pythonArgs] of pythonCandidates) {
    const ok = buildWithPython(pythonCmd, pythonArgs);
    if (ok) {
      built = true;
      break;
    }
  }

  if (!built) {
    console.error('[build-backend-exe] No se pudo generar backend/dist/server.exe');
    process.exit(1);
  }

  const exePath = path.join(distDir, process.platform === 'win32' ? 'server.exe' : 'server');
  if (!fs.existsSync(exePath)) {
    console.error(`[build-backend-exe] No se encontró ejecutable esperado en ${exePath}`);
    process.exit(1);
  }

  console.log(`[build-backend-exe] Ejecutable generado: ${exePath}`);
}

main();
