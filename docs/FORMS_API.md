# Приём заявок на внешнем сайте — инструкция

Документ самодостаточный. Чтобы сделать страницу, которая принимает заявки, больше ничего знать не нужно: ни про нашу базу, ни про устройство платформы.

## Что это

Организация ведёт свои анкеты в кабинете: набор полей, статусы заявок, отметка гостей по QR. Ваш сайт подключается к готовой анкете и присылает в неё заявки — оформление, тексты и порядок экранов целиком ваши.

**Что вы получаете бесплатно:** заявка попадает в кабинет организации, ей присваивается код, человек может отслеживать её статус по ссылке, а сотрудники — обрабатывать привычным образом.

**Чего делать не нужно:** ключей, авторизации, библиотек. Обычные `fetch`-запросы.

**Адрес сервера:** `https://www.studyfreeforum.com`

Все ответы — JSON вида `{"success": true, ...}` либо `{"success": false, "error": "текст"}`. Текст ошибки на русском, его можно показывать человеку как есть.

---

## Что нужно от организации

Только **идентификатор анкеты** (`formId`) — строка вида `form_1789491208354`. Его даёт организатор: кабинет → «Заявки и QR» → нужная форма.

Анкеты «Академии будущих лидеров»:

| Анкета | `formId` | Режим |
|---|---|---|
| Поступление в АБЛ 1–11 класс ОРТО-САЙ | `form_1788342891846` | заявка |
| ХАКАТОН | `form_1788613220215` | билет |
| Анкета для родителей АБЛ Орто-Сай | `form_1789023839447` | заявка |
| Идеи и предложения для парламента | `form_1789491208354` | заявка |
| Предложения по улучшению школы | `form_1789541783872` | заявка |

Режим **билет** означает, что после одобрения человек получает QR-пропуск, который сканируют на входе. Режим **заявка** — обычная обработка без пропуска.

---

## Три шага

```
1. GET  /api/forms/public/{formId}   → какие поля спрашивать
2. POST /api/forms/submit            → отправить заявку, получить код
3. GET  /api/forms/track/{код}       → показать человеку статус (по желанию)
```

---

## 1. Узнать поля анкеты

```
GET https://www.studyfreeforum.com/api/forms/public/{formId}
```

```json
{
  "success": true,
  "org": { "name": "Академия будущих лидеров", "logoUrl": null, "primaryColor": null },
  "form": {
    "id": "form_1789491208354",
    "title": "Идеи и предложения для агитационной работы парламента",
    "description": "",
    "mode": "application",
    "fields": [
      { "id": "field_1789491136160", "label": "Фамилия и имя", "type": "text", "required": false },
      { "id": "field_1789491192330", "label": "Ваше предложение/ия", "type": "text", "required": true }
    ]
  }
}
```

**Не вшивайте поля в код.** Организатор меняет анкету в кабинете, и страница должна подхватывать изменения сама — иначе после правки формы сайт начнёт слать не те данные.

### Типы полей

| `type` | Чем рисовать | Особенности |
|---|---|---|
| `text` | однострочное поле | |
| `textarea` | многострочное поле | |
| `number` | числовое поле | |
| `date` | выбор даты | |
| `select` | список выбора | варианты в `options` — массив строк |
| `checkbox` | галочка | отправляйте `true` или `false` |
| `file` | загрузка фотографии | **только изображение**, см. ниже |

Поле с `required: true` обязательно — не давайте отправить форму без него, иначе сервер вернёт `400` со списком незаполненного.

Если анкету закрыли, придёт `410` и `{"closed": true}` — покажите текст из `error` и не рисуйте форму.

---

## 2. Отправить заявку

```
POST https://www.studyfreeforum.com/api/forms/submit
Content-Type: application/json

{
  "formId": "form_1789491208354",
  "data": {
    "field_1789491136160": "Осмонова Айгуль",
    "field_1789491192330": "Предлагаю проводить дебаты каждый месяц"
  }
}
```

Ключи в `data` — это **`id` полей**, не их названия. Отправляйте только те поля, что пришли в первом шаге: лишние ключи сервер отбросит.

Ответ:

```json
{
  "success": true,
  "qrToken": "T7L97QJLPR",
  "trackUrl": "/track/T7L97QJLPR",
  "mode": "application",
  "message": "Заявка принята."
}
```

`qrToken` — код заявки. Покажите его человеку и сохраните: по нему он потом смотрит статус. Ссылка для него — `https://www.studyfreeforum.com/track/{qrToken}`.

