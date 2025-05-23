const { app, BrowserWindow, shell } = require('electron');
const { ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');

log.initialize();

autoUpdater.autoDownload = false;
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.logger.transports.console.level = 'info';

app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

// Log the app version
log.info('App version:', app.getVersion());

let windows = new Set();

async function createWindow() {
    const mainWindow = new BrowserWindow({
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            contextIsolation: false,
            enablePreferredSizeMode: true,
        },
        minHeight: 500,
        minWidth: 500,
        icon: path.join(__dirname, 'static/icons/icon.png'),
        ...(process.platform !== 'darwin' ? {
            titleBarOverlay: {
                color: '#141414',
                symbolColor: '#eee',
                height: 25
            },
        } : {}),
        show: false,
    });

    mainWindow.setMenu(null);
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
        
    mainWindow.on('closed', () => {
        windows.delete(mainWindow);
    });

    // Listen for "ui-ready" signal from renderer
    ipcMain.once('ui-ready', () => {
        mainWindow.show();
    });

    windows.add(mainWindow);
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    autoUpdater.checkForUpdates();

    autoUpdater.on('update-available', () => {
        const updateAvailable = dialog.showMessageBox({
            type: 'info',
            title: 'Update Available',
            message: 'A new version is available. Do you want to update now?',
            buttons: ['Yes', 'No']
        });

        if (updateAvailable.response === 0) {
            autoUpdater.downloadUpdate();
        }
    });

    autoUpdater.on('update-downloaded', () => {
        log.info('Update downloaded, will install on quit');
        const installUpdate = dialog.showMessageBox({
            type: 'info',
            title: 'Update Ready',
            message: 'The update has been downloaded. Restart the app to apply the update.',
            buttons: ['Restart', 'Later']
        });

        if (installUpdate.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });

    app.whenReady().then(() => {
        createWindow();

        app.on('activate', () => {
            // On macOS it's common to re-create a window in the app when the
            // dock icon is clicked and there are no other windows open.
            if (windows.size === 0) {
                createWindow();
            }
        });
    });

    app.on('second-instance', (event, argv, workingDirectory) => {
        // Someone tried to run a second instance, open a new window in response.
        createWindow();
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
}
