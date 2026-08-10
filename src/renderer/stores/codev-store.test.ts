import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCodevStore } from './codev-store'
import type { CodevFileEntry } from '@/models/types'

interface CodevApiMock {
  scanFiles: ReturnType<typeof vi.fn>
  readFile: ReturnType<typeof vi.fn>
  writeFile: ReturnType<typeof vi.fn>
  deleteFile: ReturnType<typeof vi.fn>
}

const file = (name: string, path: string, section: CodevFileEntry['section'] = 'project'): CodevFileEntry => ({
  name,
  path,
  section
})

beforeEach(() => {
  const codev: CodevApiMock = {
    scanFiles: vi.fn(async () => [] as CodevFileEntry[]),
    readFile: vi.fn(async () => ''),
    writeFile: vi.fn(async () => undefined),
    deleteFile: vi.fn(async () => undefined)
  }
  ;(window as unknown as { api: { codev: CodevApiMock } }).api = {
    ...(window as unknown as { api: Record<string, unknown> }).api,
    codev
  } as never
  useCodevStore.setState({
    filesPerProject: {},
    activeFilePerProject: {},
    contentCache: {},
    expandedSections: {},
    projectPaths: {}
  })
})

const codevApi = (): CodevApiMock =>
  (window as unknown as { api: { codev: CodevApiMock } }).api.codev

describe('codev-store', () => {
  describe('loadFiles', () => {
    it('stores the scanned file list and remembers the project path', async () => {
      const files = [file('CLAUDE.md', '/p/CLAUDE.md'), file('h.md', '/p/.claude/hooks/h.md', 'hooks')]
      codevApi().scanFiles.mockResolvedValueOnce(files)

      await useCodevStore.getState().loadFiles('p1', '/p')

      const s = useCodevStore.getState()
      expect(s.filesPerProject.p1).toEqual(files)
      expect(s.projectPaths.p1).toBe('/p')
      expect(codevApi().scanFiles).toHaveBeenCalledWith('/p')
    })

    it('drops cached content for files that were previously loaded', async () => {
      codevApi().scanFiles.mockResolvedValueOnce([file('a.md', '/p/a.md')])
      await useCodevStore.getState().loadFiles('p1', '/p')
      useCodevStore.setState({ contentCache: { '/p/a.md': 'cached', '/q/keep.md': 'other' } })

      codevApi().scanFiles.mockResolvedValueOnce([file('a.md', '/p/a.md')])
      await useCodevStore.getState().loadFiles('p1', '/p')

      const cache = useCodevStore.getState().contentCache
      expect(cache['/p/a.md']).toBeUndefined()
      expect(cache['/q/keep.md']).toBe('other')
    })
  })

  describe('selectFile', () => {
    it('reads the file and caches its contents on first selection', async () => {
      useCodevStore.setState({ projectPaths: { p1: '/p' } })
      codevApi().readFile.mockResolvedValueOnce('contents')

      await useCodevStore.getState().selectFile('p1', '/p/a.md')

      const s = useCodevStore.getState()
      expect(s.activeFilePerProject.p1).toBe('/p/a.md')
      expect(s.contentCache['/p/a.md']).toBe('contents')
      expect(codevApi().readFile).toHaveBeenCalledWith('/p/a.md', '/p')
    })

    it('does not re-read when the file is already cached', async () => {
      useCodevStore.setState({
        projectPaths: { p1: '/p' },
        contentCache: { '/p/a.md': 'cached' }
      })

      await useCodevStore.getState().selectFile('p1', '/p/a.md')

      expect(codevApi().readFile).not.toHaveBeenCalled()
      expect(useCodevStore.getState().activeFilePerProject.p1).toBe('/p/a.md')
    })
  })

  describe('saveFile', () => {
    it('writes the file via the api and updates the cache', async () => {
      useCodevStore.setState({ projectPaths: { p1: '/p' } })

      await useCodevStore.getState().saveFile('p1', '/p/a.md', 'updated')

      expect(codevApi().writeFile).toHaveBeenCalledWith('/p/a.md', 'updated', '/p')
      expect(useCodevStore.getState().contentCache['/p/a.md']).toBe('updated')
    })
  })

  describe('deleteFile', () => {
    it('clears the active selection and rescans the project', async () => {
      useCodevStore.setState({
        projectPaths: { p1: '/p' },
        contentCache: { '/p/a.md': 'cached' },
        activeFilePerProject: { p1: '/p/a.md' }
      })
      codevApi().scanFiles.mockResolvedValueOnce([file('b.md', '/p/b.md')])

      await useCodevStore.getState().deleteFile('p1', '/p/a.md', '/p')

      const s = useCodevStore.getState()
      expect(codevApi().deleteFile).toHaveBeenCalledWith('/p/a.md', '/p')
      expect(s.contentCache['/p/a.md']).toBeUndefined()
      expect(s.activeFilePerProject.p1).toBeNull()
      expect(s.filesPerProject.p1).toEqual([file('b.md', '/p/b.md')])
    })

    it('keeps the active selection when a non-active file is deleted', async () => {
      useCodevStore.setState({
        projectPaths: { p1: '/p' },
        activeFilePerProject: { p1: '/p/keep.md' }
      })
      codevApi().scanFiles.mockResolvedValueOnce([])

      await useCodevStore.getState().deleteFile('p1', '/p/other.md', '/p')

      expect(useCodevStore.getState().activeFilePerProject.p1).toBe('/p/keep.md')
    })
  })

  describe('toggleSection', () => {
    it('removes the section when expanded and re-adds when collapsed', () => {
      useCodevStore.getState().toggleSection('p1', 'hooks')
      let expanded = useCodevStore.getState().expandedSections.p1
      expect(expanded.has('hooks')).toBe(false)
      expect(expanded.has('global')).toBe(true)

      useCodevStore.getState().toggleSection('p1', 'hooks')
      expanded = useCodevStore.getState().expandedSections.p1
      expect(expanded.has('hooks')).toBe(true)
    })

    it('keeps the per-project expansion sets independent', () => {
      useCodevStore.getState().toggleSection('p1', 'hooks')
      useCodevStore.getState().toggleSection('p2', 'global')
      const { expandedSections } = useCodevStore.getState()
      expect(expandedSections.p1.has('hooks')).toBe(false)
      expect(expandedSections.p1.has('global')).toBe(true)
      expect(expandedSections.p2.has('global')).toBe(false)
      expect(expandedSections.p2.has('hooks')).toBe(true)
    })
  })
})
