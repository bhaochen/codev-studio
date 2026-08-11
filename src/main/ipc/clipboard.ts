import { safeHandle } from '@main/ipc/safe-handle'
import { clipboard } from 'electron'
import { readClipboardImageThumbnail } from '@main/services/clipboard-watcher'

export function registerClipboardHandlers(): void {
  safeHandle('clipboard:current-image', (): string | null => {
    return readClipboardImageThumbnail()
  })

  safeHandle('clipboard:write-text', (_event, text: string): void => {
    clipboard.writeText(text)
  })

  safeHandle('clipboard:read-text', (): string => {
    return clipboard.readText()
  })
}
