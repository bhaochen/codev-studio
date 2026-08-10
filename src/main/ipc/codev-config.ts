import fs from 'fs'
import path from 'path'
import os from 'os'
import type { CodevFileEntry, CodevSection } from '@main/models/types'
import { safeHandle } from '@main/ipc/safe-handle'

const SKIP_DIRS = new Set(['cache', 'debug', 'telemetry', 'todos', 'sessions'])
const SKIP_EXTS = new Set(['.jsonl'])

function safeReaddir(dir: string): string[] {
  try {
    return fs.readdirSync(dir)
  } catch {
    return []
  }
}

function addFiles(dir: string, section: CodevSection, entries: CodevFileEntry[]): void {
  for (const name of safeReaddir(dir)) {
    const fullPath = path.join(dir, name)
    const ext = path.extname(name)
    if (SKIP_EXTS.has(ext)) continue
    try {
      if (fs.statSync(fullPath).isFile()) {
        entries.push({ name, path: fullPath, section })
      }
    } catch {
      // skip inaccessible
    }
  }
}

function scanCodevFiles(projectPath: string): CodevFileEntry[] {
  const codevDir = path.join(os.homedir(), '.claude')
  const entries: CodevFileEntry[] = []

  const codevMd = path.join(codevDir, 'CLAUDE.md')
  if (fs.existsSync(codevMd)) {
    entries.push({ name: 'CLAUDE.md', path: codevMd, section: 'global' })
  }

  const settingsJson = path.join(codevDir, 'settings.json')
  if (fs.existsSync(settingsJson)) {
    entries.push({ name: 'settings.json', path: settingsJson, section: 'global' })
  }

  addFiles(path.join(codevDir, 'rules'), 'global', entries)

  const skillsDir = path.join(codevDir, 'skills')
  for (const skillName of safeReaddir(skillsDir)) {
    const skillDir = path.join(skillsDir, skillName)
    try {
      if (!fs.statSync(skillDir).isDirectory()) continue
    } catch {
      continue
    }
    if (SKIP_DIRS.has(skillName)) continue

    const skillMd = path.join(skillDir, 'SKILL.md')
    if (fs.existsSync(skillMd)) {
      entries.push({ name: `${skillName}/SKILL.md`, path: skillMd, section: 'skills' })
    }

    const refsDir = path.join(skillDir, 'references')
    for (const refName of safeReaddir(refsDir)) {
      const refPath = path.join(refsDir, refName)
      try {
        if (fs.statSync(refPath).isFile()) {
          entries.push({ name: `${skillName}/references/${refName}`, path: refPath, section: 'skills' })
        }
      } catch {
        // skip
      }
    }
  }

  addFiles(path.join(codevDir, 'commands'), 'commands', entries)

  addFiles(path.join(codevDir, 'scripts'), 'hooks', entries)

  const keybindingsJson = path.join(codevDir, 'keybindings.json')
  if (fs.existsSync(keybindingsJson)) {
    entries.push({ name: 'keybindings.json', path: keybindingsJson, section: 'global' })
  }

  const projectKey = projectPath.replace(/\//g, '-')
  const projectConfigDir = path.join(codevDir, 'projects', projectKey)

  const projectSettingsJson = path.join(projectConfigDir, 'settings.json')
  if (fs.existsSync(projectSettingsJson)) {
    entries.push({ name: 'settings.json (project)', path: projectSettingsJson, section: 'project' })
  }

  const projectCodevMdGlobal = path.join(projectConfigDir, 'CLAUDE.md')
  if (fs.existsSync(projectCodevMdGlobal)) {
    entries.push({ name: 'CLAUDE.md (project config)', path: projectCodevMdGlobal, section: 'project' })
  }

  const projectMemDir = path.join(projectConfigDir, 'memory')
  addFiles(projectMemDir, 'project', entries)

  const projectCodevDir = path.join(projectPath, '.claude')
  for (const name of safeReaddir(projectCodevDir)) {
    if (SKIP_DIRS.has(name)) continue
    const fullPath = path.join(projectCodevDir, name)
    const ext = path.extname(name)
    if (SKIP_EXTS.has(ext)) continue
    try {
      if (fs.statSync(fullPath).isFile()) {
        entries.push({ name: `.claude/${name}`, path: fullPath, section: 'project' })
      }
    } catch {
      // skip
    }
  }

  const projectCodevMd = path.join(projectPath, 'CLAUDE.md')
  if (fs.existsSync(projectCodevMd)) {
    entries.push({ name: 'CLAUDE.md (project root)', path: projectCodevMd, section: 'project' })
  }

  return entries
}

function isAllowedCodevPath(filePath: string, projectPath?: string): boolean {
  const resolved = path.resolve(filePath)
  const codevDir = path.join(os.homedir(), '.claude')
  if (resolved.startsWith(codevDir + path.sep)) return true
  if (projectPath) {
    const projectCodevDir = path.join(path.resolve(projectPath), '.claude')
    if (resolved.startsWith(projectCodevDir + path.sep)) return true
    if (resolved === path.join(path.resolve(projectPath), 'CLAUDE.md')) return true
  }
  return false
}

export function registerCodevConfigHandlers(): void {
  safeHandle('codev:home-path', (): string => {
    return path.join(os.homedir(), '.claude')
  })

  safeHandle('codev:user-home', (): string => {
    return os.homedir()
  })

  safeHandle('codev:scan-files', (_event, projectPath: string): CodevFileEntry[] => {
    return scanCodevFiles(projectPath)
  })

  safeHandle('codev:read-file', (_event, filePath: string, projectPath: string): string => {
    const resolved = path.resolve(filePath)
    if (!isAllowedCodevPath(resolved, projectPath)) throw new Error('Path not allowed')
    return fs.readFileSync(resolved, 'utf-8')
  })

  safeHandle('codev:write-file', (_event, filePath: string, content: string, projectPath: string): void => {
    const resolved = path.resolve(filePath)
    if (!isAllowedCodevPath(resolved, projectPath)) throw new Error('Path not allowed')
    fs.mkdirSync(path.dirname(resolved), { recursive: true })
    fs.writeFileSync(resolved, content, 'utf-8')
  })

  safeHandle('codev:delete-file', (_event, filePath: string, projectPath: string): void => {
    const resolved = path.resolve(filePath)
    if (!isAllowedCodevPath(resolved, projectPath)) throw new Error('Path not allowed')
    fs.unlinkSync(resolved)
  })
}
