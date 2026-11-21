// Strict 16-color pixel-art palette & integer software rasterizer
(function () {
  const PALETTE_HEX = [
    '#21151d', // 0: Bold 1px Outline / Deep Espresso Ink
    '#3b2a37', // 1: Cast Iron Dark / Stove Grate
    '#5c4656', // 2: Cast Iron Sheen / Warm Slate Metal
    '#5e3424', // 3: Chestnut Hair / Deep Roasted Crust / Dark Wood
    '#94522d', // 4: Golden-Brown Hotcake Crust / Wood Handle
    '#cc7b35', // 5: Maple Syrup Amber / Warm Counter Wood
    '#edb14c', // 6: Melted Gold Butter / Crust Ring Sheen
    '#ffe07d', // 7: Creamy Batter / Fluffy Sponge / Butter Pat
    '#fff7dc', // 8: Milk Cream / Ceramic Plate / Apron / Sparkle
    '#d9cfc7', // 9: Warm Tile / Ceramic Shadow / Steam
    '#f5b795', // 10: Mama Warm Peach Skin
    '#e08279', // 11: Rosy Cheek / Skin Shadow / Pink Berry Batter
    '#d93848', // 12: Ripe Strawberry Red / Ribbon / Stove Knob
    '#5ab552', // 13: Berry Leaf Mint Green
    '#4da6ff', // 14: Cozy Gas Flame Blue / Pitcher Stripe
    '#8c52a8'  // 15: Juicy Blueberry Plum
  ];

  // Detect endianness for fast Uint32Array ImageData writes
  const testBuf = new ArrayBuffer(4);
  new Uint8Array(testBuf)[0] = 0xaa;
  const isLittleEndian = new Uint32Array(testBuf)[0] === 0xaa;

  const PALETTE_U32 = new Uint32Array(16);
  for (let i = 0; i < 16; i++) {
    const hex = PALETTE_HEX[i];
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    PALETTE_U32[i] = isLittleEndian
      ? ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
      : ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
  }

  class PixelBuffer {
    constructor(w, h) {
      this.resize(w, h);
    }

    resize(w, h) {
      this.w = w | 0;
      this.h = h | 0;
      this.imageData = new ImageData(this.w, this.h);
      this.pixels = new Uint32Array(this.imageData.data.buffer);
      this.layer = new Int8Array(this.w * this.h);
      this.layer.fill(-1);
      this.inLayer = false;
      this.minX = this.w;
      this.minY = this.h;
      this.maxX = -1;
      this.maxY = -1;
      this.camX = 0;
      this.camY = 0;
    }

    setShake(dx, dy) {
      this.camX = Math.round(dx) | 0;
      this.camY = Math.round(dy) | 0;
    }

    clear(colIdx) {
      this.pixels.fill(PALETTE_U32[colIdx & 15]);
    }

    beginLayer() {
      this.inLayer = true;
      this.minX = this.w;
      this.minY = this.h;
      this.maxX = -1;
      this.maxY = -1;
    }

    endLayer(outlineCol = 0) {
      if (!this.inLayer) return;
      this.inLayer = false;
      if (this.maxX < this.minX || this.maxY < this.minY) return;

      const w = this.w;
      const h = this.h;
      const layer = this.layer;
      const pixels = this.pixels;
      const x0 = Math.max(0, this.minX - 1);
      const y0 = Math.max(0, this.minY - 1);
      const x1 = Math.min(w - 1, this.maxX + 1);
      const y1 = Math.min(h - 1, this.maxY + 1);

      if (outlineCol >= 0) {
        const outU32 = PALETTE_U32[outlineCol & 15];
        for (let y = y0; y <= y1; y++) {
          const row = y * w;
          for (let x = x0; x <= x1; x++) {
            const idx = row + x;
            if (layer[idx] >= 0) continue;
            if (
              (x > 0 && layer[idx - 1] >= 0) ||
              (x + 1 < w && layer[idx + 1] >= 0) ||
              (y > 0 && layer[idx - w] >= 0) ||
              (y + 1 < h && layer[idx + w] >= 0)
            ) {
              pixels[idx] = outU32;
            }
          }
        }
      }

      const cx0 = Math.max(0, this.minX);
      const cy0 = Math.max(0, this.minY);
      const cx1 = Math.min(w - 1, this.maxX);
      const cy1 = Math.min(h - 1, this.maxY);
      for (let y = cy0; y <= cy1; y++) {
        const row = y * w;
        for (let x = cx0; x <= cx1; x++) {
          const idx = row + x;
          const c = layer[idx];
          if (c >= 0) {
            pixels[idx] = PALETTE_U32[c];
            layer[idx] = -1;
          }
        }
      }
    }

    pset(x, y, colIdx) {
      if (colIdx < 0) return;
      const px = (Math.round(x) + this.camX) | 0;
      const py = (Math.round(y) + this.camY) | 0;
      if (px < 0 || py < 0 || px >= this.w || py >= this.h) return;
      const idx = py * this.w + px;
      if (this.inLayer) {
        this.layer[idx] = colIdx & 15;
        if (px < this.minX) this.minX = px;
        if (px > this.maxX) this.maxX = px;
        if (py < this.minY) this.minY = py;
        if (py > this.maxY) this.maxY = py;
      } else {
        this.pixels[idx] = PALETTE_U32[colIdx & 15];
      }
    }

    // Raw pixel without camera offset (for screen background if needed)
    psetRaw(px, py, colIdx) {
      if (px < 0 || py < 0 || px >= this.w || py >= this.h || colIdx < 0) return;
      this.pixels[py * this.w + px] = PALETTE_U32[colIdx & 15];
    }

    fillRect(x, y, rw, rh, colIdx) {
      if (colIdx < 0 || rw <= 0 || rh <= 0) return;
      const x0 = Math.max(0, (Math.round(x) + this.camX) | 0);
      const y0 = Math.max(0, (Math.round(y) + this.camY) | 0);
      const x1 = Math.min(this.w - 1, (Math.round(x + rw - 1) + this.camX) | 0);
      const y1 = Math.min(this.h - 1, (Math.round(y + rh - 1) + this.camY) | 0);
      if (x1 < x0 || y1 < y0) return;

      if (this.inLayer) {
        const c = colIdx & 15;
        if (x0 < this.minX) this.minX = x0;
        if (x1 > this.maxX) this.maxX = x1;
        if (y0 < this.minY) this.minY = y0;
        if (y1 > this.maxY) this.maxY = y1;
        for (let py = y0; py <= y1; py++) {
          const row = py * this.w;
          for (let px = x0; px <= x1; px++) {
            this.layer[row + px] = c;
          }
        }
      } else {
        const u32 = PALETTE_U32[colIdx & 15];
        for (let py = y0; py <= y1; py++) {
          this.pixels.fill(u32, py * this.w + x0, py * this.w + x1 + 1);
        }
      }
    }

    rectOutline(x, y, rw, rh, colIdx) {
      this.fillRect(x, y, rw, 1, colIdx);
      this.fillRect(x, y + rh - 1, rw, 1, colIdx);
      this.fillRect(x, y, 1, rh, colIdx);
      this.fillRect(x + rw - 1, y, 1, rh, colIdx);
    }

    fillEllipse(cx, cy, rx, ry, colIdx) {
      if (colIdx < 0 || rx <= 0 || ry <= 0) return;
      const icx = Math.round(cx);
      const icy = Math.round(cy);
      const irx = Math.max(1, Math.round(rx));
      const iry = Math.max(1, Math.round(ry));
      const rx2 = (irx + 0.35) * (irx + 0.35);
      const ry2 = (iry + 0.35) * (iry + 0.35);
      for (let dy = -iry; dy <= iry; dy++) {
        const ny = (dy * dy) / ry2;
        if (ny > 1) continue;
        const maxDx = Math.floor(Math.sqrt((1 - ny) * rx2));
        this.fillRect(icx - maxDx, icy + dy, maxDx * 2 + 1, 1, colIdx);
      }
    }

    ellipseRing(cx, cy, rx, ry, colIdx) {
      if (colIdx < 0 || rx <= 0 || ry <= 0) return;
      const steps = Math.max(24, Math.ceil((rx + ry) * 4));
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        this.pset(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, colIdx);
      }
    }

    line(x0, y0, x1, y1, colIdx, thickness = 1) {
      let ix0 = Math.round(x0) | 0;
      let iy0 = Math.round(y0) | 0;
      const ix1 = Math.round(x1) | 0;
      const iy1 = Math.round(y1) | 0;
      const dx = Math.abs(ix1 - ix0);
      const sx = ix0 < ix1 ? 1 : -1;
      const dy = -Math.abs(iy1 - iy0);
      const sy = iy0 < iy1 ? 1 : -1;
      let err = dx + dy;
      const r = Math.floor(thickness / 2);
      while (true) {
        if (thickness <= 1) {
          this.pset(ix0, iy0, colIdx);
        } else {
          this.fillEllipse(ix0, iy0, r, r, colIdx);
        }
        if (ix0 === ix1 && iy0 === iy1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
          err += dy;
          ix0 += sx;
        }
        if (e2 <= dx) {
          err += dx;
          iy0 += sy;
        }
      }
    }

    // Draw ASCII pixel sprite array using character map
    drawMap(cx, cy, rows, charMap, flipX = false) {
      const h = rows.length;
      const w = rows[0].length;
      const startX = Math.round(cx - w / 2);
      const startY = Math.round(cy - h / 2);
      for (let y = 0; y < h; y++) {
        const row = rows[y];
        for (let x = 0; x < w; x++) {
          const ch = row[flipX ? w - 1 - x : x];
          const col = charMap[ch];
          if (col !== undefined && col >= 0) {
            this.pset(startX + x, startY + y, col);
          }
        }
      }
    }

    present(ctx) {
      ctx.putImageData(this.imageData, 0, 0);
    }
  }

  window.PALETTE_HEX = PALETTE_HEX;
  window.PixelBuffer = PixelBuffer;
})();
