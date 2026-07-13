import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import Barcode from "react-barcode";

export default function Receipt() {
  const { shortId } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const gasUrl = "/api/gas" || "";
        const res = await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getPsychologistStudent", shortId })
        });
        const data = await res.json();
        if (data.success) {
          setStudent(data.student);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudent();
  }, [shortId]);

  if (loading) return <div className="text-center p-10 font-serif">Загрузка данных документа...</div>;
  if (!student) return <div className="text-center p-10 text-red-500 font-serif">Ученик не найден или не направлен к психологу</div>;

  const psychUrl = `https://studyfreeforum.com/psychologist/${shortId}`;

  return (
    <>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-receipt, #printable-receipt * {
              visibility: visible;
            }
            #printable-receipt {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 0;
            }
            @page {
              size: A4 portrait;
              margin: 1cm;
            }
          }
        `}
      </style>
      <div className="min-h-screen bg-gray-200 py-10 px-4 print:bg-white print:p-0 flex flex-col items-center">
        {/* Document Container */}
        <div id="printable-receipt" className="bg-white shadow-2xl p-10 max-w-2xl w-full border border-gray-400 print:shadow-none print:border-none print:w-full print:max-w-none text-black font-serif relative">
        
        {/* Header - Official State Look */}
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-xl font-bold uppercase tracking-wide">ОсОО «Академия Будущих Лидеров»</h1>
          <p className="text-sm mt-1">Кыргызская Республика, г. Бишкек, ул. Турусбекова 109/3</p>
          <div className="mt-4 border-t border-black pt-2 w-3/4 mx-auto">
            <h2 className="text-2xl font-bold uppercase tracking-widest mt-2">Направление № {student.shortId}</h2>
            <p className="text-sm">Для прохождения психологического собеседования</p>
          </div>
        </div>

        <div className="flex justify-between items-start mb-6 text-sm">
          <div>
            <p><strong>Дата выдачи:</strong> {student.date}</p>
            <p><strong>Ответственный менеджер:</strong> {student.managerName}</p>
          </div>
          <div className="text-right">
            <Barcode value={String(student.shortId)} width={2} height={40} displayValue={false} margin={0} />
            <div className="text-center text-xs mt-1 font-mono">{student.shortId}</div>
          </div>
        </div>

        {/* Data Table */}
        <table className="w-full border-collapse border border-black text-sm mb-6">
          <tbody>
            <tr>
              <td className="border border-black p-2 bg-gray-100 font-bold w-1/3">ФИО Ученика:</td>
              <td className="border border-black p-2">{student.childName}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 bg-gray-100 font-bold">ФИО Родителя:</td>
              <td className="border border-black p-2">{student.parentName}</td>
            </tr>
            <tr>
              <td className="border border-black p-2 bg-gray-100 font-bold">Контактный телефон:</td>
              <td className="border border-black p-2">{student.phone}</td>
            </tr>
          </tbody>
        </table>

        {/* Test Results Table */}
        <h3 className="font-bold mb-2 uppercase text-sm border-b border-black inline-block pb-1">Результаты тестирования</h3>
        <table className="w-full border-collapse border border-black text-sm mb-6 text-center">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2">Русский язык</th>
              <th className="border border-black p-2">Математика</th>
              <th className="border border-black p-2">Логика</th>
              <th className="border border-black p-2 font-bold">ИТОГО</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2">{student.ru}</td>
              <td className="border border-black p-2">{student.ma}</td>
              <td className="border border-black p-2">{student.lo}</td>
              <td className="border border-black p-2 font-bold">{(Number(student.ru) || 0) + (Number(student.ma) || 0) + (Number(student.lo) || 0)}</td>
            </tr>
          </tbody>
        </table>

        {student.managerComment && (
          <div className="mb-8">
            <h3 className="font-bold mb-1 text-sm">Особые отметки / Комментарий:</h3>
            <div className="border-b border-black italic text-sm pb-1 min-h-[1.5rem]">
              {student.managerComment}
            </div>
          </div>
        )}

        {/* Footer with QR */}
        <div className="flex justify-between items-end border-t-2 border-black pt-6 mt-10">
          <div className="w-2/3 pr-8">
            <p className="text-xs text-justify leading-tight">
              Настоящее направление действительно только при предъявлении. Направление подлежит передаче штатному психологу Академии для проведения финального этапа вступительного тестирования. 
            </p>
            <div className="mt-8 text-sm">
              <div className="flex items-end mb-4">
                <span className="w-1/3">Подпись менеджера:</span>
                <div className="w-2/3 border-b border-black"></div>
              </div>
              <div className="flex items-end">
                <span className="w-1/3">М.П.</span>
                <div className="w-2/3"></div>
              </div>
            </div>
          </div>
          
          <div className="w-1/3 flex flex-col items-center text-center">
            <p className="text-[10px] uppercase font-bold mb-2">Для сканирования психологом</p>
            <div className="border border-black p-2 bg-white inline-block">
              <QRCodeCanvas value={psychUrl} size={110} level="M" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Print Button and Explanations (hidden when printing) */}
      <div className="mt-8 print:hidden">
        <button onClick={() => window.print()} className="bg-black text-white px-8 py-3 rounded uppercase font-bold tracking-wider hover:bg-gray-800 transition shadow-lg mb-8">
          Распечатать документ
        </button>
        
        {String(student.grade) === "11" && (
          <div className="mt-8 space-y-6">
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200 text-left">
              <h3 className="text-lg font-bold mb-3 text-slate-800 flex items-center">
                <span className="mr-2">📝</span> Разбор задания №2 по русскому языку
              </h3>
              <div className="text-sm text-slate-700 space-y-3">
                <p><strong>Правильный ответ:</strong> 2 — наличие (или наличии)</p>
                <div>
                  <strong>Почему здесь ошибка?</strong>
                  <p className="mt-1">Слово <em>наличность</em> означает имеющиеся в наличии деньги (преимущественно бумажные или монеты), например: «проверить наличность в кассе».</p>
                  <p className="mt-1">Если речь идет о присутствии, существовании чего-либо (в данном случае — книг в фонде), необходимо использовать пароним <em>наличие</em>: «сведения о наличии новых поступлений».</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200 text-left">
              <h3 className="text-lg font-bold mb-3 text-slate-800 flex items-center">
                <span className="mr-2">📝</span> Разбор задания №8 по русскому языку
              </h3>
              <div className="text-sm text-slate-700 space-y-3">
                <p><strong>Правильный ответ:</strong> 4 — КВЕРХУ ТОТЧАС</p>
                <div>
                  <strong>Подробный разбор по предложениям:</strong>
                  <ul className="mt-2 space-y-2 list-disc pl-5">
                    <li><strong>Несмотря</strong> (слитно, так как это производный предлог со значением уступки) — <strong>всё-таки</strong> (через дефис, частица -таки пишется через дефис).</li>
                    <li><strong>Насчёт</strong> (слитно, производный предлог) — <strong>в связи</strong> (всегда раздельно).</li>
                    <li><strong>Чтобы</strong> (слитно, союз цели) — <strong>в течение</strong> (всегда раздельно, значение времени).</li>
                    <li><strong>Кверху</strong> (слитно, наречие) + <strong>Тотчас</strong> (слитно, наречие). <strong>Оба слова пишутся СЛИТНО!</strong></li>
                    <li><strong>За тем</strong> (раздельно, предлог с местоимением) — <strong>почему</strong> (слитно, местоимение-союз).</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-6">
          <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200 text-left">
            <h3 className="text-xl font-bold mb-4 text-slate-800 border-b pb-2 flex items-center">
              <span className="mr-2">🧠</span> Разбор заданий по логике
            </h3>
            
            <div className="space-y-6 text-sm text-slate-700">
              <div>
                <h4 className="font-bold text-slate-800">Задание №1 (Три друга и рубашки)</h4>
                <p><strong>Ответ:</strong> Белов — серая; Серов — чёрная; Чернов — белая.</p>
                <p className="mt-1"><strong>Пояснение:</strong> Белов не в белой (по условию). В белой рубашке говорит с Черновым, значит, Чернов тоже не в белой. Выходит, в белой — Серов. Так как фамилии не совпадают с цветом, Белов не в белой и не в серой, значит, Белов в серой, а Чернов в чёрной.</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">Задание №2 (Три ящика)</h4>
                <p><strong>Ответ:</strong> Ящик 1 — сахар; Ящик 2 — крупа; Ящик 3 — вермишель.</p>
                <p className="mt-1"><strong>Пояснение:</strong> Раз надписи ложны, то в третьем ящике («крупа или сахар») не может быть ни крупы, ни сахара. Значит, там вермишель. Тогда для первых двух ящиков остаются крупа и сахар. На первом написано «крупа» — значит, там сахар. На втором остается крупа.</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">Задание №3 (Очередь)</h4>
                <p><strong>Ответ:</strong> Митя, Сеня, Толя, Юра, Костя ИЛИ Митя, Костя, Толя, Юра, Сеня.</p>
                <p className="mt-1"><strong>Пояснение:</strong> Из условия «между Сеней и Костей» и «в конце очереди рядом Юра» вытекает два зеркальных правильных ответа. Митя встал впереди всех (1 место). Толя посередине (3 место). В конце (4 и 5 места) Юра и Сеня/Костя. Система засчитывает оба порядка.</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">Задание №4 (Профессии и этажи)</h4>
                <p><strong>Ответ:</strong> Олег — скрипач; Коля — пианист; Ваня — певец.</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">Задание №5 (Ягоды и испарение)</h4>
                <p><strong>Ответ:</strong> Уменьшилась в 2 раза.</p>
                <p className="mt-1"><strong>Пояснение:</strong> Сухое вещество в ягодах составляло 100% - 99% = 1%. После испарения оно стало составлять 100% - 98% = 2%. Так как абсолютная масса сухого вещества не изменилась, а его доля увеличилась в 2 раза, то общая масса ягод уменьшилась ровно в 2 раза.</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">Задание №6 (Доктора)</h4>
                <p><strong>Ответ:</strong> 60 минут.</p>
                <p className="mt-1"><strong>Пояснение:</strong> За 30 минут Доктор Ай вырвет 3 зуба, а Доктор Ой — 2 зуба. Вместе за 30 минут они вырывают 5 зубов. Чтобы вырвать 10 зубов, им понадобится в 2 раза больше времени: 30 * 2 = 60 минут.</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">Задание №7 (Загаданное число)</h4>
                <p><strong>Ответ:</strong> 7.</p>
                <p className="mt-1"><strong>Пояснение:</strong> Целая часть от деления суммы цифр двузначного числа пополам — это всегда цифра от 0 до 9. Приписав слева 20, мы получаем трехзначное число от 200 до 209. Прибавляем 59: получаем от 259 до 268. Вычеркиваем последнюю цифру — в любом случае остается число 26. Сумма цифр числа 26: 2 + 6 = 7.</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800">Задание №8 (Собака и заяц)</h4>
                <p><strong>Ответ:</strong> 240 скачков.</p>
                <p className="mt-1"><strong>Пояснение:</strong> За каждые 5 скачков собака приближается к зайцу на расстояние 1 своего скачка. Разделяющее их расстояние в 40 скачков собаки будет преодолено за 40 таких циклов. 40 циклов * 5 скачков = 240 скачков.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
