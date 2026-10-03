# Приём и управление заявками на внешнем сайте — Инструкция и API Reference

Документ самодостаточный. Чтобы сделать страницу, которая принимает, ищет или обновляет заявки, больше ничего знать не нужно: ни про устройство базы, ни про архитектуру StudyFree.

## Что это

Организация ведёт свои анкеты в кабинете: набор полей, статусы заявок, отметка гостей по QR. Ваш внешний сайт подключается к готовой анкете и может:
1. Читать список полей и рисовать форму на клиенте.
2. Отправлять новые заявки или автоматически обновлять существующие (Upsert).
3. Искать заявки по любому полю (по коду команды, по email, по имени и т.д.).
4. Частично обновлять поля поданной заявки (`PATCH`).
5. Проверять доступ команд по коду и паролю.

**Адрес сервера:** `https://www.studyfreeforum.com`

Все ответы — JSON вида `{"success": true, ...}` либо `{"success": false, "error": "текст"}`.

---

## Важные данные от организации

- **`formId`**: Идентификатор анкеты вида `form_1789491208354`. (Кабинет → «Заявки и QR» → форма).
- **`tenantId`**: Идентификатор организации (например `org_future_leaders`).

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

## Обзор эндпоинтов

| Действие | Метод & Path | Авторизация / Заголовки |
|---|---|---|
| Список анкет | `GET /api/forms/public/list?tenantId={tenantId}` | Не требуется |
| Получить поля анкеты | `GET /api/forms/public/{formId}` | Не требуется |
| Отправить/обновить заявку | `POST /api/forms/submit` | Не требуется |
| Универсальный поиск заявок | `POST /api/forms/submissions/search` | `X-Api-Key` / `Authorization: Bearer` / `X-Tenant-ID` |
| Частичное обновление заявки | `PATCH /api/forms/submissions/{submissionId}` | `X-Api-Key` / `Authorization: Bearer` / `X-Tenant-ID` |
| Создание / Upsert заявки | `POST /api/forms/submissions/upsert` | `X-Api-Key` / `Authorization: Bearer` / `X-Tenant-ID` |
| Проверка кода и пароля команды | `POST /api/forms/team/check` | Не требуется |
| Отслеживание статуса по QR | `GET /api/forms/track/{token}` | Не требуется |
| Витрина публичных заявок | `GET /api/forms/public/{formId}/submissions` | Не требуется |
| Статистика заявок (счётчик) | `GET /api/forms/public/{formId}/stats` | Не требуется |

---

## 1. Получение полей анкеты (`GET /api/forms/public/{formId}`)

```http
GET https://www.studyfreeforum.com/api/forms/public/form_1789491208354
```

```json
{
  "success": true,
  "org": { "name": "Академия будущих лидеров", "logoUrl": null, "primaryColor": null },
  "form": {
    "id": "form_1789491208354",
    "title": "Заявка на участие",
    "description": "",
    "mode": "application",
    "fields": [
      { "id": "field_1789491136160", "label": "Фамилия и имя", "type": "text", "required": true },
      { "id": "field_1789491192330", "label": "Email", "type": "text", "required": true }
    ]
  }
}
```

### Типы полей

| `type` | Чем рисовать | Особенности |
|---|---|---|
| `text` | однострочное поле | |
| `textarea` | многострочное поле | |
| `number` | числовое поле | |
| `date` | выбор даты | |
| `select` | список выбора | варианты в `options` — массив строк |
| `checkbox` | галочка | отправляйте `true` или `false` |
| `file` | загрузка фотографии | **только изображение** (data:image/...) |

---

## 2. Отправка и автоматический Upsert (`POST /api/forms/submit`)

### Обычная отправка (создание новой заявки):
```json
POST https://www.studyfreeforum.com/api/forms/submit
Content-Type: application/json

{
  "formId": "form_1789491208354",
  "data": {
    "field_1789491136160": "Алексей Иванов",
    "field_1789491192330": "alexey@example.com"
  }
}
```

### Автоматическое обновление существующей заявки (Upsert по токену или полю):
Чтобы обновить ранее поданную заявку (например, при повторной отправке с известным `token` / `code` или при уникальном email), передайте `token` или объект `upsert_by`:

```json
POST https://www.studyfreeforum.com/api/forms/submit
Content-Type: application/json

{
  "formId": "form_1789491208354",
  "token": "T7L97QJLPR",
  "upsert_by": {
    "field_id": "field_1789491192330",
    "value": "alexey@example.com"
  },
  "data": {
    "field_1789491136160": "Алексей Иванов",
    "field_1789491192330": "alexey@example.com",
    "field_presentation_url": "https://example.com/slides.pdf"
  }
}
```

**Ответ сервера:**
```json
{
  "success": true,
  "updated": true,
  "qrToken": "T7L97QJLPR",
  "trackUrl": "/track/T7L97QJLPR",
  "mode": "application",
  "message": "Заявка успешно обновлена!"
}
```

---

## 3. Универсальный поиск заявок (`POST /api/forms/submissions/search`)

