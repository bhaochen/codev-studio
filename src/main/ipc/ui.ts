import { type BrowserWindow } from 'electron'
import Store from 'electron-store'
import { safeHandle } from './safe-handle'

interface UiSettings {
  menuBarVisible?: boolean
}

const uiStore = new Store<UiSettings>({
  defaults: { menuBarVisible: false }
})

export function getMenuBarVisible(): boolean {
  return uiStore.get('menuBarVisible', false)
}

export function setMenuBarVisible(visible: boolean, windows: ReadonlySet<BrowserWindow>): boolean {
  uiStore.set('menuBarVisible', visible)
  for (const win of windows) {
    if (win.isDestroyed()) continue
    // autoHideMenuBar keeps Alt toggling a hidden bar; setMenuBarVisibility
    // applies the current state (Linux/Windows show the bar inside the window).
    win.setAutoHideMenuBar(!visible)
    win.setMenuBarVisibility(visible)
  }
  return visible
}

export function applyMenuBarVisibility(windows: ReadonlySet<BrowserWindow>): void {
  setMenuBarVisible(getMenuBarVisible(), windows)
}

export function registerUiHandlers(getWindows: () => ReadonlySet<BrowserWindow>): void {
  safeHandle('ui:menu-bar-visible', () => getMenuBarVisible())
  safeHandle('ui:set-menu-bar-visible', (_event, visible: boolean) =>
    setMenuBarVisible(visible, getWindows())
  )
}
