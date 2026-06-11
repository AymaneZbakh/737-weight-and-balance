const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Don't show the window until it's ready
    title: "B737 Weight & Balance",
    backgroundColor: '#0f172a', // Match app background to avoid white flash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../public/favicon.ico')
  });

  // In development, load from the Vite dev server
  // In production, load the built index.html
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window only when it's ready to avoid white flashes
  win.once('ready-to-show', () => {
    win.show();
  });

  // Remove default menu
  win.setMenu(null);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
