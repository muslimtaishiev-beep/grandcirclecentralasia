/**
 * Сертификат о результатах вступительного среза — A4, по образцу IELTS.
 *
 * Открывается в отдельном окне и печатается или сохраняется в PDF. Печать
 * идёт из окна, а не через библиотеку конвертации, потому что браузер сам
 * умеет A4 с полями и разрывами страниц — а лишняя зависимость на 300 КБ
 * ради одного документа этого не стоит.
 *
 * Что на листе: фотография ученика, балл по пятибалльной шкале отдельно по
 * математике и английскому, проценты, SAT-эквивалент по математике, класс
 * зачисления и печать.
 */

export interface CertificateData {
  studentName: string;
  shortId: string;
  grade: number | string;
  photo?: string | null;
  correct: number;
  total: number;
  percent: number;
  satMath?: number | null;
  assignedClass?: string | null;
  sections?: {
    key: string; title: string; correct: number; total: number; percent: number;
  }[];
  finishedAt?: any;
  schoolName?: string;
}

/**
 * Процент → балл по пятибалльной шкале с половинками, как band score в IELTS.
 * Минимум 1.0: сертификат выдаётся за сданный экзамен, а ноль на бланке
 * читается как «не сдавал», что неверно.
 */
export function bandScore(percent: number): number {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  return Math.max(1, Math.min(5, Math.round((p / 100) * 4 * 2) / 2 + 1));
}

const fmtBand = (n: number) => n.toFixed(1);

