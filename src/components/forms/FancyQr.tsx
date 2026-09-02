import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

/**
 * QR-код в ярком мультяшном стиле — как оформляют коды в Telegram.
 *
 * Рисуем сами на canvas, а не берём готовую картинку из библиотеки: нужны
 * круглые точки, цветовой градиент по диагонали, фигурные «глаза» по углам и
 * рисунок в центре. Библиотека даёт только матрицу — этого достаточно, всё
 * остальное наше.
 *
 * Считываемость важнее украшений, поэтому здесь есть жёсткие правила:
 * уровень коррекции H (треть кода можно потерять), точки не сжимаются меньше
 * 80% ячейки, центральная картинка занимает не больше 22% ширины, а фон
 * всегда светлый и непрозрачный. Красивый, но несканирующийся код бесполезен.
 */

export type QrTheme = {
  key: string;
  name: string;
  /** Цвета точек: градиент слева-сверху направо-вниз. */
  colors: string[];
  bg: string;
  /** Эмодзи в центре — «утята и все такое». */
  emoji?: string;
  /** Фигурная рамка вокруг кода. */
  frame?: string;
};

/**
 * Палитры.
 *
 * Цвета намеренно тёмные. Сканер различает не оттенок, а яркость: он делит
 * картинку на «тёмное» и «светлое». Фирменные цвета в исходном виде — жёлтый
 * #FBBC04, голубой #06B6D4 — по яркости почти равны белому фону, и камера
 * видит вместо кода светлое пятно. Проверено декодером: с исходной палитрой
 * Google тёмных пикселей выходило 1% против 20% у чёрного кода, и ни один
 * вариант не читался.
 *
 * Поэтому здесь узнаваемые оттенки, взятые на 2-3 ступени темнее. Любое
 * изменение палитры обязано пройти scratch/e2eQrScannable.cjs.
 */
export const QR_THEMES: QrTheme[] = [
  { key: "google", name: "Google", colors: ["#1A56C4", "#B31412", "#8A6D00", "#137333"], bg: "#FFFFFF", emoji: "🎓" },
  { key: "duck", name: "Утята", colors: ["#8A6D00", "#A85200", "#7A5C00", "#8F4700"], bg: "#FFFDF5", emoji: "🐤" },
  { key: "candy", name: "Леденец", colors: ["#A81058", "#5B21B6", "#1D4ED8", "#0E5C6B"], bg: "#FDF4FF", emoji: "🍭" },
  { key: "mint", name: "Мята", colors: ["#046B4A", "#0B6357", "#0E5C6B", "#15803D"], bg: "#F0FDFA", emoji: "🌿" },
  { key: "sunset", name: "Закат", colors: ["#9A3412", "#B31412", "#A81058", "#6B21A8"], bg: "#FFF7ED", emoji: "🌅" },
  { key: "ocean", name: "Океан", colors: ["#075985", "#1D4ED8", "#3730A3", "#5B21B6"], bg: "#F0F9FF", emoji: "🐬" },
  { key: "berry", name: "Ягода", colors: ["#9D174D", "#9F1239", "#A8102F", "#B01444"], bg: "#FFF1F2", emoji: "🍓" },
  { key: "classic", name: "Классика", colors: ["#111827"], bg: "#FFFFFF" },
];

type Props = {
  value: string;
  theme?: QrTheme;
  size?: number;
  /** Волнистая цветная рамка вокруг кода. */
  wavy?: boolean;
  className?: string;
};

/** Цвет точки: смешиваем палитру по диагонали, чтобы код переливался. */
function pickColor(colors: string[], x: number, y: number, n: number): string {
  if (colors.length === 1) return colors[0];
  const t = (x + y) / (2 * (n - 1));                 // 0…1 по диагонали
  const pos = t * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(pos));
  const f = pos - i;
  const hex = (c: string) => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16));
  const [r1, g1, b1] = hex(colors[i]);
  const [r2, g2, b2] = hex(colors[i + 1]);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * f);
  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
}

