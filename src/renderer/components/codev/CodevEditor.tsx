import { useState, useRef, useCallback } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import { useCodevStore } from '@/stores/codev-store'
import { useThemeStore } from '@/stores/theme-store'
import { registerMonacoThemes, MONACO_THEME_NAME } from '@/config/monaco-theme-registry'
import { MonacoErrorBoundary } from '@/components/editor/MonacoErrorBoundary'
import type { editor } from 'monaco-editor'
import { detectLanguage } from '@/lib/language-detect'

function handleBeforeMount(monaco: Monaco): void {
  registerMonacoThemes(monaco)
}

export function CodevEditor({ projectId }: { projectId: string }): React.ReactElement {
  const activeFilePath = useCodevStore((s) => s.activeFilePerProject[projectId] ?? null)
  const content = useCodevStore((s) => (activeFilePath ? s.contentCache[activeFilePath] : undefined))
  const { saveFile } = useCodevStore()
  const getFullThemeId = useThemeStore((s) => s.getFullThemeId)
  const [showSaved, setShowSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const themeId = getFullThemeId()
  const monacoTheme = MONACO_THEME_NAME[themeId] ?? 'github-dark'

  const filename = activeFilePath?.split('/').pop() ?? ''

  const flashSaved = useCallback(() => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setShowSaved(true)
    savedTimer.current = setTimeout(() => setShowSaved(false), 1500)
  }, [])

  const handleMount = (editorInstance: editor.IStandaloneCodeEditor): void => {
    editorInstance.addAction({
      id: 'codev-save',
      label: 'Save',
      keybindings: [2048 | 49],
      run: async () => {
        if (activeFilePath) {
          await saveFile(projectId, activeFilePath, editorInstance.getValue())
          flashSaved()
        }
      }
    })
  }

  if (!activeFilePath || content === undefined) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
        Select a file
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="flex h-9 shrink-0 items-center border-b border-zinc-800 bg-zinc-900/50 px-3">
        <span className="text-xs text-zinc-400 truncate">{filename}</span>
        <span
          className={`ml-2 text-micro text-emerald-400 transition-opacity duration-300 ${showSaved ? 'opacity-100' : 'opacity-0'}`}
        >
          Saved
        </span>
      </div>
      <div className="flex-1">
        <MonacoErrorBoundary>
          <Editor
            key={activeFilePath}
            path={`inmemory://editor${activeFilePath}`}
            value={content}
            language={detectLanguage(filename)}
            theme={monacoTheme}
            beforeMount={handleBeforeMount}
            onMount={handleMount}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 8 }
            }}
          />
        </MonacoErrorBoundary>
      </div>
    </div>
  )
}
