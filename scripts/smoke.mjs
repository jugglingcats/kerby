// Headless smoke test: boots the built app in Chromium, walks the intro,
// throws via the drag fallback, and reports console errors / game flow.
import { chromium } from 'playwright-core'
import { preview } from 'vite'
import os from 'node:os'
import path from 'node:path'

const exe = path.join(
  os.homedir(),
  'AppData',
  'Local',
  'ms-playwright',
  'chromium-1248',
  'chrome-win64',
  'chrome.exe',
)

const server = await preview({ preview: { port: 4173, strictPort: true } })
const errors = []
const logs = []

const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

const promptText = async () => {
  const el = page.locator('.prompt')
  if ((await el.count()) === 0) return null
  return el.textContent()
}

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(4000) // rapier wasm + first frames

const sawIntro = await page.locator('text=Kerby').first().isVisible().catch(() => false)
logs.push(`intro visible: ${sawIntro}`)

await page.locator('button:has-text("Play")').click()
await page.waitForTimeout(1500)
const ready = await promptText()
logs.push(`ready prompt: ${ready}`)
const p1Turn = ready?.includes('Player 1')

// Drag throw: press at center, drag down, release.
const cx = 195
const cy = 420
await page.mouse.move(cx, cy)
await page.mouse.down()
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(cx, cy + i * 14)
  await page.waitForTimeout(16)
}
await page.mouse.up()

// Poll for the outcome banner through flight + result delay.
let banner = null
for (let i = 0; i < 40; i++) {
  const b = page.locator('.banner')
  if ((await b.count()) > 0) {
    banner = await b.first().textContent()
    break
  }
  await page.waitForTimeout(250)
}
logs.push(`banner: ${banner ?? '(never appeared)'}`)

// Wait for the turn to flip and confirm the next prompt is Player 2's.
let p2Turn = false
for (let i = 0; i < 24; i++) {
  const t = await promptText()
  if (t?.includes('Player 2')) {
    p2Turn = true
    break
  }
  await page.waitForTimeout(250)
}
logs.push(`turn flipped to Player 2: ${p2Turn}`)

await page.screenshot({ path: 'smoke.png' })
await browser.close()
await server.close()

console.log(logs.join('\n'))
console.log('\nconsole/page errors:', errors.length ? '\n' + errors.join('\n') : 'none')

const failed =
  !sawIntro || !p1Turn || !banner || !p2Turn || errors.some((e) => !e.includes('favicon'))
console.log(failed ? '\nSMOKE TEST FAILED' : '\nSMOKE TEST PASSED')
process.exit(failed ? 1 : 0)
