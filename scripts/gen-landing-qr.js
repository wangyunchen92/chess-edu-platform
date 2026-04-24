#!/usr/bin/env node
/**
 * Generate QR code PNGs for landing page distribution.
 *
 * Usage:
 *   node scripts/gen-landing-qr.js                     # Generate for all known channels
 *   node scripts/gen-landing-qr.js DY2026              # Generate for a single invite code
 *   node scripts/gen-landing-qr.js DY2026 https://...  # Custom base URL
 */
const path = require('path')
const fs = require('fs')
const QRCode = require('qrcode')

const BASE_URL = process.argv[3] || 'https://chess.ccwu.cc/landing'
const OUT_DIR = path.join(__dirname, '..', 'docs', 'marketing', 'qr-codes')

const CHANNELS = [
  { code: 'DY2026', name: '抖音' },
  { code: 'WX2026', name: '视频号' },
  { code: 'XHS2026', name: '小红书' },
  { code: 'LN2026', name: '线下地推' },
]

async function generate(code, channelName) {
  const url = `${BASE_URL}?code=${encodeURIComponent(code)}&ref=${encodeURIComponent(channelName)}`
  const outPath = path.join(OUT_DIR, `qr-${code}.png`)
  await QRCode.toFile(outPath, url, {
    errorCorrectionLevel: 'H',
    type: 'png',
    margin: 2,
    width: 600,
    color: {
      dark: '#1e1b4b',  // Brand purple-900
      light: '#ffffff',
    },
  })
  console.log(`[gen-qr] ${channelName.padEnd(8)} ${code.padEnd(10)} -> ${outPath}`)
  console.log(`         url: ${url}`)
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const targetCode = process.argv[2]
  if (targetCode) {
    await generate(targetCode, targetCode)
  } else {
    for (const { code, name } of CHANNELS) {
      await generate(code, name)
    }
  }
  console.log('\n[gen-qr] done. PNGs saved to', OUT_DIR)
}

main().catch((err) => {
  console.error('[gen-qr] failed:', err)
  process.exit(1)
})