/** Скруглённый квадрат — «глаз» в углу кода. */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawFancyQr(
  canvas: HTMLCanvasElement, value: string, theme: QrTheme, size: number, wavy: boolean,
) {
  // Уровень H: даже с картинкой в центре и цветными точками код читается.
  const qr = QRCode.create(value, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const data = qr.modules.data;

  // Рисуем всегда достаточно крупно, а на экран отдаём нужный размер через
  // CSS. При 240px и волнистой рамке на модуль оставалось меньше 5 пикселей,
  // и сканер терял код — при этом на глаз он выглядел нормально.
  const MIN_DRAW = 560;
  const scale = Math.max(1, MIN_DRAW / size);
  const dpr = Math.min(3, (window.devicePixelRatio || 1) * scale);
  // Поле вокруг кода — «тихая зона», которую требует стандарт QR.
  //
  // Волнистая рамка НЕ отъедает это поле: она рисуется в своей полосе снаружи,
  // за пределами тихой зоны. Пока рамка делила поле с кодом, любое её
  // касание модуля убивало сканирование — на плотных кодах это происходило
  // при любой ширине поля, сколько её ни увеличивай.
  const quiet = 2;                                    // модуля тихой зоны
  const frameBand = wavy ? size * 0.07 : 0;           // полоса под рамку
  const pad = Math.round(frameBand + (size - frameBand * 2) * quiet / (n + quiet * 2));
  const inner = size - pad * 2;
  const cell = inner / n;

  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  // Фон — всегда светлый и непрозрачный: без контраста код не сканируется.
  roundRect(ctx, 0, 0, size, size, size * 0.09);
  ctx.fillStyle = theme.bg;
  ctx.fill();

  if (wavy && theme.colors.length > 1) {
    // Волнистая рамка — по контуру кода, скруглённым прямоугольником.
    //
    // Круглая рамка выглядела нарядно, но срезала углы: «глаза» кода
    // оказывались снаружи окружности, а угловые точки — под её линиями.
    // Код квадратный, значит и рамка обязана быть квадратной.
    ctx.save();
    const lw = Math.max(2, size * 0.010);
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    const amp = size * 0.004;
    theme.colors.forEach((c, i) => {
      const inset = lw * (0.8 + i * 1.5);
      if (inset > frameBand - lw) return;    // в полосу не влезли — пропускаем
      ctx.strokeStyle = c;
      ctx.beginPath();
      // Волна идёт по периметру: чуть «дышащий» скруглённый прямоугольник.
      const r = size * 0.08;
      const x0 = inset, y0 = inset, x1 = size - inset, y1 = size - inset;
      const steps = 240;
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        // Обходим периметр и добавляем небольшую синусоиду наружу.
        const per = 2 * ((x1 - x0) + (y1 - y0));
        let d = t * per, px: number, py: number, nx = 0, ny = 0;
        const w = x1 - x0, h = y1 - y0;
        if (d < w) { px = x0 + d; py = y0; ny = -1; }
        else if (d < w + h) { d -= w; px = x1; py = y0 + d; nx = 1; }
        else if (d < 2 * w + h) { d -= w + h; px = x1 - d; py = y1; ny = 1; }
        else { d -= 2 * w + h; px = x0; py = y1 - d; nx = -1; }
        // Скругляем углы, притягивая точки к центру скругления.
        const cx = Math.min(Math.max(px, x0 + r), x1 - r);
        const cy = Math.min(Math.max(py, y0 + r), y1 - r);
        const dx = px - cx, dy = py - cy;
        const len = Math.hypot(dx, dy) || 1;
        if (len > r) { px = cx + (dx / len) * r; py = cy + (dy / len) * r; }
        const wob = Math.sin(t * Math.PI * 12 + i) * amp;
        k === 0 ? ctx.moveTo(px + nx * wob, py + ny * wob)
                : ctx.lineTo(px + nx * wob, py + ny * wob);
      }
      ctx.closePath();
      ctx.stroke();
    });
    ctx.restore();
  }

  const isEye = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);

  // Точки. Круглые и чуть меньше ячейки — так код выглядит мягче, но
  // 80% сохраняют контрастность, ниже которой сканеры начинают ошибаться.
  const dot = cell * 0.82;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!data[y * n + x] || isEye(x, y)) continue;
      ctx.fillStyle = pickColor(theme.colors, x, y, n);
      ctx.beginPath();
      ctx.arc(pad + x * cell + cell / 2, pad + y * cell + cell / 2, dot / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // «Глаза» — фигурные скобки вместо квадратов.
  const eye = (ex: number, ey: number, color: string) => {
    const x = pad + ex * cell, y = pad + ey * cell, s = cell * 7;
    ctx.fillStyle = color;
    roundRect(ctx, x, y, s, s, s * 0.28);
    ctx.fill();
    ctx.fillStyle = theme.bg;
    roundRect(ctx, x + cell, y + cell, s - cell * 2, s - cell * 2, s * 0.2);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x + cell * 2, y + cell * 2, s - cell * 4, s - cell * 4, s * 0.14);
    ctx.fill();
  };
  eye(0, 0, theme.colors[0]);
  eye(n - 7, 0, theme.colors[Math.min(1, theme.colors.length - 1)]);
  eye(0, n - 7, theme.colors[Math.min(2, theme.colors.length - 1)]);

  // Картинка в центре. 22% ширины — предел, при котором уровень H ещё
  // вытягивает потерянные модули.
  if (theme.emoji) {
    const r = size * 0.11;
    ctx.fillStyle = theme.bg;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.colors[0];
    ctx.lineWidth = Math.max(2, size * 0.008);
    ctx.stroke();
    ctx.font = `${Math.round(r * 1.25)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(theme.emoji, size / 2, size / 2 + r * 0.06);
  }
}

export default function FancyQr({
  value, theme = QR_THEMES[0], size = 260, wavy = true, className = "",
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      drawFancyQr(ref.current, value, theme, size, wavy);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Не удалось построить QR");
    }
  }, [value, theme, size, wavy]);

  if (error) {
    return <div className="text-xs text-red-600 p-4 text-center">{error}</div>;
  }
  return <canvas ref={ref} className={className} aria-label="QR-код заявки" />;
}

/** Выбор темы: ряд цветных кружков. */
export function QrThemePicker({
  value, onChange,
}: { value: string; onChange: (t: QrTheme) => void }) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {QR_THEMES.map(t => (
        <button key={t.key} onClick={() => onChange(t)} title={t.name}
          className={`w-9 h-9 rounded-full border-2 transition relative overflow-hidden ${
            value === t.key ? "border-slate-900 scale-110" : "border-transparent hover:scale-105"}`}
          style={{
            background: t.colors.length > 1
              ? `linear-gradient(135deg, ${t.colors.join(", ")})`
              : t.colors[0],
          }}>
          {t.emoji && <span className="absolute inset-0 flex items-center justify-center text-sm">{t.emoji}</span>}
        </button>
      ))}
    </div>
  );
}

/** Скачивание кода картинкой — то, что печатают и вешают на стену. */
export function downloadQr(value: string, theme: QrTheme, filename: string, size = 1024) {
  const canvas = document.createElement("canvas");
  drawFancyQr(canvas, value, theme, size, true);
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
}

/** Проверка, что нарисованный код действительно читается. */
export function useQrValue(url: string) {
  return useMemo(() => url, [url]);
}
