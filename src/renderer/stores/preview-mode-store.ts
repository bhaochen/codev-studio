import { create } from 'zustand'

// Whether the markdown preview pane is shown for the active file of a project.
// Kept in-memory only (not persisted) — preview is a per-session convenience.

interface PreviewModeState {
  /** per projectId -> true if the preview pane should be shown */
  previewEnabled: Record<string, boolean>
  setPreviewEnabled: (projectId: string, enabled: boolean) => void
}

export const usePreviewModeStore = create<PreviewModeState>((set) => ({
  previewEnabled: {},
  setPreviewEnabled: (projectId, enabled) =>
    set((s) => ({ previewEnabled: { ...s.previewEnabled, [projectId]: enabled } }))
}))
