// Generates the PWA icons (chat bubble + check on navy) without any image libraries.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const NAVY = [22, 33, 62]      // #16213e
const GREEN = [37, 211, 102]   // #25d366
const WHITE = [255, 255, 255]

// ---- minimal PNG encoder (RGBA, filter 0) ----
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// ---- shape rasterization with 3x3 supersampling ----
function inCircle(px, py, cx, cy, r) {
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}
function inRoundedRect(px, py, x0, y0, x1, y1, r) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false
  const cx = Math.max(x0 + r, Math.min(px, x1 - r))
  const cy = Math.max(y0 + r, Math.min(py, y1 - r))
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r || (px >= x0 + r && px <= x1 - r) || (py >= y0 + r && py <= y1 - r)
}
function inTriangle(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const s1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
  const s2 = (cx - bx) * (py - by) - (cy - by) * (px - bx)
  const s3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx)
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)
}
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
function inSegment(px, py, [ax, ay], [bx, by], w) {
  return distToSeg(px, py, ax, ay, bx, by) <= w / 2
}

// Icon design in a 512-unit space: navy rounded square, green chat bubble, white check.
function drawPixel(px, py, size, opaqueBg) {
  const k = size / 512
  const x = px * 512 / size, y = py * 512 / size
  if (opaqueBg) {
    if (x < 0 || x > 512 || y < 0 || y > 512) return null
  } else if (!inRoundedRect(x, y, 0, 0, 512, 512, 96)) {
    return null
  }
  let color = NAVY
  const bubble = inCircle(x, y, 256, 238, 138) ||
    inTriangle(x, y, [168, 330], [116, 392], [240, 366])
  if (bubble) color = GREEN
  if (inSegment(x, y, [198, 244], [245, 288], 26) || inSegment(x, y, [245, 288], [322, 194], 26)) color = WHITE
  return color
}

function render(size, opaqueBg) {
  const rgba = Buffer.alloc(size * size * 4)
  const S = 3 // supersample
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const c = drawPixel(px + (sx + 0.5) / S, py + (sy + 0.5) / S, size, opaqueBg)
          if (c) {
            r += c[0]; g += c[1]; b += c[2]; a += 255
          }
        }
      }
      const n = S * S
      const i = (py * size + px) * 4
      rgba[i] = Math.round(r / n)
      rgba[i + 1] = Math.round(g / n)
      rgba[i + 2] = Math.round(b / n)
      rgba[i + 3] = Math.round(a / n)
    }
  }
  return png(size, size, rgba)
}

writeFileSync(join(outDir, 'icon-192.png'), render(192, false))
writeFileSync(join(outDir, 'icon-512.png'), render(512, false))
writeFileSync(join(outDir, 'icon-maskable-512.png'), render(512, false))
writeFileSync(join(outDir, 'icon-180.png'), render(180, true))
console.log('icons written to', outDir)
