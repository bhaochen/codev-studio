import { useEffect, useState } from 'react'
import { SectionCard, Toggle, useAccent } from '@/components/settings/SettingsControls'

export function MenuBarSection(): React.ReactElement {
  const accent = useAccent()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    window.api.settings.menuBarVisible().then(setEnabled).catch(() => {})
  }, [])

  const toggle = (): void => {
    const next = !enabled
    // Apply optimistically; revert if the main process rejects.
    setEnabled(next)
    window.api.settings.setMenuBarVisible(next).catch(() => setEnabled(!next))
    // Let the MenuBar component pick up the new visibility immediately.
    window.dispatchEvent(new CustomEvent('menu-bar-visible-changed'))
  }

  return (
    <SectionCard title="Menu Bar" description="Show or hide the File/Edit/View menu bar.">
      <div className="flex items-center gap-3">
        <Toggle enabled={enabled} onToggle={toggle} accent={accent} ariaLabel="Toggle menu bar" />
        <span className="text-xs text-zinc-300">Show menu bar</span>
        <span className="ml-auto text-micro text-zinc-600">
          Hidden bars can be shown temporarily with the Alt key
        </span>
      </div>
    </SectionCard>
  )
}