Позволяет осуществлять гибкий поиск по любому полю (по коду команды, по роли, по поисковому слову) без хардкода схемы.

```http
POST https://www.studyfreeforum.com/api/forms/submissions/search
Content-Type: application/json
X-Api-Key: <TENANT_API_KEY>

{
  "form_id": "form_1789491208354",
  "filter": {
    "field_id": "field_1790768090009",
    "value": "LOGOS-BLUE-3341",
    "exact_match": true
  },
  "limit": 50,
  "offset": 0
}
```

* Если `field_id` не указан — поиск выполняется по **всем** текстовым полям анкеты и общим атрибутам.
* `exact_match: true` — точный поиск (регистронезависимо и с игнорированием лишних дефисов/пробелов).
* `exact_match: false` — частичный поиск (`contains`).

**Ответ сервера:**
```json
{
  "success": true,
  "total": 2,
  "limit": 50,
  "offset": 0,
  "data": [
    {
      "submission_id": "sub_9876543210",
      "form_id": "form_1789491208354",
      "code": "T7L97QJLPR",
      "status": "new",
      "status_label": "Новая",
      "fields": {
        "field_1790768090009": "LOGOS-BLUE-3341",
        "field_name": "Алексей Иванов",
        "field_presentation_url": "https://example.com/slides.pdf"
      },
      "created_at": "2026-10-03T18:20:00.000Z",
      "updated_at": "2026-10-03T19:10:00.000Z"
    }
  ]
}
```

---

## 4. Частичное обновление поля заявки (`PATCH /api/forms/submissions/{submissionId}`)

Позволяет дозагрузить ссылку на презентацию, дополнить анкету или сменить отдельные данные конкретной заявки:

```http
PATCH https://www.studyfreeforum.com/api/forms/submissions/sub_9876543210
Content-Type: application/json
X-Api-Key: <TENANT_API_KEY>

{
  "fields": {
    "field_presentation_url": "https://my-drive.com/presentation.pdf",
    "field_notes": "Добавлены слайды с внешнего сайта"
  }
}
```

**Ответ сервера:**
```json
{
  "success": true,
  "submission_id": "sub_9876543210",
  "updated_at": "2026-10-03T23:25:00.000Z",
  "fields": {
    "field_1790768090009": "LOGOS-BLUE-3341",
    "field_presentation_url": "https://my-drive.com/presentation.pdf",
    "field_notes": "Добавлены слайды с внешнего сайта"
  }
}
```

---

## 5. Проверка кода и пароля команды (`POST /api/forms/team/check`)

Оптимизированный сервис для командных соревнований и хакатонов:

```http
POST https://www.studyfreeforum.com/api/forms/team/check
Content-Type: application/json

{
  "formId": "form_1789491208354",
  "code": "LOGOS-BLUE-3341",
  "password": "secret_password"
}
```

**Ответ сервера:**
```json
{
  "success": true,
  "found": true,
  "submissionId": "sub_9876543210",
  "code": "LOGOS-BLUE-3341",
  "teamName": "CyberLogos",
  "participationFormat": "Офлайн",
  "status": "approved",
  "passwordMatches": true,
  "data": { ... }
}
```

---

## 6. Отслеживание статуса по QR / Коду (`GET /api/forms/track/{token}`)

```http
GET https://www.studyfreeforum.com/api/forms/track/T7L97QJLPR
```

```json
{
  "success": true,
  "submission": {
    "code": "T7L97QJLPR",
    "formTitle": "Хакатон 2026",
    "applicantName": "Алексей Иванов",
    "status": "approved",
    "statusLabel": "Одобрено",
    "ticketActive": true,
    "createdAt": { "_seconds": 1789931630 },
    "history": [
      { "status": "approved", "label": "Одобрено", "note": "Ждём на площадке к 10:00" }
    ]
  }
}
```

---

## Коды ошибок HTTP

| Код | Ошибка | Описание |
|---|---|---|
| `400` | `INVALID_PARAMETERS` | Не заполнено обязательное поле или неверный формат параметров |
| `401` / `403` | `UNAUTHORIZED_ACCESS` | Форма принадлежит другому тенанту или отсутствуют права |
| `404` | `NOT_FOUND` | Форма или заявка с таким кодом/ID не найдена |
| `410` | `CLOSED` | Приём заявок по этой форме закрыт организатором |
| `413` | `PAYLOAD_TOO_LARGE` | Превышен размер файлов в заявке |

---

## Полный JS-пример (HTML / Native Fetch)

```html
<div id="app"></div>
<script>
const BASE = "https://www.studyfreeforum.com";
const FORM_ID = "form_1789491208354";

async function submitOrUpdate(data, existingToken = null) {
  const payload = { formId: FORM_ID, data };
  if (existingToken) payload.token = existingToken;

  const res = await fetch(`${BASE}/api/forms/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

async function searchSubmissions(fieldId, value) {
  const res = await fetch(`${BASE}/api/forms/submissions/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      form_id: FORM_ID,
      filter: { field_id: fieldId, value, exact_match: true }
    }),
  });
  return await res.json();
}
</script>
```
