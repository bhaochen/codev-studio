import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { invoke, makeIpcMainMock, makeIpcRegistry, type IpcRegistry } from './ipc-test-utils'

let homeDir = ''
let projectDir = ''
let originalHome: string | undefined

let registry: IpcRegistry

beforeEach(async () => {
  homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'))
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proj-'))
  originalHome = process.env.HOME
  process.env.HOME = homeDir
  vi.resetModules()
  registry = makeIpcRegistry()
  vi.doMock('electron', () => ({ ipcMain: makeIpcMainMock(registry) }))
  const { registerCodevConfigHandlers } = await import('./codev-config')
  registerCodevConfigHandlers()
})

afterEach(() => {
  process.env.HOME = originalHome
  fs.rmSync(homeDir, { recursive: true, force: true })
  fs.rmSync(projectDir, { recursive: true, force: true })
})

const writeAt = (p: string, content = ''): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, content)
}

describe('codev-config ipc', () => {
  describe('codev:scan-files', () => {
    it('discovers global CLAUDE.md, settings.json, and rules/', async () => {
      writeAt(path.join(homeDir, '.claude', 'CLAUDE.md'), '')
      writeAt(path.join(homeDir, '.claude', 'settings.json'), '{}')
      writeAt(path.join(homeDir, '.claude', 'rules', 'a.md'), '')

      type Entry = { name: string; section: string }
      const result = await invoke<Entry[]>(registry, 'codev:scan-files', projectDir)
      const names = result.map((e) => e.name)
      expect(names).toContain('CLAUDE.md')
      expect(names).toContain('settings.json')
      expect(names).toContain('a.md')
      expect(result.find((e) => e.name === 'CLAUDE.md')?.section).toBe('global')
    })

    it('skips .jsonl files and known cache/debug subdirs in skills/', async () => {
      writeAt(path.join(homeDir, '.claude', 'skills', 'my-skill', 'SKILL.md'), '')
      writeAt(path.join(homeDir, '.claude', 'skills', 'cache', 'SKILL.md'), '')
      writeAt(path.join(homeDir, '.claude', 'rules', 'note.jsonl'), '')

      type Entry = { name: string; path: string; section: string }
      const result = await invoke<Entry[]>(registry, 'codev:scan-files', projectDir)
      expect(result.find((e) => e.name === 'my-skill/SKILL.md')).toBeDefined()
      expect(result.find((e) => e.path.includes('skills/cache'))).toBeUndefined()
      expect(result.find((e) => e.name === 'note.jsonl')).toBeUndefined()
    })

    it('discovers project-level .claude files and CLAUDE.md at the project root', async () => {
      writeAt(path.join(projectDir, 'CLAUDE.md'), '')
      writeAt(path.join(projectDir, '.claude', 'config.json'), '{}')

      type Entry = { name: string; section: string }
      const result = await invoke<Entry[]>(registry, 'codev:scan-files', projectDir)
      expect(result.find((e) => e.name === '.claude/config.json')?.section).toBe('project')
      expect(result.find((e) => e.name === 'CLAUDE.md (project root)')?.section).toBe('project')
    })
  })

  describe('codev:read-file / write-file / delete-file', () => {
    it('rejects paths outside the .claude directory', async () => {
      const outside = path.join(homeDir, 'outside.md')
      writeAt(outside, '')
      await expect(invoke(registry, 'codev:read-file', outside, projectDir)).rejects.toThrow(/not allowed/)
      await expect(invoke(registry, 'codev:write-file', outside, 'x', projectDir)).rejects.toThrow(/not allowed/)
      await expect(invoke(registry, 'codev:delete-file', outside, projectDir)).rejects.toThrow(/not allowed/)
    })

    it('reads, writes, and deletes within the global .claude directory', async () => {
      const target = path.join(homeDir, '.claude', 'rules', 'thing.md')
      writeAt(target, 'original')

      const content = await invoke(registry, 'codev:read-file', target, projectDir)
      expect(content).toBe('original')

      await invoke(registry, 'codev:write-file', target, 'updated', projectDir)
      expect(fs.readFileSync(target, 'utf-8')).toBe('updated')

      await invoke(registry, 'codev:delete-file', target, projectDir)
      expect(fs.existsSync(target)).toBe(false)
    })

    it('reads project CLAUDE.md and project .claude/* files', async () => {
      const projectCodevMd = path.join(projectDir, 'CLAUDE.md')
      writeAt(projectCodevMd, 'project root')
      const projectScoped = path.join(projectDir, '.claude', 'note.md')
      writeAt(projectScoped, 'scoped')

      expect(await invoke(registry, 'codev:read-file', projectCodevMd, projectDir)).toBe('project root')
      expect(await invoke(registry, 'codev:read-file', projectScoped, projectDir)).toBe('scoped')
    })
  })
})
