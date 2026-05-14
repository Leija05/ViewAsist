const { app, BrowserWindow, dialog, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 8000);
const BACKEND_BASE_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const ICON_FILENAME = 'icon.ico';
let backendProcess = null;
let backendStartupIssue = '';
let backendLogs = [];

function resolveAppIconPath() {
    const candidatePaths = [
        path.join(__dirname, '../assets', ICON_FILENAME),
        path.join(process.resourcesPath || '', 'assets', ICON_FILENAME),
        path.join(process.resourcesPath || '', 'app.asar', 'assets', ICON_FILENAME),
        path.join(__dirname, '../build', ICON_FILENAME),
    ];

    return candidatePaths.find((candidatePath) => candidatePath && fs.existsSync(candidatePath)) || null;
}

function appendBackendLog(message) {
    backendLogs.push(message);
    if (backendLogs.length > 25) {
        backendLogs = backendLogs.slice(-25);
    }
}

function resolveBackendExecutablePath() {
    const candidatePaths = [
        path.join(__dirname, '../resources/viewasist-server.exe'),
        path.join(process.resourcesPath || '', 'resources', 'viewasist-server.exe'),
        path.join(process.resourcesPath || '', 'viewasist-server.exe'),
    ];

    return candidatePaths.find((candidatePath) => candidatePath && fs.existsSync(candidatePath)) || candidatePaths[0];
}

function startBackend() {
    const backendExecutablePath = resolveBackendExecutablePath();

    if (!fs.existsSync(backendExecutablePath)) {
        backendStartupIssue = `No existe viewasist-server.exe en: ${backendExecutablePath}`;
        return;
    }

    appendBackendLog(`Iniciando backend desde: ${backendExecutablePath}`);

    backendProcess = spawn(backendExecutablePath, [], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        cwd: path.dirname(backendExecutablePath),
        env: process.env,
    });

    backendProcess.once('error', (error) => {
        backendStartupIssue = `Error al iniciar viewasist-server.exe: ${error?.message || String(error)}`;
        appendBackendLog(backendStartupIssue);
    });

    backendProcess.stdout?.on('data', (data) => {
        appendBackendLog(`[stdout] ${String(data).trim()}`);
    });
    backendProcess.stderr?.on('data', (data) => {
        appendBackendLog(`[stderr] ${String(data).trim()}`);
    });
    backendProcess.on('exit', (code, signal) => {
        appendBackendLog(`Backend finalizó (code=${code}, signal=${signal || 'none'})`);
    });
}

function inspectPort(port) {
    return new Promise((resolve) => {
        const socket = net.createConnection({ host: '127.0.0.1', port, timeout: 1000 }, () => {
            socket.end();
            resolve(true);
        });

        socket.on('error', () => resolve(false));
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
    });
}

async function waitForBackendReady() {
    const maxAttempts = 30;
    const url = `${BACKEND_BASE_URL}/api/health`;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const response = await fetch(url);
            if (response.ok) return true;
        } catch (_) { }

        if (backendProcess && backendProcess.exitCode !== null) return false;
        await sleep(1000);
    }
    return false;
}
function createDriverWindow() {
    const driverWin = new BrowserWindow({
        width: 1280,
        height: 720,
        autoHideMenuBar: true,
        icon: resolveAppIconPath() || undefined,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        },

    });

    driverWin.removeMenu();

    if (isDev) {
        driverWin.loadURL('http://localhost:3000/');
    } else {
        const indexPath = path.join(__dirname, '../build/index.html');
        driverWin.loadFile(indexPath, { hash: '/pantalla-chofer' });
    }
}

ipcMain.on('open-driver-window', () => {
    createDriverWindow();
});
function createWindow() {

    const mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        autoHideMenuBar: true,
        icon: resolveAppIconPath() || undefined,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.removeMenu();

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
    }
}

app.whenReady().then(async () => {
    app.setAppUserModelId('com.viewasist.app');
    const iconPath = resolveAppIconPath();
    if (fs.existsSync(iconPath)) {
        const appIcon = nativeImage.createFromPath(iconPath);
        if (!appIcon.isEmpty()) {
            app.dock?.setIcon(appIcon);
        }
    }

    Menu.setApplicationMenu(null);
    startBackend();

    const ready = await waitForBackendReady();
    createWindow();

    if (!ready) {
        const portBusy = await inspectPort(BACKEND_PORT);
        const diagnostics = [
            backendStartupIssue,
            ...backendLogs.slice(-8),
            `Puerto ${BACKEND_PORT} ${portBusy ? 'en uso por otro proceso' : 'sin respuesta'}.`,
        ].filter(Boolean).join('\n');

        dialog.showMessageBox({
            type: 'warning',
            title: 'Servidor no disponible',
            message: 'El servidor de ViewAsist no respondió a tiempo.',
            detail: diagnostics || 'No se pudo iniciar el backend. Revisa el ejecutable de servidor.',
            buttons: ['Aceptar'],
        });
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (backendProcess && !backendProcess.killed) {
        backendProcess.kill();
    }
});
