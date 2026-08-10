// Single source of truth for "what directories count as a project root for
// filesystem IPC". The projects IPC pushes paths here whenever the registered
// project list changes; the filesystem IPC consults this cache to authorize
// reads/writes. Keeping this in-process avoids two electron-store instances
// drifting out of sync.

import path from 'path'

let projectRoots: string[] = []

export function registerProjectRoots(paths: string[]): void {
  // Normalize + dedupe so cached lookups stay O(n) and case/separator-safe.
  const seen = new Set<string>()
  projectRoots = paths
    .map((p) => path.resolve(p))
    .filter((p) => {
      if (seen.has(p)) return false
      seen.add(p)
      return true
    })
}

export function getProjectRoots(): string[] {
  return projectRoots
}

export function isWithinProjectRoot(filePath: string): boolean {
  const resolved = path.resolve(filePath)
  return projectRoots.some(
    (root) => resolved === root || resolved.startsWith(root + path.sep)
  )
}

export function __resetProjectRoots(): void {
  projectRoots = []
}
