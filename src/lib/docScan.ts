/**
 * Сканирование бумажной страницы в браузере: поиск краёв листа, выравнивание
 * перспективы и сжатие в JPEG. Без внешних библиотек — только canvas.
 */

export interface Pt { x: number; y: number }
/** Углы страницы: верхний левый, верхний правый, нижний правый, нижний левый (пиксели исходника). */
export type Quad = [Pt, Pt, Pt, Pt];

export type ImageSourceLike = CanvasImageSource & { width: number; height: number };

export async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith("image/")) throw new Error("Это не изображение. Выберите фото страницы.");
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Не удалось открыть фото. Попробуйте другой файл.");
  }
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctx2d(c: HTMLCanvasElement, readback = false): CanvasRenderingContext2D {
  const g = c.getContext("2d", readback ? { willReadFrequently: true } : undefined);
  if (!g) throw new Error("Браузер не поддерживает обработку изображений.");
  return g;
}

function insetFrame(w: number, h: number): Quad {
  const mx = w * 0.03, my = h * 0.03;
  return [{ x: mx, y: my }, { x: w - mx, y: my }, { x: w - mx, y: h - my }, { x: mx, y: h - my }];
}

function otsu(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = t; }
  }
  return thr;
}

/** Быстрый поиск листа: самая большая светлая область, не занимающая весь кадр. */
export function detectPageQuad(src: ImageSourceLike): Quad {
  const W = src.width, H = src.height;
  const fallback = insetFrame(W, H);
  try {
    const scale = Math.min(1, 480 / Math.max(W, H));
    const w = Math.max(8, Math.round(W * scale)), h = Math.max(8, Math.round(H * scale));
    const c = makeCanvas(w, h);
    const g = ctx2d(c, true);
    g.drawImage(src, 0, 0, w, h);
    const data = g.getImageData(0, 0, w, h).data;
    c.width = c.height = 1;

    const gray = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
    }
    // Размытие 3x3 (две прохода по осям)
    const tmp = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = gray[y * w + Math.max(0, x - 1)], b = gray[y * w + x], d = gray[y * w + Math.min(w - 1, x + 1)];
        tmp[y * w + x] = (a + b + b + d) >> 2;
      }
    }
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - 1) * w, y1 = y * w, y2 = Math.min(h - 1, y + 1) * w;
      for (let x = 0; x < w; x++) gray[y1 + x] = (tmp[y0 + x] + tmp[y1 + x] + tmp[y1 + x] + tmp[y2 + x]) >> 2;
    }

    const thr = otsu(gray);
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = gray[i] > thr ? 1 : 0;

    // Связные компоненты (4-связность, стек)
    const total = w * h;
    const stack = new Int32Array(total);
    let bestArea = 0;
    let bTL = 0, bBR = 0, bTR = 0, bBL = 0;
    let bx = [0, 0, 0, 0], by = [0, 0, 0, 0];
    for (let start = 0; start < total; start++) {
      if (mask[start] !== 1) continue;
      let sp = 0, area = 0;
      let minS = Infinity, maxS = -Infinity, minD = Infinity, maxD = -Infinity;
      let iTL = 0, iBR = 0, iTR = 0, iBL = 0;
      stack[sp++] = start;
      mask[start] = 2;
      while (sp > 0) {
        const idx = stack[--sp];
        const x = idx % w, y = (idx - x) / w;
        area++;
        const s = x + y, d = x - y;
        if (s < minS) { minS = s; iTL = idx; }
        if (s > maxS) { maxS = s; iBR = idx; }
        if (d > maxD) { maxD = d; iTR = idx; }
        if (d < minD) { minD = d; iBL = idx; }
        if (x > 0 && mask[idx - 1] === 1) { mask[idx - 1] = 2; stack[sp++] = idx - 1; }
        if (x < w - 1 && mask[idx + 1] === 1) { mask[idx + 1] = 2; stack[sp++] = idx + 1; }
        if (y > 0 && mask[idx - w] === 1) { mask[idx - w] = 2; stack[sp++] = idx - w; }
        if (y < h - 1 && mask[idx + w] === 1) { mask[idx + w] = 2; stack[sp++] = idx + w; }
      }
      if (area > bestArea && area < total * 0.95) {
        bestArea = area; bTL = iTL; bBR = iBR; bTR = iTR; bBL = iBL;
        bx = [bTL % w, bTR % w, bBR % w, bBL % w];
        by = [Math.floor(bTL / w), Math.floor(bTR / w), Math.floor(bBR / w), Math.floor(bBL / w)];
      }
    }
    if (bestArea < total * 0.2) return fallback;

    const sx = W / w, sy = H / h;
    const quad = [0, 1, 2, 3].map((i): Pt => ({
      x: Math.min(W, Math.max(0, (bx[i] + 0.5) * sx)),
      y: Math.min(H, Math.max(0, (by[i] + 0.5) * sy)),
    })) as Quad;
    // Четырёхугольник должен быть заметным по площади (формула Гаусса)
    let a2 = 0;
    for (let i = 0; i < 4; i++) { const p = quad[i], q = quad[(i + 1) % 4]; a2 += p.x * q.y - q.x * p.y; }
    if (Math.abs(a2) / 2 < W * H * 0.2) return fallback;
    return quad;
  } catch {
    return fallback;
  }
}

