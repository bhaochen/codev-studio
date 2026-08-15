import { app, BrowserWindow, Menu, session, shell, systemPreferences, dialog, nativeTheme } from 'electron'
import path from 'path'
import { registerProjectHandlers } from '@main/ipc/projects'
import { registerFilesystemHandlers } from '@main/ipc/filesystem'
import { registerTerminalHandlers } from '@main/ipc/terminal'
import { registerClipboardHandlers } from '@main/ipc/clipboard'
import { registerGitHandlers } from '@main/ipc/git'
import { registerCodevConfigHandlers } from '@main/ipc/codev-config'
import { registerCodevExplainHandlers } from '@main/ipc/codev-explain'
import { registerCodevSessionsHandlers } from '@main/ipc/codev-sessions'
import { registerSkillsHandlers } from '@main/ipc/skills'
import { registerMcpHandlers } from '@main/ipc/mcp'
import { registerActivityHandlers } from '@main/ipc/activity'
import { registerTokenUsageHandlers } from '@main/ipc/token-usage'
import { registerDevServerHandlers } from '@main/ipc/dev-servers'
import { registerTsProjectHandlers } from '@main/ipc/ts-project'
import { killAll, killOrphanedPtys } from '@main/services/pty-manager'
import { compactActivity, flushActivity } from '@main/services/activity-service'
import { compactTokenUsage, flushTokenUsage } from '@main/services/token-usage-service'
import { stopWatching } from '@main/services/file-watcher'
import { registerUpdaterHandlers } from '@main/ipc/updater'
import { registerUiHandlers, hideNativeMenuBar } from '@main/ipc/ui'
import { initAutoUpdater, checkForUpdates, checkForUpdatesInteractive } from '@main/services/auto-updater'
import { startClipboardWatcher, stopClipboardWatcher } from '@main/services/clipboard-watcher'
import { stopAutoFetch } from '@main/services/git-fetch-service'
import { stopAllRefsWatchers } from '@main/services/git-refs-watcher'

app.setName('Codev Studio')

// Force native UI (menu bar, context menus) to use the dark theme so it
// matches the app's dark zinc theme instead of whatever the desktop defaults to.
nativeTheme.themeSource = 'dark'

// Enable Linux IME (fcitx5/IBus) on Wayland for the in-app terminal. These
// must be set before any BrowserWindow is created. The dev script also
// passes them via the CLI for `npm run dev`; setting them here covers
// packaged builds where the npm script no longer applies.
//
// Users can also drop these flags into ~/.config/electron-flags.conf
// (one per line) so any Electron-based app on their system picks them up.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform')
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
  app.commandLine.appendSwitch('enable-wayland-ime')
  app.commandLine.appendSwitch('wayland-text-input-version', '3')
  if (!process.env.GTK_IM_MODULE) process.env.GTK_IM_MODULE = 'fcitx'
}
app.setAboutPanelOptions({
  applicationName: 'Codev Studio',
  applicationVersion: app.getVersion(),
  version: '',
  copyright: '© 2026 Jo Vinkenroye',
  credits: 'A desktop vibe coding environment for Codev developers.\nTerminal, editor, and git — all in one window.',
  iconPath: path.join(__dirname, '../../resources/icon.png')
})

// All open windows. The app uses a single-instance lock (see below) but can
// host several windows, opened via the "New Window" desktop action which
// passes --new-window on the command line.
const windows = new Set<BrowserWindow>()

// Single-instance lock (VS Code style): a second launch forwards its argv to
// the running instance instead of starting another process. --new-window from
// the desktop action asks the running instance to open an extra window.
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

app.on('second-instance', (_event, argv) => {
  if (argv.includes('--new-window')) {
    createWindow()
    return
  }
  // Plain launch (desktop icon, file manager): focus an existing window.
  const first = [...windows][0]
  if (first) {
    if (first.isMinimized()) first.restore()
    first.focus()
  } else {
    createWindow()
  }
})

process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason)
})

