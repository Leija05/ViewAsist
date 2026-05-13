const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const repoDir = path.resolve(rootDir, '..');
const outDir = path.join(rootDir, 'electron', 'backend-dist');
const workDir = path.join(rootDir, 'electron', '.pyinstaller');

if (process.platform !== 'win32') {
  console.log('[build-backend] Omitido: la compilación del .exe solo se ejecuta en Windows.');
  process.exit(0);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(workDir, { recursive: true });

const python = process.env.ELECTRON_PYTHON_PATH || 'py';
const pythonArgs = process.env.ELECTRON_PYTHON_PATH ? [] : ['-3'];

const check = spawnSync(python, [...pythonArgs, '--version'], { stdio: 'inherit' });
if (check.status !== 0) {
  console.error('[build-backend] No se encontró Python 3.');
  process.exit(check.status || 1);
}

const installPyInstaller = spawnSync(python, [...pythonArgs, '-m', 'pip', 'install', 'pyinstaller'], {
  stdio: 'inherit',
  cwd: repoDir,
});
if (installPyInstaller.status !== 0) {
  process.exit(installPyInstaller.status || 1);
}

const pyinstaller = spawnSync(
  python,
  [
    ...pythonArgs,
    '-m',
    'PyInstaller',
    '--noconfirm',
    '--clean',
    '--onefile',
    '--name',
    'viewasist-backend',
    '--distpath',
    outDir,
    '--workpath',
    workDir,
    '--specpath',
    workDir,
    '--paths',
    repoDir,
    '--hidden-import',
    'uvicorn.logging',
    '--hidden-import',
    'uvicorn.loops.auto',
    '--hidden-import',
    'uvicorn.protocols.http.auto',
    '--hidden-import',
    'uvicorn.protocols.websockets.auto',
    '--hidden-import',
    'uvicorn.lifespan.on',
    '--hidden-import',
    'backend.server',
    path.join(rootDir, 'electron', 'backend-entrypoint.py'),
  ],
  {
    stdio: 'inherit',
    cwd: repoDir,
    env: {
      ...process.env,
      PYTHONPATH: repoDir,
    },
  }
);

process.exit(pyinstaller.status || 0);
