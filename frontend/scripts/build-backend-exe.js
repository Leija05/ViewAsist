const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..', '..');
const backendDir = path.join(repoRoot, 'backend');
const outputDir = path.join(backendDir, 'dist');
const exePath = path.join(outputDir, 'server.exe');

fs.mkdirSync(outputDir, { recursive: true });

const cmd = process.platform === 'win32' ? 'pyinstaller.exe' : 'pyinstaller';
const args = [
  '--noconfirm',
  '--clean',
  '--onefile',
  '--name',
  'server',
  '--distpath',
  outputDir,
  '--workpath',
  path.join(backendDir, 'build'),
  '--specpath',
  backendDir,
  path.join(backendDir, 'server_entry.py'),
];

const result = spawnSync(cmd, args, {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(`Error ejecutando ${cmd}: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status || 1);
}

if (!fs.existsSync(exePath)) {
  console.error(`No se generó el ejecutable esperado: ${exePath}`);
  process.exit(1);
}

console.log(`Backend ejecutable generado: ${exePath}`);
