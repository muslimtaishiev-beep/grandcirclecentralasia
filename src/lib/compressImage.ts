/**
 * Сжатие фотографии на клиенте до base64, влезающего в документ Firestore.
 *
 * Хранилища файлов у проекта нет — файлы живут data-URL'ами в документах, как
 * фото на сертификат среза. Снимок с телефона весит 3–8 МБ, лимит поля —
 * 400 КБ, поэтому жмём: уменьшаем до 1280px по большей стороне и снижаем
 * качество JPEG, пока не влезет. Для документа, который сверяют глазами на
 * входе, этого более чем достаточно.
 */
export async function compressImageToDataUrl(
  file: File,
  opts: { maxSide?: number; maxBytes?: number } = {},
): Promise<{ dataUrl: string } | { error: string }> {
  const maxSide = opts.maxSide ?? 1280;
  const maxBytes = opts.maxBytes ?? 400 * 1024;

  if (!file.type.startsWith("image/")) {
    return { error: "Можно приложить только изображение (JPG или PNG)." };
  }

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { error: "Не удалось прочитать изображение — попробуйте другой файл." };

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { error: "Браузер не поддерживает обработку изображений." };
  // Белая подложка: PNG с прозрачностью при конвертации в JPEG иначе чернеет.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // Снижаем качество, пока не влезем; 0.4 — нижняя граница читаемости текста
  // на документе, дальше сжимать нет смысла.
  for (let q = 0.85; q >= 0.4; q -= 0.15) {
    const dataUrl = canvas.toDataURL("image/jpeg", q);
    if (dataUrl.length <= maxBytes) return { dataUrl };
  }
  return { error: "Фото слишком детальное — снимите документ ещё раз при обычном освещении." };
}
