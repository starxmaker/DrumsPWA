import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { chmodSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { path7za } = require('7zip-bin')
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = join(projectRoot, 'public', 'audio', 'drums')
const archiveUrl = 'https://github.com/freepats/muldjordkit/releases/download/2020-10-18/MuldjordKit-SFZ+FLAC-20201018.7z'
const expectedSha256 = '89261006296a9a4d93dfda2c1c5a3925215e24329f408c2c8bc1bcf6ea123c8f'
const archiveFolder = 'MuldjordKit SFZ+FLAC-20201018'
// One mid-velocity hit sample per drum piece, from the CC BY 4.0 MuldjordKit.
const sampleSources = {
  'kick.flac': 'samples/KdrumL/13-KdrumL.flac',
  'snare.flac': 'samples/Snare1/30-Snare.flac',
  'hihat-closed.flac': 'samples/HihatClosed/15-HihatClosed.flac',
  'hihat-open.flac': 'samples/HihatOpen/16-HihatOpen.flac',
  'tom-hi.flac': 'samples/Tom1/6-Tom1.flac',
  'tom-mid.flac': 'samples/Tom2/7-Tom2.flac',
  'tom-floor.flac': 'samples/Tom4/10-Tom4.flac',
  'crash.flac': 'samples/CrashL/5-CrashL.flac',
  'ride.flac': 'samples/RideL/5-RideL.flac',
}
const sampleNames = Object.keys(sampleSources)

async function hasPreparedAssets() {
  try {
    await Promise.all(sampleNames.map(async (name) => {
      const details = await stat(join(outputDirectory, name))
      if (!details.isFile() || details.size === 0) throw new Error(`Invalid asset: ${name}`)
    }))
    return true
  } catch {
    return false
  }
}

if (await hasPreparedAssets()) {
  console.log('FreePats MuldjordKit drum samples are already prepared.')
  process.exit(0)
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'drums-pwa-freepats-'))
try {
  console.log('Downloading CC BY 4.0 FreePats MuldjordKit drum samples (~157 MiB)…')
  const response = await fetch(archiveUrl)
  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`)
  const archiveBytes = Buffer.from(await response.arrayBuffer())
  const actualSha256 = createHash('sha256').update(archiveBytes).digest('hex')
  if (actualSha256 !== expectedSha256) {
    throw new Error(`MuldjordKit archive checksum mismatch: ${actualSha256}`)
  }

  const archivePath = join(temporaryDirectory, 'MuldjordKit.7z')
  const extractedDirectory = join(temporaryDirectory, 'extracted')
  await writeFile(archivePath, archiveBytes)

  const extractors = [path7za, '7zz', '7z', '7za']
  const failures = []
  let extracted = false
  for (const extractor of extractors) {
    if (extractor === path7za) {
      try {
        chmodSync(path7za, 0o755)
      } catch {
        // Missing file or a platform without POSIX modes; the spawn below reports it.
      }
    }
    const wanted = Object.values(sampleSources).map((source) => `${archiveFolder}/${source}`)
    const result = spawnSync(extractor, ['x', archivePath, ...wanted, `-o${extractedDirectory}`, '-y'], { stdio: 'inherit' })
    if (result.status === 0) {
      extracted = true
      break
    }
    const reason = result.error ? result.error.message : `killed by ${result.signal ?? 'unknown signal'}`
    failures.push(`${extractor} (${reason})`)
    console.warn(`Extraction via ${extractor} failed: ${reason}; trying next extractor…`)
  }
  if (!extracted) throw new Error(`7-Zip extraction failed — tried: ${failures.join(', ')}`)

  const sourceDirectory = join(extractedDirectory, archiveFolder, 'samples')
  await mkdir(outputDirectory, { recursive: true })
  for (const [name, source] of Object.entries(sampleSources)) {
    const sourceFile = join(sourceDirectory, source)
    if ((await readFile(sourceFile)).length === 0) throw new Error(`Empty source sample: ${name}`)
    await copyFile(sourceFile, join(outputDirectory, name))
  }
  console.log(`Prepared ${sampleNames.length} FreePats MuldjordKit drum samples.`)
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
