const fs = require('fs')
const path = require('path')

const prebuildsDir = path.join('node_modules', 'node-pty', 'prebuilds')
try {
  fs.readdirSync(prebuildsDir).forEach((dir) => {
    try {
      fs.chmodSync(path.join(prebuildsDir, dir, 'spawn-helper'), 0o755)
    } catch {}
  })
} catch {}

// Only remove the locally compiled build when prebuilt binaries exist for this
// platform (macOS/Windows). Linux ships no node-pty prebuilds, so the compiled
// build must be kept or the native module fails to load.
const platformDir = `${process.platform}-${process.arch}`
if (fs.existsSync(path.join(prebuildsDir, platformDir))) {
  try {
    fs.rmSync(path.join('node_modules', 'node-pty', 'build'), { recursive: true, force: true })
  } catch {}
}