### Фотографии

Поле с `type: "file"` принимает **только изображение** (JPG или PNG), закодированное строкой `data:image/...`. Сожмите его до отправки: предел 400 КБ на файл и 700 КБ на всю заявку.

Документы PDF не принимаются. Если нужно резюме или справка файлом — попросите ссылку обычным текстовым полем.

---

## 3. Показать статус (по желанию)

```
GET https://www.studyfreeforum.com/api/forms/track/{qrToken}
```

Отдаёт название анкеты, имя заявителя, текущий статус с русской подписью и историю рассмотрения. Для билетных анкет — признак `ticketActive`: когда он `true`, человеку пора показать QR-пропуск.

Можно не делать свою страницу: ссылка `https://www.studyfreeforum.com/track/{qrToken}` уже показывает всё это, с оформлением организации.

---

## Ошибки

| Код | Что случилось | Что показать |
|---|---|---|
| `400` | не заполнено обязательное поле, или картинка не картинка | текст из `error` |
| `404` | анкета или код не найдены | «Анкета недоступна» |
| `410` | приём заявок закрыт | текст из `error` |
| `413` | файл или заявка слишком большие | «Уменьшите фотографию» |
| `429` | слишком много запросов подряд | «Подождите минуту» |

Сервер ограничивает частоту запросов с одного адреса. Обычной регистрации это не мешает, но не опрашивайте статус в цикле — обновляйте по действию человека.

---

## Рабочий пример

```html
<div id="app"></div>
<script>
const BASE = "https://www.studyfreeforum.com";
const FORM_ID = "form_1789491208354";

async function render() {
  const r = await fetch(`${BASE}/api/forms/public/${FORM_ID}`);
  const j = await r.json();

  if (!j.success) {
    document.getElementById("app").textContent = j.error;
    return;
  }

  const form = document.createElement("form");
  form.innerHTML = `<h2>${j.form.title}</h2>`;

  for (const f of j.form.fields) {
    const label = document.createElement("label");
    label.textContent = f.label + (f.required ? " *" : "");

    let input;
    if (f.type === "textarea") {
      input = document.createElement("textarea");
    } else if (f.type === "select") {
      input = document.createElement("select");
      input.innerHTML = `<option value="">Выберите…</option>` +
        (f.options || []).map(o => `<option>${o}</option>`).join("");
    } else if (f.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
    } else {
      input = document.createElement("input");
      input.type = f.type === "number" ? "number" : f.type === "date" ? "date" : "text";
    }
    input.dataset.fieldId = f.id;
    input.dataset.fieldType = f.type;
    if (f.required) input.required = true;

    label.appendChild(input);
    form.appendChild(label);
  }

  const button = document.createElement("button");
  button.textContent = "Отправить";
  form.appendChild(button);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {};
    form.querySelectorAll("[data-field-id]").forEach(el => {
      data[el.dataset.fieldId] = el.dataset.fieldType === "checkbox" ? el.checked : el.value;
    });

    const res = await fetch(`${BASE}/api/forms/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formId: FORM_ID, data }),
    });
    const out = await res.json();

    if (!out.success) { alert(out.error); return; }
    document.getElementById("app").innerHTML =
      `<h2>Заявка принята</h2>
       <p>Ваш код: <b>${out.qrToken}</b></p>
       <p><a href="${BASE}/track/${out.qrToken}" target="_blank">Посмотреть статус</a></p>`;
  };

  document.getElementById("app").innerHTML = "";
  document.getElementById("app").appendChild(form);
}

render();
</script>
```

Этот пример читает анкету, рисует поля по её описанию и отправляет заявку. Оформление добавьте своё — логика останется той же.

---

## Что стоит знать

**Анкету меняет организатор, а не вы.** Поля, их порядок и обязательность задаются в кабинете. Читайте их запросом, а не переписывайте на сайте.

**Заявка не редактируется.** После отправки человек может только смотреть статус. Если нужна правка — он подаёт заново, а организатор убирает лишнюю.

**Повторная отправка создаёт вторую заявку.** Защиты от двойного нажатия на стороне сервера нет: блокируйте кнопку после отправки.

**Есть второй, более мощный способ подключения** — модуль приёма с бронированием мест (когда нужны команды, лимиты мест, слоты времени). Он описан в `INTAKE_API.md`. Для обычного сбора заявок хватает того, что здесь.