const esc = (v: unknown) => String(v ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function fmtDate(v: any): string {
  try {
    const d = v?.toDate ? v.toDate() : v?._seconds ? new Date(v._seconds * 1000) : v ? new Date(v) : new Date();
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return new Date().toLocaleDateString("ru-RU"); }
}

/** Собирает разметку сертификата. Открытие окна — отдельно, см. openCertificate. */
export function certificateHTML(data: CertificateData, stampUrl = "/stamp.png"): string {
  const math = (data.sections || []).find(s => s.key === "math");
  const eng = (data.sections || []).find(s => s.key === "english");
  const overall = bandScore(data.percent);

  const scoreRow = (label: string, sec: { correct: number; total: number; percent: number } | undefined, sat?: number | null) => {
    if (!sec) return "";
    return `<tr>
      <td class="subject">${esc(label)}</td>
      <td class="band">${fmtBand(bandScore(sec.percent))}</td>
      <td class="pct">${sec.percent}%</td>
      <td class="raw">${sec.correct} / ${sec.total}</td>
      <td class="sat">${sat != null ? sat : "—"}</td>
    </tr>`;
  };

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<title>Сертификат ${esc(data.shortId)} — ${esc(data.studentName)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #f1f2f4;
    font-family: "Times New Roman", Georgia, serif; color: #14181f;
  }
  .sheet {
    width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff;
    padding: 18mm 16mm 14mm; position: relative;
  }
  @media print { body { background: #fff; } .sheet { margin: 0; box-shadow: none; } .noprint { display: none !important; } }
  @media screen { .sheet { box-shadow: 0 2px 20px rgba(0,0,0,.15); margin: 16px auto; } }

  .head { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 3px double #14181f; padding-bottom: 10mm; }
  .school { font-size: 13pt; font-weight: bold; letter-spacing: .02em; }
  .doctype { font-size: 9pt; color: #55606e; margin-top: 2mm; letter-spacing: .12em; text-transform: uppercase; }
  .refno { text-align: right; font-size: 9pt; color: #55606e; font-family: ui-monospace, monospace; }

  h1 { font-size: 20pt; text-align: center; letter-spacing: .06em;
       text-transform: uppercase; margin: 10mm 0 2mm; font-weight: normal; }
  .subtitle { text-align: center; font-size: 10pt; color: #55606e; margin-bottom: 9mm; }

  .person { display: grid; grid-template-columns: 32mm 1fr; gap: 8mm; margin-bottom: 8mm; }
  .photo { width: 32mm; height: 40mm; border: 1px solid #b8bdc4; object-fit: cover; background: #eef0f3; }
  .photo-empty { width: 32mm; height: 40mm; border: 1px dashed #c8ccd2; display: grid;
                 place-items: center; font-size: 8pt; color: #9aa0a8; text-align: center; padding: 4mm; }
  .fields div { display: flex; border-bottom: 1px solid #e6e8eb; padding: 2.6mm 0; font-size: 10.5pt; }
  .fields span:first-child { width: 46mm; color: #55606e; }
  .fields span:last-child { font-weight: bold; }

  table.scores { width: 100%; border-collapse: collapse; margin: 2mm 0 8mm; }
  table.scores th { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em;
    color: #55606e; font-weight: normal; padding: 0 3mm 2.5mm; text-align: center; border-bottom: 1.5px solid #14181f; }
  table.scores th:first-child { text-align: left; }
  table.scores td { padding: 3.5mm 3mm; border-bottom: 1px solid #e6e8eb; text-align: center; font-size: 11pt; }
  td.subject { text-align: left; font-size: 11pt; }
  td.band { font-size: 17pt; font-weight: bold; }
  td.pct, td.raw { color: #3c4654; }
  td.sat { font-family: ui-monospace, monospace; font-weight: bold; }
  tr.overall td { border-top: 2px solid #14181f; border-bottom: none; padding-top: 4mm; font-weight: bold; }

  .placement { border: 2px solid #14181f; padding: 6mm 8mm; margin: 2mm 0 8mm;
               display: flex; justify-content: space-between; align-items: center; }
  .placement .label { font-size: 9pt; text-transform: uppercase; letter-spacing: .1em; color: #55606e; }
  .placement .value { font-size: 26pt; font-weight: bold; letter-spacing: .04em; }

  .scale { font-size: 8.5pt; color: #55606e; line-height: 1.55; border-top: 1px solid #e6e8eb; padding-top: 4mm; }
  .scale b { color: #14181f; }

  .foot { position: absolute; left: 16mm; right: 16mm; bottom: 14mm;
          display: flex; justify-content: space-between; align-items: flex-end; }
  .sign { width: 62mm; }
  .sign .line { border-top: 1px solid #14181f; margin-bottom: 1.5mm; }
  .sign .who { font-size: 8.5pt; color: #55606e; }
  .stamp { width: 34mm; height: 34mm; object-fit: contain; opacity: .92; }
  .issued { font-size: 8.5pt; color: #55606e; text-align: right; }

  .toolbar { text-align: center; padding: 12px; }
  .toolbar button { font-family: system-ui, sans-serif; font-size: 14px; padding: 10px 22px;
    border-radius: 8px; border: 0; background: #1f2937; color: #fff; cursor: pointer; margin: 0 4px; }
  .toolbar button.ghost { background: #fff; color: #1f2937; border: 1px solid #c8ccd2; }
</style></head><body>

<div class="toolbar noprint">
  <button onclick="window.print()">Печать / сохранить PDF</button>
  <button class="ghost" onclick="window.close()">Закрыть</button>
</div>

<div class="sheet">
  <div class="head">
    <div>
      <div class="school">${esc(data.schoolName || "Академия Будущих Лидеров")}</div>
      <div class="doctype">Вступительный срез знаний</div>
    </div>
    <div class="refno">
      № ${esc(data.shortId)}<br>
      ${esc(fmtDate(data.finishedAt))}
    </div>
  </div>

  <h1>Сертификат</h1>
  <p class="subtitle">о результатах вступительного тестирования</p>

  <div class="person">
    ${data.photo
      ? `<img class="photo" src="${data.photo}" alt="Фотография">`
      : `<div class="photo-empty">фотография<br>не предоставлена</div>`}
    <div class="fields">
      <div><span>Фамилия и имя</span><span>${esc(data.studentName)}</span></div>
      <div><span>Класс поступления</span><span>${esc(data.grade)}</span></div>
      <div><span>Номер работы</span><span>${esc(data.shortId)}</span></div>
      <div><span>Дата экзамена</span><span>${esc(fmtDate(data.finishedAt))}</span></div>
    </div>
  </div>

  <table class="scores">
    <thead><tr>
      <th>Раздел</th><th>Балл</th><th>Процент</th><th>Верных</th><th>SAT</th>
    </tr></thead>
    <tbody>
      ${scoreRow("Математика", math, data.satMath)}
      ${scoreRow("Английский язык", eng, null)}
      <tr class="overall">
        <td class="subject">Общий результат</td>
        <td class="band">${fmtBand(overall)}</td>
        <td class="pct">${data.percent}%</td>
        <td class="raw">${data.correct} / ${data.total}</td>
        <td class="sat">${data.satMath != null ? data.satMath : "—"}</td>
      </tr>
    </tbody>
  </table>

  ${data.assignedClass ? `<div class="placement">
    <span class="label">Зачислен в класс</span>
    <span class="value">${esc(data.assignedClass)}</span>
  </div>` : ""}

  <div class="scale">
    <b>Шкала оценивания.</b> Балл выставляется по пятибалльной шкале с шагом 0,5
    и отражает долю верных ответов раздела. <b>SAT</b> — эквивалент результата по
    математике в шкале 200–800 с учётом сложности заданий: верный ответ на сложное
    задание весит больше, чем на простое.
  </div>

  <div class="foot">
    <div class="sign">
      <div class="line"></div>
      <div class="who">Заместитель директора по учебной работе</div>
    </div>
    <img class="stamp" src="${stampUrl}" alt="">
    <div class="issued">
      Документ сформирован автоматически<br>
      ${esc(new Date().toLocaleDateString("ru-RU"))}
    </div>
  </div>
</div>
</body></html>`;
}

/**
 * Открывает сертификат для просмотра и печати.
 *
 * Возвращает false, только если показать сертификат не удалось совсем.
 *
 * Раньше здесь был один window.open с пустым URL и document.write. Телефонные
 * браузеры (и Safari по умолчанию) блокируют такие окна молча, кнопка казалась
 * сломанной, а сообщение об этом рендерилось в скрытом блоке формы — ученик не
 * видел вообще ничего. Теперь при блокировке пробуем blob-ссылку, а решение,
 * что показать при полном провале, принимает вызывающая сторона.
 */
export function openCertificate(data: CertificateData, stampUrl = "/stamp.png"): boolean {
  const html = certificateHTML(data, stampUrl);

  const w = window.open("", "_blank", "width=900,height=1180");
  if (w && w.document) {
    w.document.write(html);
    w.document.close();
    return true;
  }

  // Окно заблокировано: отдаём тот же документ как blob. Это обычная навигация,
  // и всплывающими окнами она не считается.
  try {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const opened = window.open(url, "_blank");
    if (opened) {
      // Освобождаем не сразу: окно ещё читает документ по этой ссылке.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    }
    URL.revokeObjectURL(url);
  } catch {
    // Blob недоступен — падаем в false, вызывающая сторона покажет запасной вид.
  }
  return false;
}