function dist(a: Pt, b: Pt): number { return Math.hypot(a.x - b.x, a.y - b.y); }

/** Решение системы Ax=b (n×n) методом Гаусса с выбором главного элемента. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]];
    [b[i], b[piv]] = [b[piv], b[i]];
    const p = A[i][i];
    if (Math.abs(p) < 1e-12) throw new Error("Углы выбраны неверно: страница вырождена.");
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / p;
      if (f === 0) continue;
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
    x[i] = s / A[i][i];
  }
  return x;
}

/** Гомография 3×3 (h33 = 1) из прямоугольника 0..w × 0..h в четырёхугольник. */
export function homographyRectToQuad(w: number, h: number, q: Quad): number[] {
  const dst: Pt[] = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i];
    const { x: u, y: v } = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  return solveLinear(A, b);
}

export function warpQuad(src: ImageSourceLike, quad: Quad, maxSide: number): HTMLCanvasElement {
  const top = dist(quad[0], quad[1]), bottom = dist(quad[3], quad[2]);
  const left = dist(quad[0], quad[3]), right = dist(quad[1], quad[2]);
  let outW = (top + bottom) / 2, outH = (left + right) / 2;
  const k = Math.min(1, maxSide / Math.max(outW, outH));
  outW = Math.max(16, Math.round(outW * k));
  outH = Math.max(16, Math.round(outH * k));

  const sw = src.width, sh = src.height;
  const sc = makeCanvas(sw, sh);
  const sg = ctx2d(sc, true);
  sg.drawImage(src, 0, 0);
  const sdata = sg.getImageData(0, 0, sw, sh).data;
  sc.width = sc.height = 1;

  const H = homographyRectToQuad(outW, outH, quad);
  const out = makeCanvas(outW, outH);
  const og = ctx2d(out);
  const img = og.createImageData(outW, outH);
  const o32 = new Uint32Array(img.data.buffer);
  const maxX = sw - 1, maxY = sh - 1;
  const [h0, h1, h2, h3, h4, h5, h6, h7] = H;

  for (let y = 0; y < outH; y++) {
    const yc = y + 0.5;
    const rowOff = y * outW;
    for (let x = 0; x < outW; x++) {
      const xc = x + 0.5;
      const den = h6 * xc + h7 * yc + 1;
      let u = (h0 * xc + h1 * yc + h2) / den - 0.5;
      let v = (h3 * xc + h4 * yc + h5) / den - 0.5;
      if (u < 0) u = 0; else if (u > maxX) u = maxX;
      if (v < 0) v = 0; else if (v > maxY) v = maxY;
      const x0 = u | 0, y0 = v | 0;
      const x1 = x0 < maxX ? x0 + 1 : x0, y1 = y0 < maxY ? y0 + 1 : y0;
      const fx = u - x0, fy = v - y0;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const p00 = (y0 * sw + x0) << 2, p10 = (y0 * sw + x1) << 2;
      const p01 = (y1 * sw + x0) << 2, p11 = (y1 * sw + x1) << 2;
      const r = sdata[p00] * w00 + sdata[p10] * w10 + sdata[p01] * w01 + sdata[p11] * w11;
      const g = sdata[p00 + 1] * w00 + sdata[p10 + 1] * w10 + sdata[p01 + 1] * w01 + sdata[p11 + 1] * w11;
      const b = sdata[p00 + 2] * w00 + sdata[p10 + 2] * w10 + sdata[p01 + 2] * w01 + sdata[p11 + 2] * w11;
      o32[rowOff + x] = 0xff000000 | (((b + 0.5) | 0) << 16) | (((g + 0.5) | 0) << 8) | ((r + 0.5) | 0);
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}

/** Поворот на 90° по часовой стрелке. */
export function rotate90(src: ImageSourceLike): HTMLCanvasElement {
  const out = makeCanvas(src.height, src.width);
  const g = ctx2d(out);
  g.translate(out.width, 0);
  g.rotate(Math.PI / 2);
  g.drawImage(src, 0, 0);
  return out;
}

/** JPEG data URL не длиннее maxBytes·1.37 символов и не больше maxSide по длинной стороне. */
export function canvasToJpeg(canvas: HTMLCanvasElement, maxSide: number, maxBytes: number): string {
  const limit = maxBytes * 1.37;
  let scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  let last = "";
  for (let attempt = 0; attempt < 12; attempt++) {
    const w = Math.max(1, Math.round(canvas.width * scale));
    const h = Math.max(1, Math.round(canvas.height * scale));
    const c = makeCanvas(w, h);
    const g = ctx2d(c);
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    g.drawImage(canvas, 0, 0, w, h);
    for (let q = 0.9; q >= 0.39; q -= 0.1) {
      last = c.toDataURL("image/jpeg", Math.round(q * 10) / 10);
      if (last.length <= limit) { c.width = c.height = 1; return last; }
    }
    c.width = c.height = 1;
    scale *= 0.85;
  }
  return last;
}
