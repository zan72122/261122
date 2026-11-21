// Pure integer-pixel 16-color indexed framebuffer with 1px outline & sprite stacking
(function (global) {
  'use strict';

  const PP = global.PP;
  const PAL = PP.PAL;
  const RGBA32 = PP.RGBA32;

  class PixelBuffer {
    constructor(w, h) {
      this.w = w | 0;
      this.h = h | 0;
      this.buf = new Uint8Array(this.w * this.h);
      this.imgData = null;
      this.u32 = null;
      // Scratch buffer for outlined dynamic shapes
      this.scratch = new Uint8Array(this.w * this.h);
      this.scratch.fill(255);
      this.scratchMinX = this.w;
      this.scratchMinY = this.h;
      this.scratchMaxX = -1;
      this.scratchMaxY = -1;
    }

    resize(w, h) {
      w |= 0;
      h |= 0;
      if (w === this.w && h === this.h) return;
      this.w = w;
      this.h = h;
      this.buf = new Uint8Array(w * h);
      this.scratch = new Uint8Array(w * h);
      this.scratch.fill(255);
      this.scratchMinX = w;
      this.scratchMinY = h;
      this.scratchMaxX = -1;
      this.scratchMaxY = -1;
      this.imgData = null;
      this.u32 = null;
    }

    clear(c) {
      this.buf.fill(c & 15);
    }

    px(x, y, c) {
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.buf[y * this.w + x] = c;
    }

    getPx(x, y) {
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 255;
      return this.buf[y * this.w + x];
    }

    rect(x, y, w, h, c) {
      let x0 = Math.max(0, x | 0);
      let y0 = Math.max(0, y | 0);
      let x1 = Math.min(this.w, (x | 0) + (w | 0));
      let y1 = Math.min(this.h, (y | 0) + (h | 0));
      for (let yy = y0; yy < y1; yy++) {
        const row = yy * this.w;
        for (let xx = x0; xx < x1; xx++) {
          this.buf[row + xx] = c;
        }
      }
    }

    rectOutline(x, y, w, h, fill, outline) {
      this.rect(x, y, w, h, outline);
      if (w > 2 && h > 2) {
        this.rect(x + 1, y + 1, w - 2, h - 2, fill);
      }
    }

    hline(x0, x1, y, c) {
      y |= 0;
      if (y < 0 || y >= this.h) return;
      let a = Math.max(0, Math.min(x0 | 0, x1 | 0));
      let b = Math.min(this.w - 1, Math.max(x0 | 0, x1 | 0));
      const row = y * this.w;
      for (let x = a; x <= b; x++) this.buf[row + x] = c;
    }

    vline(x, y0, y1, c) {
      x |= 0;
      if (x < 0 || x >= this.w) return;
      let a = Math.max(0, Math.min(y0 | 0, y1 | 0));
      let b = Math.min(this.h - 1, Math.max(y0 | 0, y1 | 0));
      for (let y = a; y <= b; y++) this.buf[y * this.w + x] = c;
    }

    line(x0, y0, x1, y1, c, thickness) {
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
      let dx = Math.abs(x1 - x0);
      let dy = -Math.abs(y1 - y0);
      let sx = x0 < x1 ? 1 : -1;
      let sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      const t = thickness || 1;
      while (true) {
        if (t <= 1) {
          this.px(x0, y0, c);
        } else {
          const r = (t - 1) >> 1;
          this.rect(x0 - r, y0 - r, t, t, c);
        }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }

    ellipse(cx, cy, rx, ry, c) {
      cx = Math.round(cx);
      cy = Math.round(cy);
      rx = Math.max(0.5, rx);
      ry = Math.max(0.5, ry);
      const erx = rx + 0.35;
      const ery = ry + 0.35;
      const irx = Math.ceil(rx);
      const iry = Math.ceil(ry);
      const y0 = Math.max(0, cy - iry);
      const y1 = Math.min(this.h - 1, cy + iry);
      const x0 = Math.max(0, cx - irx);
      const x1 = Math.min(this.w - 1, cx + irx);
      const invRx2 = 1 / (erx * erx);
      const invRy2 = 1 / (ery * ery);
      for (let y = y0; y <= y1; y++) {
        const dy = y - cy;
        const dy2 = dy * dy * invRy2;
        if (dy2 > 1.0) continue;
        const row = y * this.w;
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx;
          if (dx * dx * invRx2 + dy2 <= 1.0) {
            this.buf[row + x] = c;
          }
        }
      }
    }

    circle(cx, cy, r, c) {
      this.ellipse(cx, cy, r, r, c);
    }

    // --- Scratch layer for guaranteed crisp 1px dark outline around composite/dynamic shapes ---
    beginScratch() {
      if (this.scratchMaxX >= this.scratchMinX && this.scratchMaxY >= this.scratchMinY) {
        for (let y = this.scratchMinY; y <= this.scratchMaxY; y++) {
          const row = y * this.w;
          for (let x = this.scratchMinX; x <= this.scratchMaxX; x++) {
            this.scratch[row + x] = 255;
          }
        }
      } else {
        this.scratch.fill(255);
      }
      this.scratchMinX = this.w;
      this.scratchMinY = this.h;
      this.scratchMaxX = -1;
      this.scratchMaxY = -1;
    }

    spx(x, y, c) {
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.scratch[y * this.w + x] = c;
      if (x < this.scratchMinX) this.scratchMinX = x;
      if (x > this.scratchMaxX) this.scratchMaxX = x;
      if (y < this.scratchMinY) this.scratchMinY = y;
      if (y > this.scratchMaxY) this.scratchMaxY = y;
    }

    sRect(x, y, w, h, c) {
      const x0 = Math.max(0, x | 0);
      const y0 = Math.max(0, y | 0);
      const x1 = Math.min(this.w, (x | 0) + (w | 0));
      const y1 = Math.min(this.h, (y | 0) + (h | 0));
      if (x0 >= x1 || y0 >= y1) return;
      if (x0 < this.scratchMinX) this.scratchMinX = x0;
      if (x1 - 1 > this.scratchMaxX) this.scratchMaxX = x1 - 1;
      if (y0 < this.scratchMinY) this.scratchMinY = y0;
      if (y1 - 1 > this.scratchMaxY) this.scratchMaxY = y1 - 1;
      for (let yy = y0; yy < y1; yy++) {
        const row = yy * this.w;
        for (let xx = x0; xx < x1; xx++) {
          this.scratch[row + xx] = c;
        }
      }
    }

    sEllipse(cx, cy, rx, ry, c, fn) {
      cx = Math.round(cx);
      cy = Math.round(cy);
      rx = Math.max(0.5, rx);
      ry = Math.max(0.5, ry);
      const erx = rx + 0.35;
      const ery = ry + 0.35;
      const irx = Math.ceil(rx);
      const iry = Math.ceil(ry);
      const y0 = Math.max(0, cy - iry);
      const y1 = Math.min(this.h - 1, cy + iry);
      const x0 = Math.max(0, cx - irx);
      const x1 = Math.min(this.w - 1, cx + irx);
      if (x0 > x1 || y0 > y1) return;
      const invRx2 = 1 / (erx * erx);
      const invRy2 = 1 / (ery * ery);
      for (let y = y0; y <= y1; y++) {
        const dy = y - cy;
        const dy2 = dy * dy * invRy2;
        if (dy2 > 1.0) continue;
        const row = y * this.w;
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx;
          const dist2 = dx * dx * invRx2 + dy2;
          if (dist2 <= 1.0) {
            const col = fn ? fn(x, y, dx, dy, dist2) : c;
            if (col !== 255) {
              this.scratch[row + x] = col;
              if (x < this.scratchMinX) this.scratchMinX = x;
              if (x > this.scratchMaxX) this.scratchMaxX = x;
              if (y < this.scratchMinY) this.scratchMinY = y;
              if (y > this.scratchMaxY) this.scratchMaxY = y;
            }
          }
        }
      }
    }

    sLine(x0, y0, x1, y1, c, thickness) {
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
      let dx = Math.abs(x1 - x0);
      let dy = -Math.abs(y1 - y0);
      let sx = x0 < x1 ? 1 : -1;
      let sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      const t = thickness || 1;
      const r = (t - 1) >> 1;
      while (true) {
        if (t <= 1) {
          this.spx(x0, y0, c);
        } else {
          this.sRect(x0 - r, y0 - r, t, t, c);
        }
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }

    // Stamp scratch buffer onto main framebuffer with a crisp 1px outline around all non-transparent pixels
    commitScratch(outlineColor) {
      if (this.scratchMaxX < this.scratchMinX) return;
      const oc = outlineColor !== undefined ? outlineColor : PAL.INK;
      const x0 = Math.max(0, this.scratchMinX - 1);
      const y0 = Math.max(0, this.scratchMinY - 1);
      const x1 = Math.min(this.w - 1, this.scratchMaxX + 1);
      const y1 = Math.min(this.h - 1, this.scratchMaxY + 1);
      const s = this.scratch;
      const b = this.buf;
      const W = this.w;
      const H = this.h;
      for (let y = y0; y <= y1; y++) {
        const row = y * W;
        for (let x = x0; x <= x1; x++) {
          const val = s[row + x];
          if (val !== 255) {
            b[row + x] = val;
          } else if (oc !== 255) {
            // 4-connected outline check (crisp retro pixel art look, avoids muddy 8-connected corners)
            const hasNeighbor =
              (x > 0 && s[row + x - 1] !== 255) ||
              (x + 1 < W && s[row + x + 1] !== 255) ||
              (y > 0 && s[row - W + x] !== 255) ||
              (y + 1 < H && s[row + W + x] !== 255);
            if (hasNeighbor) {
              b[row + x] = oc;
            }
          }
        }
      }
    }

    // Blit an ASCII pixel-art sprite map with optional flipX & color lookup map
    drawPattern(pattern, x, y, colorMap, flipX, scale) {
      const sc = scale || 1;
      const rows = pattern.length;
      const cols = pattern[0].length;
      const bx = Math.round(x);
      const by = Math.round(y);
      for (let r = 0; r < rows; r++) {
        const line = pattern[r];
        for (let c = 0; c < cols; c++) {
          const ch = line[flipX ? (cols - 1 - c) : c];
          if (ch === '.' || ch === ' ') continue;
          const col = colorMap[ch];
          if (col === undefined || col === 255) continue;
          if (sc === 1) {
            this.px(bx + c, by + r, col);
          } else {
            this.rect(bx + c * sc, by + r * sc, sc, sc, col);
          }
        }
      }
    }

    flush(ctx) {
      if (!this.imgData || this.imgData.width !== this.w || this.imgData.height !== this.h) {
        this.imgData = ctx.createImageData(this.w, this.h);
        this.u32 = new Uint32Array(this.imgData.data.buffer);
      }
      const len = this.buf.length;
      const b = this.buf;
      const out = this.u32;
      for (let i = 0; i < len; i++) {
        out[i] = RGBA32[b[i] & 15];
      }
      ctx.putImageData(this.imgData, 0, 0);
    }
  }

  PP.PixelBuffer = PixelBuffer;
})(window);