app.on('render-process-gone', (_event, webContents, details) => {
  console.error('[main] render-process-gone:', details.reason, details.exitCode)
  if (details.reason === 'crashed' || details.reason === 'oom') {
    const win = [...windows].find((w) => !w.isDestroyed() && w.webContents === webContents)
    if (win) {
      const choice = dialog.showMessageBoxSync(win, {
        type: 'error',
        title: 'Codev Studio',
        message: 'The window crashed.',
        detail: `Reason: ${details.reason}. Reload to recover?`,
        buttons: ['Reload', 'Quit'],
        defaultId: 0,
        cancelId: 1
      })
      if (choice === 0) win.reload()
      else app.quit()
    }
  }
})

app.on('child-process-gone', (_event, details) => {
  console.error('[main] child-process-gone:', details.type, details.reason)
})

function activeWebContents(): Electron.WebContents | null {
  for (const win of windows) {
    if (!win.isDestroyed() && win.isFocused()) return win.webContents
  }
  const last = [...windows].at(-1)
  if (last && !last.isDestroyed()) return last.webContents
  return null
}

function handleBeforeInput(_event: Electron.Event, input: Electron.Input): void {
  if (input.type !== 'keyDown') return

  const digit = /^Digit([1-9])$/.exec(input.code)
  if (input.meta && input.alt && digit) {
    _event.preventDefault()
    activeWebContents()?.send('menu:action', `switch-project-${digit[1]}`)
    return
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#09090b',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  windows.add(win)

  win.webContents.on('before-input-event', handleBeforeInput)

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const appOrigin = process.env.ELECTRON_RENDERER_URL ?? 'file://'
    if (url.startsWith(appOrigin)) return
    event.preventDefault()
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  win.on('closed', () => {
    windows.delete(win)
  })

  startClipboardWatcher(win)
  hideNativeMenuBar(windows)
}

registerProjectHandlers()
registerFilesystemHandlers()
registerTerminalHandlers()
registerClipboardHandlers()
registerGitHandlers()
registerCodevConfigHandlers()
registerCodevExplainHandlers()
registerCodevSessionsHandlers()
registerSkillsHandlers()
registerMcpHandlers()
registerUpdaterHandlers()
registerActivityHandlers()
registerTokenUsageHandlers()
registerDevServerHandlers()
registerTsProjectHandlers()
registerUiHandlers(() => windows)

function buildMenu(): Electron.MenuItemConstructorOptions[] {
  const isMac = process.platform === 'darwin'

  const appMenu: Electron.MenuItemConstructorOptions = {
    label: 'Codev Studio',
    submenu: [
      { role: 'about', label: 'About Codev Studio' },
      { type: 'separator' },
      {
        label: 'Settings...',
        accelerator: 'CmdOrCtrl+,',
        click: () => activeWebContents()?.send('menu:action', 'settings')
      },
      {
        label: 'Check for Updates...',
        click: () => checkForUpdatesInteractive()
      },
      { type: 'separator' },
      { role: 'hide', label: 'Hide Codev Studio' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit', label: 'Quit Codev Studio' }
    ]
  }

  const send = (action: string): void => {
    const wc = activeWebContents()
    if (wc && !wc.isDestroyed()) wc.send('menu:action', action)
  }

  const fileMenu: Electron.MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      {
        label: 'New Project',
        accelerator: 'CmdOrCtrl+N',
        click: () => send('new-project')
      },
      {
        label: 'Close Project',
        accelerator: 'CmdOrCtrl+W',
        click: () => send('close-project')
      },
      { type: 'separator' },
      {
        label: 'Open File...',
        accelerator: 'CmdOrCtrl+P',
        click: () => send('open-palette-files')
      },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: () => send('save-file')
      },
      {
        label: 'Close File',
        accelerator: 'CmdOrCtrl+Alt+W',
        click: () => send('close-file-tab')
      }
    ]
  }

  const editMenu: Electron.MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
      { type: 'separator' },
      {
        label: 'Command Palette',
        accelerator: 'CmdOrCtrl+K',
        click: () => send('open-palette')
      }
    ]
  }

  const viewMenu: Electron.MenuItemConstructorOptions = {
    label: 'View',
    submenu: [
      {
        label: 'Dashboard',
        click: () => send('toggle-dashboard')
      },
      {
        label: 'Statistics',
        click: () => send('show-statistics')
      },
      {
        label: 'Usage',
        click: () => send('show-usage')
      },
      { type: 'separator' },
      {
        label: 'Editor',
        accelerator: 'CmdOrCtrl+1',
        click: () => send('center-tab-editor')
      },
      {
        label: 'Codev Config',
        accelerator: 'CmdOrCtrl+2',
        click: () => send('center-tab-codev')
      },
      {
        label: 'Skills',
        accelerator: 'CmdOrCtrl+3',
        click: () => send('center-tab-skills')
      },
      {
        label: 'Terminals',
        accelerator: 'CmdOrCtrl+4',
        click: () => send('center-tab-terminals')
      },
      { type: 'separator' },
      {
        label: 'Toggle Light/Dark',
        accelerator: 'CmdOrCtrl+Shift+L',
        click: () => send('toggle-variant')
      },
      { type: 'separator' },
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: () => activeWebContents()?.reload()
      },
      {
        label: 'Force Reload',
        accelerator: 'CmdOrCtrl+Shift+R',
        click: () => activeWebContents()?.reloadIgnoringCache()
      },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      {
        label: 'Actual Size',
        accelerator: 'CmdOrCtrl+0',
        click: () => activeWebContents()?.setZoomLevel(0)
      },
      {
        label: 'Zoom In',
        accelerator: 'CmdOrCtrl+=',
        click: () => {
          const wc = activeWebContents()
          if (wc) wc.setZoomLevel(wc.getZoomLevel() + 0.5)
        }
      },
      {
        label: 'Zoom Out',
        accelerator: 'CmdOrCtrl+-',
        click: () => {
          const wc = activeWebContents()
          if (wc) wc.setZoomLevel(wc.getZoomLevel() - 0.5)
        }
      },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }

  const terminalMenu: Electron.MenuItemConstructorOptions = {
    label: 'Terminal',
    submenu: [
      {
        label: 'New Codev Terminal',
        click: () => send('new-codev-terminal')
      },
      {
        label: 'New Shell Terminal',
        click: () => send('new-shell-terminal')
      },
      { type: 'separator' },
      {
        label: 'Next Tab',
        accelerator: 'CmdOrCtrl+Shift+]',
        click: () => send('terminal-tab-next')
      },
      {
        label: 'Previous Tab',
        accelerator: 'CmdOrCtrl+Shift+[',
        click: () => send('terminal-tab-prev')
      },
      { type: 'separator' },
      {
        label: 'Restart Codev',
        click: () => send('restart-codev')
      },
      {
        label: 'Clear Context',
        click: () => send('clear-context')
      }
    ]
  }

  const gitMenu: Electron.MenuItemConstructorOptions = {
    label: 'Git',
    submenu: [
      {
        label: 'Pull & Rebase',
        click: () => send('git-pull-rebase')
      },
      { type: 'separator' },
      {
        label: 'Commit',
        click: () => send('git-commit')
      }
    ]
  }

  const windowMenu: Electron.MenuItemConstructorOptions = {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ]
  }

  return [
    ...(isMac ? [appMenu] : []),
    fileMenu,
    editMenu,
    viewMenu,
    terminalMenu,
    gitMenu,
    windowMenu
  ]
}

app.whenReady().then(() => {
  if (!gotTheLock) return
  killOrphanedPtys()
  compactActivity()
  compactTokenUsage()

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media') {
      callback(true)
      return
    }
    callback(false)
  })

  if (process.platform === 'darwin') {
    systemPreferences.askForMediaAccess('microphone').catch(() => {})
  }

  createWindow()
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenu()))

  initAutoUpdater()
  if (!process.env.ELECTRON_RENDERER_URL) {
    setTimeout(() => checkForUpdates(), 5000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  killAll()
  stopWatching()
  stopClipboardWatcher()
  stopAutoFetch()
  stopAllRefsWatchers()
  flushActivity()
  flushTokenUsage()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  killAll()
  stopWatching()
  stopClipboardWatcher()
  stopAutoFetch()
  stopAllRefsWatchers()
  flushActivity()
  flushTokenUsage()
})
