import { useEffect, useRef, useState } from 'react'
import { useAccent } from '@/components/settings/SettingsControls'
import { cn } from '@/lib/utils'

interface MenuItem {
  label?: string
  action?: string
  shortcut?: string
  separator?: boolean
}

interface MenuDef {
  label: string
  items: MenuItem[]
}

// Mirrors the native application menu (src/main/index.ts buildMenu) for
// non-macOS platforms. Native roles are dispatched via 'native:*' and handled
// by the main process; app actions flow through the existing menu:action
// pipeline so the renderer switch in App.tsx handles them.
const MENUS: MenuDef[] = [
  {
    label: 'File',
    items: [
      { label: 'New Project', action: 'new-project', shortcut: 'Ctrl+N' },
      { label: 'Close Project', action: 'close-project', shortcut: 'Ctrl+W' },
      { separator: true },
      { label: 'Open File...', action: 'open-palette-files', shortcut: 'Ctrl+P' },
      { label: 'Save', action: 'save-file', shortcut: 'Ctrl+S' },
      { label: 'Close File', action: 'close-file-tab', shortcut: 'Ctrl+Alt+W' }
    ]
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', action: 'native:undo', shortcut: 'Ctrl+Z' },
      { label: 'Redo', action: 'native:redo', shortcut: 'Ctrl+Shift+Z' },
      { separator: true },
      { label: 'Cut', action: 'native:cut', shortcut: 'Ctrl+X' },
      { label: 'Copy', action: 'native:copy', shortcut: 'Ctrl+C' },
      { label: 'Paste', action: 'native:paste', shortcut: 'Ctrl+V' },
      { label: 'Select All', action: 'native:select-all', shortcut: 'Ctrl+A' },
      { separator: true },
      { label: 'Command Palette', action: 'open-palette', shortcut: 'Ctrl+K' }
    ]
  },
  {
    label: 'View',
    items: [
      { label: 'Dashboard', action: 'toggle-dashboard' },
      { label: 'Statistics', action: 'show-statistics' },
      { label: 'Usage', action: 'show-usage' },
      { separator: true },
      { label: 'Editor', action: 'center-tab-editor', shortcut: 'Ctrl+1' },
      { label: 'Codev Config', action: 'center-tab-codev', shortcut: 'Ctrl+2' },
      { label: 'Skills', action: 'center-tab-skills', shortcut: 'Ctrl+3' },
      { label: 'Terminals', action: 'center-tab-terminals', shortcut: 'Ctrl+4' },
      { separator: true },
      { label: 'Toggle Light/Dark', action: 'toggle-variant', shortcut: 'Ctrl+Shift+L' },
      { separator: true },
      { label: 'Reload', action: 'native:reload', shortcut: 'Ctrl+R' },
      { label: 'Force Reload', action: 'native:force-reload', shortcut: 'Ctrl+Shift+R' },
      { label: 'Toggle Developer Tools', action: 'native:devtools' },
      { separator: true },
      { label: 'Actual Size', action: 'native:zoom-reset', shortcut: 'Ctrl+0' },
      { label: 'Zoom In', action: 'native:zoom-in', shortcut: 'Ctrl+=' },
      { label: 'Zoom Out', action: 'native:zoom-out', shortcut: 'Ctrl+-' },
      { separator: true },
      { label: 'Toggle Full Screen', action: 'native:fullscreen', shortcut: 'F11' }
    ]
  },
  {
    label: 'Terminal',
    items: [
      { label: 'New Codev Terminal', action: 'new-codev-terminal' },
      { label: 'New Shell Terminal', action: 'new-shell-terminal' },
      { separator: true },
      { label: 'Next Tab', action: 'terminal-tab-next', shortcut: 'Ctrl+Shift+]' },
      { label: 'Previous Tab', action: 'terminal-tab-prev', shortcut: 'Ctrl+Shift+[' },
      { separator: true },
      { label: 'Restart Codev', action: 'restart-codev' },
      { label: 'Clear Context', action: 'clear-context' }
    ]
  },
  {
    label: 'Git',
    items: [
      { label: 'Pull & Rebase', action: 'git-pull-rebase' },
      { separator: true },
      { label: 'Commit', action: 'git-commit' }
    ]
  },
  {
    label: 'Window',
    items: [
      { label: 'Minimize', action: 'native:minimize', shortcut: 'Ctrl+M' },
      { label: 'Zoom', action: 'native:maximize' },
      { separator: true },
      { label: 'Check for Updates', action: 'native:check-updates' }
    ]
  }
]

function MenuBarInner(): React.ReactElement {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [visible, setVisible] = useState(true)
  const barRef = useRef<HTMLDivElement>(null)
  const accent = useAccent()

  useEffect(() => {
    const load = (): void => {
      window.api.settings.menuBarVisible().then(setVisible).catch(() => {})
    }
    load()
    window.addEventListener('menu-bar-visible-changed', load)
    return () => window.removeEventListener('menu-bar-visible-changed', load)
  }, [])

  useEffect(() => {
    if (!openMenu) return
    const onDocMouseDown = (e: MouseEvent): void => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [openMenu])

  if (!visible) return null

  const run = (action?: string): void => {
    setOpenMenu(null)
    if (action) void window.api.menu.trigger(action)
  }

  return (
    <div
      ref={barRef}
      className="flex h-8 shrink-0 items-center gap-0.5 border-b border-zinc-800 bg-zinc-900/80 px-2 text-xs text-zinc-200"
    >
      {MENUS.map((menu) => {
        const open = openMenu === menu.label
        return (
          <div key={menu.label} className="relative">
            <button
              onClick={() => setOpenMenu(open ? null : menu.label)}
              className={cn(
                'rounded px-2.5 py-1 transition-colors hover:bg-zinc-800',
                open ? 'bg-zinc-800' : ''
              )}
              style={open ? { color: accent } : undefined}
            >
              {menu.label}
            </button>
            {open && (
              <div className="absolute left-0 top-full z-50 min-w-56 rounded-md border border-zinc-800 bg-zinc-900 py-1 shadow-xl">
                {menu.items.map((item, i) =>
                  item.separator ? (
                    <div key={i} className="mx-2 my-1 h-px bg-zinc-800" />
                  ) : (
                    <button
                      key={i}
                      onClick={() => run(item.action)}
                      className="flex w-full items-center justify-between gap-8 px-3 py-1.5 text-left transition-colors hover:bg-zinc-800/70"
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="text-micro text-zinc-500">{item.shortcut}</span>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function MenuBar(): React.ReactElement | null {
  return <MenuBarInner />
}
