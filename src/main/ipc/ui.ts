import { app, type BrowserWindow } from 'electron'
import Store from 'electron-store'
import { safeHandle } from './safe-handle'
import { checkForUpdatesInteractive } from '@main/services/auto-updater'

interface UiSettings {
  menuBarVisible?: boolean
}

const uiStore = new Store<UiSettings>({
  defaults: { menuBarVisible: false }
})

export function getMenuBarVisible(): boolean {
  return uiStore.get('menuBarVisible', false)
}

export function setMenuBarVisible(visible: boolean): boolean {
  uiStore.set('menuBarVisible', visible)
  return visible
}

// The menu bar is rendered by the React app (so it inherits the app theme).
// The native menu bar stays auto-hidden in every window so it never doubles
// up; Alt still surfaces it, which also keeps its accelerators working.
export function hideNativeMenuBar(windows: ReadonlySet<BrowserWindow>): void {
  for (const win of windows) {
    if (win.isDestroyed()) continue
    win.setAutoHideMenuBar(true)
    win.setMenuBarVisibility(false)
  }
}

function activeWindow(windows: ReadonlySet<BrowserWindow>): BrowserWindow | null {
  const focused = [...windows].find((w) => !w.isDestroyed() && w.isFocused())
  const last = [...windows].at(-1)
  return focused ?? (last && !last.isDestroyed() ? last : null)
}

function handleNativeAction(role: string, windows: ReadonlySet<BrowserWindow>): void {
  const win = activeWindow(windows)
  if (!win) return
  const wc = win.webContents

  switch (role) {
    case 'undo':
      wc.undo()
      break
    case 'redo':
      wc.redo()
      break
    case 'cut':
      wc.cut()
      break
    case 'copy':
      wc.copy()
      break
    case 'paste':
      wc.paste()
      break
    case 'select-all':
      wc.selectAll()
      break
    case 'reload':
      wc.reload()
      break
    case 'force-reload':
      wc.reloadIgnoringCache()
      break
    case 'devtools':
      wc.toggleDevTools()
      break
    case 'zoom-in':
      wc.setZoomLevel(wc.getZoomLevel() + 0.5)
      break
    case 'zoom-out':
      wc.setZoomLevel(wc.getZoomLevel() - 0.5)
      break
    case 'zoom-reset':
      wc.setZoomLevel(0)
      break
    case 'fullscreen':
      win.setFullScreen(!win.isFullScreen())
      break
    case 'minimize':
      win.minimize()
      break
    case 'maximize':
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
      break
    case 'quit':
      app.quit()
      break
    case 'check-updates':
      void checkForUpdatesInteractive()
      break
  }
}

export function registerUiHandlers(getWindows: () => ReadonlySet<BrowserWindow>): void {
  safeHandle('ui:menu-bar-visible', () => getMenuBarVisible())
  safeHandle('ui:set-menu-bar-visible', (_event, visible: boolean) => setMenuBarVisible(visible))

  safeHandle('menu:trigger', (_event, action: string) => {
    if (action.startsWith('native:')) {
      handleNativeAction(action.slice('native:'.length), getWindows())
    } else {
      const wc = activeWindow(getWindows())?.webContents
      if (wc && !wc.isDestroyed()) wc.send('menu:action', action)
    }
  })
}
