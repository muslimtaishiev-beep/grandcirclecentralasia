var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/data/testsData.ts
var testsData_exports = {};
__export(testsData_exports, {
  testsData: () => testsData
});
module.exports = __toCommonJS(testsData_exports);
var commonLogicQuestions = [
  {
    id: "logic_1",
    type: "logic_matrix",
    points: 1,
    text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21161. \u0412\u0441\u0442\u0440\u0435\u0442\u0438\u043B\u0438\u0441\u044C \u0442\u0440\u0438 \u0434\u0440\u0443\u0433\u0430: \u0411\u0435\u043B\u043E\u0432, \u0421\u0435\u0440\u043E\u0432, \u0427\u0435\u0440\u043D\u043E\u0432. \u041D\u0430 \u043D\u0438\u0445 \u0431\u044B\u043B\u0438 \u0431\u0435\u043B\u0430\u044F, \u0441\u0435\u0440\u0430\u044F \u0438 \u0447\u0435\u0440\u043D\u0430\u044F \u0440\u0443\u0431\u0430\u0448\u043A\u0438. \u041E\u0434\u0435\u0442\u044B\u0439 \u0432 \u0431\u0435\u043B\u0443\u044E \u0440\u0443\u0431\u0430\u0448\u043A\u0443 \u0441\u043A\u0430\u0437\u0430\u043B \u0427\u0435\u0440\u043D\u043E\u0432\u0443: \xAB\u0418\u043D\u0442\u0435\u0440\u0435\u0441\u043D\u043E, \u0447\u0442\u043E \u0446\u0432\u0435\u0442 \u0440\u0443\u0431\u0430\u0448\u043A\u0438 \u043D\u0430 \u043A\u0430\u0436\u0434\u043E\u043C \u0438\u0437 \u043D\u0430\u0441 \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0444\u0430\u043C\u0438\u043B\u0438\u0438\xBB. \u041A\u0430\u043A\u043E\u0439 \u0446\u0432\u0435\u0442 \u0440\u0443\u0431\u0430\u0448\u043A\u0438 \u0443 \u043A\u0430\u0436\u0434\u043E\u0433\u043E?",
    matrixRows: ["\u0411\u0435\u043B\u043E\u0432", "\u0421\u0435\u0440\u043E\u0432", "\u0427\u0435\u0440\u043D\u043E\u0432"],
    matrixCols: ["\u0411\u0435\u043B\u0430\u044F \u0440\u0443\u0431\u0430\u0448\u043A\u0430", "\u0421\u0435\u0440\u0430\u044F \u0440\u0443\u0431\u0430\u0448\u043A\u0430", "\u0427\u0451\u0440\u043D\u0430\u044F \u0440\u0443\u0431\u0430\u0448\u043A\u0430"]
  },
  {
    id: "logic_2",
    type: "dropdown_multiple",
    points: 1,
    text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21162. \u0412 \u0442\u0440\u0435\u0445 \u044F\u0449\u0438\u043A\u0430\u0445 \u043D\u0430\u0445\u043E\u0434\u044F\u0442\u0441\u044F \u043A\u0440\u0443\u043F\u0430, \u0432\u0435\u0440\u043C\u0438\u0448\u0435\u043B\u044C \u0438 \u0441\u0430\u0445\u0430\u0440. \u041D\u0430 \u043F\u0435\u0440\u0432\u043E\u043C \u044F\u0449\u0438\u043A\u0435 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u043E \xAB\u043A\u0440\u0443\u043F\u0430\xBB, \u043D\u0430 \u0432\u0442\u043E\u0440\u043E\u043C \u2013 \xAB\u0432\u0435\u0440\u043C\u0438\u0448\u0435\u043B\u044C\xBB, \u043D\u0430 \u0442\u0440\u0435\u0442\u044C\u0435\u043C \u2013 \xAB\u043A\u0440\u0443\u043F\u0430 \u0438\u043B\u0438 \u0441\u0430\u0445\u0430\u0440\xBB. \u0427\u0442\u043E \u0432 \u043A\u0430\u043A\u043E\u043C \u044F\u0449\u0438\u043A\u0435 \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u0441\u044F, \u0435\u0441\u043B\u0438 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u043C\u043E\u0435 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0438\u0437 \u044F\u0449\u0438\u043A\u043E\u0432 \u043D\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043D\u0430\u0434\u043F\u0438\u0441\u0438 \u043D\u0430 \u043D\u0435\u043C?",
    dropdownItems: [
      { label: "\u042F\u0449\u0438\u043A 1 (\u043D\u0430\u0434\u043F\u0438\u0441\u044C \xAB\u043A\u0440\u0443\u043F\u0430\xBB)", options: ["\u041A\u0440\u0443\u043F\u0430", "\u0412\u0435\u0440\u043C\u0438\u0448\u0435\u043B\u044C", "\u0421\u0430\u0445\u0430\u0440"] },
      { label: "\u042F\u0449\u0438\u043A 2 (\u043D\u0430\u0434\u043F\u0438\u0441\u044C \xAB\u0432\u0435\u0440\u043C\u0438\u0448\u0435\u043B\u044C\xBB)", options: ["\u041A\u0440\u0443\u043F\u0430", "\u0412\u0435\u0440\u043C\u0438\u0448\u0435\u043B\u044C", "\u0421\u0430\u0445\u0430\u0440"] },
      { label: "\u042F\u0449\u0438\u043A 3 (\u043D\u0430\u0434\u043F\u0438\u0441\u044C \xAB\u043A\u0440\u0443\u043F\u0430 \u0438\u043B\u0438 \u0441\u0430\u0445\u0430\u0440\xBB)", options: ["\u041A\u0440\u0443\u043F\u0430", "\u0412\u0435\u0440\u043C\u0438\u0448\u0435\u043B\u044C", "\u0421\u0430\u0445\u0430\u0440"] }
    ]
  },
  {
    id: "logic_3",
    type: "drag_and_drop",
    points: 1,
    text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u041C\u0438\u0442\u044F, \u0421\u0435\u043D\u044F, \u0422\u043E\u043B\u044F, \u042E\u0440\u0430 \u0438 \u041A\u043E\u0441\u0442\u044F \u043F\u043E\u0448\u043B\u0438 \u043D\u0430 \u043A\u043E\u043D\u0446\u0435\u0440\u0442 \u0438 \u0432\u0441\u0442\u0430\u043B\u0438 \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u044C. \u0415\u0441\u043B\u0438 \u0431\u044B \u041C\u0438\u0442\u044F \u0432\u0441\u0442\u0430\u043B \u043F\u043E\u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0435 \u043E\u0447\u0435\u0440\u0435\u0434\u0438, \u0442\u043E \u043E\u043D \u0431\u044B \u043E\u043A\u0430\u0437\u0430\u043B\u0441\u044F \u043C\u0435\u0436\u0434\u0443 \u0421\u0435\u043D\u0435\u0439 \u0438 \u041A\u043E\u0441\u0442\u0435\u0439, \u0430 \u0435\u0441\u043B\u0438 \u0431\u044B \u041C\u0438\u0442\u044F \u0432\u0441\u0442\u0430\u043B \u0432 \u043A\u043E\u043D\u0435\u0446 \u043E\u0447\u0435\u0440\u0435\u0434\u0438, \u0442\u043E \u0440\u044F\u0434\u043E\u043C \u0441 \u043D\u0438\u043C \u043C\u043E\u0433 \u0431\u044B\u0442\u044C \u042E\u0440\u0430, \u043D\u043E \u041C\u0438\u0442\u044F \u0432\u0441\u0442\u0430\u043B \u0432\u043F\u0435\u0440\u0435\u0434\u0438 \u0432\u0441\u0435\u0445 \u0441\u0432\u043E\u0438\u0445 \u0442\u043E\u0432\u0430\u0440\u0438\u0449\u0435\u0439. \u041A\u0442\u043E \u0437\u0430 \u043A\u0435\u043C \u0441\u0442\u043E\u0438\u0442?",
    dragItems: ["\u0422\u043E\u043B\u044F", "\u042E\u0440\u0430", "\u041C\u0438\u0442\u044F", "\u041A\u043E\u0441\u0442\u044F", "\u0421\u0435\u043D\u044F"]
  },
  {
    id: "logic_4",
    type: "logic_matrix",
    points: 1,
    text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21164. \u041E\u043B\u0435\u0433, \u041A\u043E\u043B\u044F, \u0412\u0430\u043D\u044F \u0436\u0438\u0432\u0443\u0442 \u0432 \u043E\u0434\u043D\u043E\u043C \u0434\u043E\u043C\u0435. \u041A\u0430\u0436\u0434\u044B\u0439 \u0438\u0437 \u043D\u0438\u0445 \u0437\u0430\u043D\u0438\u043C\u0430\u0435\u0442\u0441\u044F \u043C\u0443\u0437\u044B\u043A\u043E\u0439: \u043F\u0435\u043D\u0438\u0435\u043C, \u0438\u0433\u0440\u043E\u0439 \u043D\u0430 \u0441\u043A\u0440\u0438\u043F\u043A\u0435 \u0438\u043B\u0438 \u043F\u0438\u0430\u043D\u0438\u043D\u043E. \u0418\u0437\u0432\u0435\u0441\u0442\u043D\u043E, \u0447\u0442\u043E: \u041A\u043E\u043B\u044F \u0436\u0438\u0432\u0435\u0442 \u043D\u0430 \u0442\u043E\u043C \u044D\u0442\u0430\u0436\u0435, \u0447\u0442\u043E \u0438 \u043F\u0435\u0432\u0435\u0446; \u041F\u0438\u0430\u043D\u0438\u0441\u0442 \u0438 \u041E\u043B\u0435\u0433 \u0445\u043E\u0434\u044F\u0442 \u0432 \u0440\u0430\u0437\u043D\u044B\u0435 \u043A\u043B\u0430\u0441\u0441\u044B; \u041E\u043B\u0435\u0433 \u0438 \u043F\u0435\u0432\u0435\u0446 \u0440\u043E\u0434\u0438\u043B\u0438\u0441\u044C \u0432 \u043E\u0434\u043D\u043E\u043C \u043C\u0435\u0441\u044F\u0446\u0435. \u041A\u0442\u043E \u0447\u0435\u043C \u0437\u0430\u043D\u0438\u043C\u0430\u0435\u0442\u0441\u044F?",
    matrixRows: ["\u041E\u043B\u0435\u0433", "\u041A\u043E\u043B\u044F", "\u0412\u0430\u043D\u044F"],
    matrixCols: ["\u041F\u0435\u0432\u0435\u0446", "\u0421\u043A\u0440\u0438\u043F\u0430\u0447", "\u041F\u0438\u0430\u043D\u0438\u0441\u0442"]
  },
  {
    id: "logic_5",
    type: "multiple_choice",
    points: 1,
    text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21165. \u0421\u0432\u0435\u0436\u0435\u0441\u043E\u0431\u0440\u0430\u043D\u043D\u044B\u0435 \u044F\u0433\u043E\u0434\u044B \u0447\u0435\u0440\u043D\u0438\u043A\u0438 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442 99% \u0432\u043E\u0434\u044B. \u0427\u0435\u0440\u0435\u0437 \u043D\u0435\u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0432\u0440\u0435\u043C\u044F \u044D\u0442\u0438 \u0436\u0435 \u044F\u0433\u043E\u0434\u044B \u0441\u0442\u0430\u043B\u0438 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C 98% \u0432\u043E\u0434\u044B. \u041A\u0430\u043A \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0430\u0441\u044C \u043C\u0430\u0441\u0441\u0430 \u044F\u0433\u043E\u0434?",
    options: ["\u0423\u043C\u0435\u043D\u044C\u0448\u0438\u043B\u0430\u0441\u044C \u043D\u0430 1%", "\u0423\u043C\u0435\u043D\u044C\u0448\u0438\u043B\u0430\u0441\u044C \u0432 98/99 \u0440\u0430\u0437", "\u0423\u043C\u0435\u043D\u044C\u0448\u0438\u043B\u0430\u0441\u044C \u0432 2 \u0440\u0430\u0437\u0430"]
  },
  {
    id: "logic_6",
    type: "number_input",
    points: 1,
    text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21166. \u0414\u043E\u043A\u0442\u043E\u0440 \u0410\u0439 \u0432\u044B\u0440\u044B\u0432\u0430\u0435\u0442 \u0437\u0443\u0431 \u0437\u0430 10 \u043C\u0438\u043D\u0443\u0442, \u0430 \u0434\u043E\u043A\u0442\u043E\u0440 \u041E\u0439 \u2014 \u0437\u0430 15 \u043C\u0438\u043D\u0443\u0442. \u0415\u0441\u043B\u0438 \u043E\u043D\u0438 \u043D\u0430\u0447\u043D\u0443\u0442 \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E, \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0438\u043C \u043F\u043E\u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F, \u0447\u0442\u043E\u0431\u044B \u0432\u044B\u0440\u0432\u0430\u0442\u044C 10 \u0437\u0443\u0431\u043E\u0432?"
  },
  {
    id: "logic_7",
    type: "number_input",
    points: 1,
    text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21167. \u042F \u0437\u0430\u0434\u0443\u043C\u0430\u043B \u0434\u0432\u0443\u0437\u043D\u0430\u0447\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E, \u0431\u043E\u043B\u044C\u0448\u0435\u0435 10, \u043F\u043E\u0442\u043E\u043C \u0441\u0443\u043C\u043C\u0443 \u0435\u0433\u043E \u0446\u0438\u0444\u0440 \u043F\u043E\u0434\u0435\u043B\u0438\u043B \u043F\u043E\u043F\u043E\u043B\u0430\u043C \u0438 \u0432\u0437\u044F\u043B \u0446\u0435\u043B\u0443\u044E \u0447\u0430\u0441\u0442\u044C; \u043A \u043D\u0435\u0439 \u044F \u043F\u0440\u0438\u043F\u0438\u0441\u0430\u043B \u0441\u043B\u0435\u0432\u0430 \u2014 20, \u043F\u043E\u0442\u043E\u043C \u043F\u0440\u0438\u0431\u0430\u0432\u0438\u043B 59, \u043F\u043E\u0441\u043B\u0435 \u0447\u0435\u0433\u043E, \u0432\u044B\u0447\u0435\u0440\u043A\u043D\u0443\u0432 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044E\u044E \u0446\u0438\u0444\u0440\u0443, \u0432\u043D\u043E\u0432\u044C \u043F\u043E\u0441\u0447\u0438\u0442\u0430\u043B \u0441\u0443\u043C\u043C\u0443 \u0446\u0438\u0444\u0440 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u043E\u0433\u043E \u0447\u0438\u0441\u043B\u0430. \u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0443 \u043C\u0435\u043D\u044F \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u043E\u0441\u044C?"
  },
  {
    id: "logic_8",
    type: "number_input",
    points: 1,
    text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21168. \u041F\u043E\u0448\u0435\u043B \u043E\u0445\u043E\u0442\u043D\u0438\u043A \u043D\u0430 \u043E\u0445\u043E\u0442\u0443 \u0441 \u0441\u043E\u0431\u0430\u043A\u043E\u0439. \u0418\u0434\u0443\u0442 \u043E\u043D\u0438 \u043B\u0435\u0441\u043E\u043C, \u0438 \u0432\u0434\u0440\u0443\u0433 \u0441\u043E\u0431\u0430\u043A\u0430 \u0443\u0432\u0438\u0434\u0430\u043B\u0430 \u0437\u0430\u0439\u0446\u0430. \u0417\u0430 \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u043A\u0430\u0447\u043A\u043E\u0432 \u0441\u043E\u0431\u0430\u043A\u0430 \u0434\u043E\u0433\u043E\u043D\u0438\u0442 \u0437\u0430\u0439\u0446\u0430, \u0435\u0441\u043B\u0438 \u0440\u0430\u0441\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043E\u0442 \u0441\u043E\u0431\u0430\u043A\u0438 \u0434\u043E \u0437\u0430\u0439\u0446\u0430 \u0440\u0430\u0432\u043D\u043E 40 \u0441\u043A\u0430\u0447\u043A\u0430\u043C \u0441\u043E\u0431\u0430\u043A\u0438 \u0438 \u0440\u0430\u0441\u0441\u0442\u043E\u044F\u043D\u0438\u0435, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u043F\u0440\u043E\u0431\u0435\u0433\u0430\u0435\u0442 \u0441\u043E\u0431\u0430\u043A\u0430 \u0437\u0430 5 \u0441\u043A\u0430\u0447\u043A\u043E\u0432, \u0437\u0430\u044F\u0446 \u043F\u0440\u043E\u0431\u0435\u0433\u0430\u0435\u0442 \u0437\u0430 6 \u0441\u043A\u0430\u0447\u043A\u043E\u0432? (\u0412 \u0437\u0430\u0434\u0430\u0447\u0435 \u043F\u043E\u0434\u0440\u0430\u0437\u0443\u043C\u0435\u0432\u0430\u0435\u0442\u0441\u044F, \u0447\u0442\u043E \u0441\u043A\u0430\u0447\u043A\u0438 \u0434\u0435\u043B\u0430\u044E\u0442\u0441\u044F \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0438 \u0437\u0430\u0439\u0446\u0435\u043C \u0438 \u0441\u043E\u0431\u0430\u043A\u043E\u0439.)"
  }
];
var english_grade_8 = [
  {
    id: "en_8_q1",
    text: "She ___ to school every day.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["go", "goes", "going", "went"]
  },
  {
    id: "en_8_q2",
    text: "We ___ TV when you called.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["watched", "were watching", "watch", "watching"]
  },
  {
    id: "en_8_q3",
    text: "I ___ never ___ sushi before.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["did / eat", "have / eaten", "am / eating", "was / eating"]
  },
  {
    id: "en_8_q4",
    text: "They ___ in this city since 2020.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["live", "lived", "have lived", "living"]
  },
  {
    id: "en_8_q5",
    text: "There ___ any milk in the fridge.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["isn\u2019t", "aren\u2019t", "don\u2019t", "doesn\u2019t"]
  },
  {
    id: "en_8_q6",
    text: "He is ___ than his brother.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["tall", "taller", "tallest", "more tall"]
  },
  {
    id: "en_8_q7",
    text: "You ___ smoke here. It\u2019s forbidden.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["must", "mustn\u2019t", "can", "should"]
  },
  {
    id: "en_8_q8",
    text: "I ___ go to the party tonight. I\u2019m not sure.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["must", "might", "can\u2019t", "should"]
  },
  {
    id: "en_8_q9",
    text: "She ___ her homework yesterday.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["didn\u2019t do", "doesn\u2019t do", "isn\u2019t doing", "hasn\u2019t do"]
  },
  {
    id: "en_8_q10",
    text: "This is ___ book I\u2019ve ever read.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["good", "better", "the best", "more good"]
  },
  {
    id: "en_8_q11",
    text: "I usually [gap] at 7 a.m.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["wake up", "woke up", "am waking up"]
  },
  {
    id: "en_8_q12",
    text: "She [gap] coffee.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["doesn\u2019t like", "don't like", "didn't liked"]
  },
  {
    id: "en_8_q13",
    text: "We [gap] our grandparents last weekend.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["visit", "visited", "have visited"]
  },
  {
    id: "en_8_q14",
    text: "They [gap] football now.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["play", "played", "are playing"]
  },
  {
    id: "en_8_q15",
    text: "He [gap] his work.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["has already finished", "already finished", "is already finishing"]
  },
  {
    id: "en_8_q16",
    text: "I [gap] to London.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["have never been", "never was", "am never being"]
  },
  {
    id: "en_8_q17",
    text: "She [gap] when I called her.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["studied", "was studying", "is studying"]
  },
  {
    id: "en_8_q18",
    text: "We [gap] to the cinema tomorrow.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["went", "go", "are going"]
  },
  {
    id: "en_8_q19",
    text: "He [gap] the question.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["doesn\u2019t understand", "isn't understanding", "don't understand"]
  },
  {
    id: "en_8_q20",
    text: "They [gap] here for five years.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["live", "are living", "have lived"]
  },
  {
    id: "en_8_q21",
    text: "I\u2019m afraid [gap] spiders.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q22",
    text: "She is interested [gap] music.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q23",
    text: "We arrived [gap] the airport at 6 p.m.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q24",
    text: "He\u2019s good [gap] maths.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q25",
    text: "I usually go to bed [gap] midnight.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q26",
    text: "There isn\u2019t [gap] sugar left.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q27",
    text: "How [gap] money do you need?",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q28",
    text: "This bag is [gap] heavy for me.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q29",
    text: "I don\u2019t have [gap] friends here.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q30",
    text: "She\u2019s the [gap] intelligent student in the class.",
    instruction: "Fill in the gaps with the correct preposition or quantifier",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "of", "from", "for", "any", "some", "much", "many", "too", "most"]
  },
  {
    id: "en_8_q31",
    text: "This test is [gap] than the last one.",
    instruction: "Comparatives & Superlatives",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["easier", "more easy", "the easiest"]
  },
  {
    id: "en_8_q32",
    text: "Who is [gap] student in your class?",
    instruction: "Comparatives & Superlatives",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["the tallest", "tallest", "taller"]
  },
  {
    id: "en_8_q33",
    text: "My room is [gap] than yours.",
    instruction: "Comparatives & Superlatives",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["smaller", "more small", "the smallest"]
  },
  {
    id: "en_8_q34",
    text: "That\u2019s [gap] pizza I\u2019ve ever eaten.",
    instruction: "Comparatives & Superlatives",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["worse", "the worst", "baddest"]
  },
  {
    id: "en_8_q35",
    text: "English is [gap] than Maths for me.",
    instruction: "Comparatives & Superlatives",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["more interesting", "most interesting", "interestinger"]
  },
  {
    id: "en_8_q36",
    text: "Incorrect: They didn\u2019t went to the party.",
    instruction: "Find and correct the mistake. Choose the correct sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["They don't went to the party.", "They didn't go to the party.", "They didn't goes to the party."]
  },
  {
    id: "en_8_q37",
    text: "Incorrect: There is many people in the room.",
    instruction: "Find and correct the mistake. Choose the correct sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["There are many people in the room.", "There is much people in the room.", "There was many people in the room."]
  },
  {
    id: "en_8_q38",
    text: "Incorrect: I have seen him yesterday.",
    instruction: "Find and correct the mistake. Choose the correct sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["I see him yesterday.", "I saw him yesterday.", "I had seen him yesterday."]
  },
  {
    id: "en_8_q39",
    text: "Incorrect: She can to drive a car.",
    instruction: "Find and correct the mistake. Choose the correct sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["She can drive a car.", "She cans drive a car.", "She can driving a car."]
  },
  {
    id: "en_8_q40",
    text: "Incorrect: We are agree with you.",
    instruction: "Find and correct the mistake. Choose the correct sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["We agreeing with you.", "We is agree with you.", "We agree with you."]
  }
];
var english_grade_9 = [
  {
    id: "en_9_q1",
    text: "If I ___ more time, I would learn another language.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["have", "had", "will have", "would have"]
  },
  {
    id: "en_9_q2",
    text: "She ___ working here for five years before she moved abroad.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["has been", "had been", "was", "is"]
  },
  {
    id: "en_9_q3",
    text: "He told me he ___ me later.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["calls", "called", "would call", "will call"]
  },
  {
    id: "en_9_q4",
    text: "This house ___ in the 18th century.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["built", "was built", "is building", "has build"]
  },
  {
    id: "en_9_q5",
    text: "She ___ to the gym regularly these days.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["goes", "is going", "go", "went"]
  },
  {
    id: "en_9_q6",
    text: "I ___ my keys. I can\u2019t find them anywhere.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["lose", "lost", "have lost", "had lost"]
  },
  {
    id: "en_9_q7",
    text: "That\u2019s the man ___ car was stolen.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["who", "which", "whose", "that"]
  },
  {
    id: "en_9_q8",
    text: "If it ___ tomorrow, we will stay at home.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["rains", "will rain", "raining", "rained"]
  },
  {
    id: "en_9_q9",
    text: "When I arrived, they ___ already ___.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["have / left", "had / left", "did / leave", "were / leaving"]
  },
  {
    id: "en_9_q10",
    text: "If I ___ harder, I would have got a promotion.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["work", "worked", "had worked", "have worked"]
  },
  {
    id: "en_9_q11",
    text: "I\u2019m really looking forward [gap] my vacation.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q12",
    text: "She apologized [gap] being late.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q13",
    text: "He insisted [gap] paying for dinner.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q14",
    text: "I\u2019m not used [gap] getting up early.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q15",
    text: "This exercise is different [gap] the previous one.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q16",
    text: "We ran out [gap] milk.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q17",
    text: "She\u2019s afraid [gap] losing her job.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q18",
    text: "He succeeded [gap] passing the exam.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q19",
    text: "I\u2019m interested [gap] improving my English.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q20",
    text: "There\u2019s no point [gap] arguing.",
    instruction: "Fill in the gaps with the correct preposition",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["in", "on", "at", "to", "for", "from", "of", "with", "about"]
  },
  {
    id: "en_9_q21",
    text: "I [gap] for you for over an hour!",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["wait", "have been waiting", "was waiting"]
  },
  {
    id: "en_9_q22",
    text: "She [gap] when the phone rang.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["worked", "was working", "has worked"]
  },
  {
    id: "en_9_q23",
    text: "They [gap] the project yet.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["didn't finish", "haven't finished", "aren't finishing"]
  },
  {
    id: "en_9_q24",
    text: "He said he [gap] later.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["will come", "would come", "comes"]
  },
  {
    id: "en_9_q25",
    text: "If I [gap] you, I wouldn\u2019t do that.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["am", "was", "were"]
  },
  {
    id: "en_9_q26",
    text: "We [gap] when they arrived.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["already ate", "had already eaten", "were already eating"]
  },
  {
    id: "en_9_q27",
    text: "This book [gap] by a famous author.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["was written", "wrote", "is writing"]
  },
  {
    id: "en_9_q28",
    text: "She [gap] to improve her English recently.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["tries", "has been trying", "was trying"]
  },
  {
    id: "en_9_q29",
    text: "She [gap] speak three languages when she was 10.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["can", "was able to", "could to"]
  },
  {
    id: "en_9_q30",
    text: "They [gap] football when it started to rain.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["played", "were playing", "have played"]
  },
  {
    id: "en_9_q31",
    text: "You [gap] smoke here. It\u2019s prohibited.",
    instruction: "Complete the sentences with the correct modal verb",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"]
  },
  {
    id: "en_9_q32",
    text: "I\u2019m not sure, but she [gap] be at home \u2013 let\u2019s call her.",
    instruction: "Complete the sentences with the correct modal verb",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"]
  },
  {
    id: "en_9_q33",
    text: "You look tired. You [gap] take a break.",
    instruction: "Complete the sentences with the correct modal verb",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"]
  },
  {
    id: "en_9_q34",
    text: "He [gap] speak three languages when he was five years old.",
    instruction: "Complete the sentences with the correct modal verb",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"]
  },
  {
    id: "en_9_q35",
    text: "In England, you [gap] drive on the left.",
    instruction: "Complete the sentences with the correct modal verb",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["can", "could", "must", "mustn't", "might", "should", "have to"]
  },
  {
    id: "en_9_q36",
    text: "Incorrect: She don\u2019t enjoy watching TV in the evening.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["She aren't enjoy watching TV in the evening.", "She doesn't enjoy watching TV in the evening.", "She hasn't enjoy watching TV in the evening."]
  },
  {
    id: "en_9_q37",
    text: "Incorrect: I have seen him yesterday at the cinema.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["I saw him yesterday at the cinema.", "I had seen him yesterday at the cinema.", "I was seeing him yesterday at the cinema."]
  },
  {
    id: "en_9_q38",
    text: "Incorrect: He was drive when the accident happened.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["He was driven when the accident happened.", "He was driving when the accident happened.", "He driving when the accident happened."]
  },
  {
    id: "en_9_q39",
    text: "Incorrect: We didn\u2019t went to school yesterday.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["We didn't go to school yesterday.", "We don't went to school yesterday.", "We didn't goes to school yesterday."]
  },
  {
    id: "en_9_q40",
    text: "Incorrect: They have been know each other for years.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["They have known each other for years.", "They have knowing each other for years.", "They knowed each other for years."]
  },
  {
    id: "en_9_q41",
    text: "Incorrect: If I will see her, I will tell her.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["If I saw her, I will tell her.", "If I seeing her, I will tell her.", "If I see her, I will tell her."]
  },
  {
    id: "en_9_q42",
    text: "Incorrect: She suggested to go out for dinner.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["She suggested going out for dinner.", "She suggested go out for dinner.", "She suggested went out for dinner."]
  },
  {
    id: "en_9_q43",
    text: "Incorrect: If I knew about the problem, I will help you.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["If I knew about the problem, I can help you.", "If I knew about the problem, I would help you.", "If I knew about the problem, I had helped you."]
  },
  {
    id: "en_9_q44",
    text: "Incorrect: He said \u201CI am busy\u201D \u2192 He said that he is busy.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["He said that he was busy.", "He said that he will be busy.", "He said that he has been busy."]
  },
  {
    id: "en_9_q45",
    text: "Incorrect: I didn\u2019t use to liked coffee, but now I do.",
    instruction: "Find and correct ONE mistake in each sentence.",
    points: 1,
    type: "multiple_choice",
    options: ["I didn\u2019t use to liking coffee, but now I do.", "I didn\u2019t used to like coffee, but now I do.", "I didn\u2019t use to like coffee, but now I do."]
  }
];
var english_grade_10_11 = [
  {
    id: "en_10_11_q1",
    text: "If I ___ earlier, I wouldn\u2019t have missed the train.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["left", "had left", "would leave", "have left"]
  },
  {
    id: "en_10_11_q2",
    text: "By the time we arrived, they ___ dinner.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["finished", "have finished", "had finished", "were finishing"]
  },
  {
    id: "en_10_11_q3",
    text: "She ___ working here for ten years before she finally quit.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["has been", "had been", "was", "is"]
  },
  {
    id: "en_10_11_q4",
    text: "He ___ me he would call, but he didn\u2019t.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["said", "told", "spoke", "talked"]
  },
  {
    id: "en_10_11_q5",
    text: "I\u2019d rather you ___ me the truth.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["tell", "told", "have told", "telling"]
  },
  {
    id: "en_10_11_q6",
    text: "She ___ have forgotten about the meeting \u2014 she\u2019s usually very organized.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["must", "might", "can\u2019t", "should"]
  },
  {
    id: "en_10_11_q7",
    text: "The more you practice, the ___ you become.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["better", "best", "good", "well"]
  },
  {
    id: "en_10_11_q8",
    text: "He denied ___ the money.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["to take", "taking", "take", "taken"]
  },
  {
    id: "en_10_11_q9",
    text: "I wish I ___ more time to finish the project.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["have", "had", "will have", "have had"]
  },
  {
    id: "en_10_11_q10",
    text: "She ___ her phone when I saw her.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["was using", "used", "has used", "had used"]
  },
  {
    id: "en_10_11_q11",
    text: "If he ___ harder, he would be more successful now.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["works", "worked", "had worked", "would work"]
  },
  {
    id: "en_10_11_q12",
    text: "He ___ living here since 2015.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["is", "was", "has been", "had been"]
  },
  {
    id: "en_10_11_q13",
    text: "By this time tomorrow, I ___ on the beach.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["will lie", "will be lying", "lie", "am lying"]
  },
  {
    id: "en_10_11_q14",
    text: "Don\u2019t call me at 8 \u2014 I ___ dinner then.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["will have", "will be having", "have", "am having"]
  },
  {
    id: "en_10_11_q15",
    text: "If you heat water to 100\xB0C, it ___.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["boils", "will boil", "would boil", "is boiling"]
  },
  {
    id: "en_10_11_q16",
    text: "This book ___ to be one of the best of the year.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["says", "is said", "is saying", "said"]
  },
  {
    id: "en_10_11_q17",
    text: "He ___ his car repaired last week.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["made", "did", "had", "got"]
  },
  {
    id: "en_10_11_q18",
    text: "I\u2019m slowly getting used to ___ up early.",
    instruction: "Choose the correct answer",
    points: 1,
    type: "multiple_choice",
    options: ["wake", "waking", "woke", "be waking"]
  },
  {
    id: "en_10_11_q19",
    text: "If I [gap] about the problem, I would have helped you.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["knew", "know", "had known"]
  },
  {
    id: "en_10_11_q20",
    text: "She [gap] there for five years before she left.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["worked", "had worked", "has worked"]
  },
  {
    id: "en_10_11_q21",
    text: "I wish I [gap] that yesterday.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["didn't say", "haven't said", "hadn\u2019t said"]
  },
  {
    id: "en_10_11_q22",
    text: "He [gap] his car all morning, so he\u2019s tired now.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["is fixing", "had fixed", "has been fixing"]
  },
  {
    id: "en_10_11_q23",
    text: "By next month, they [gap] the new bridge.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["will build", "will have built", "are building"]
  },
  {
    id: "en_10_11_q24",
    text: "She said she [gap] the report by the next day.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["would finish", "will finish", "finished"]
  },
  {
    id: "en_10_11_q25",
    text: "If I [gap] you, I would accept the offer.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["am", "was", "were"]
  },
  {
    id: "en_10_11_q26",
    text: "They [gap] the task yet.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["didn't complete", "haven\u2019t completed", "aren't completing"]
  },
  {
    id: "en_10_11_q27",
    text: "He admitted [gap] the window.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["breaking", "to break", "broke"]
  },
  {
    id: "en_10_11_q28",
    text: "We [gap] for over two hours when the bus finally arrived.",
    instruction: "Put the verb in the correct form",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["were waiting", "had been waiting", "have waited"]
  },
  {
    id: "en_10_11_q29",
    text: "Incorrect: If I would have known, I would have helped you.",
    instruction: "Error Correction: Find and correct ONE mistake",
    points: 1,
    type: "multiple_choice",
    options: ["If I knew, I would have helped you.", "If I had known, I would have helped you.", "If I have known, I would have helped you."]
  },
  {
    id: "en_10_11_q30",
    text: "Incorrect: He told me that he will come later.",
    instruction: "Error Correction: Find and correct ONE mistake",
    points: 1,
    type: "multiple_choice",
    options: ["He told me that he would come later.", "He told me that he comes later.", "He told me that he has come later."]
  },
  {
    id: "en_10_11_q31",
    text: "Incorrect: I have been seeing this film already.",
    instruction: "Error Correction: Find and correct ONE mistake",
    points: 1,
    type: "multiple_choice",
    options: ["I had seen this film already.", "I have already seen this film.", "I was seeing this film already."]
  },
  {
    id: "en_10_11_q32",
    text: "Incorrect: She suggested to take a break.",
    instruction: "Error Correction: Find and correct ONE mistake",
    points: 1,
    type: "multiple_choice",
    options: ["She suggested taking a break.", "She suggested take a break.", "She suggested took a break."]
  },
  {
    id: "en_10_11_q33",
    text: "Incorrect: The project was completed by they.",
    instruction: "Error Correction: Find and correct ONE mistake",
    points: 1,
    type: "multiple_choice",
    options: ["The project was completed by their.", "The project was completed by them.", "The project was completed by theirs."]
  },
  {
    id: "en_10_11_q34",
    text: "Incorrect: I look forward to hear from you.",
    instruction: "Error Correction: Find and correct ONE mistake",
    points: 1,
    type: "multiple_choice",
    options: ["I look forward to hearing from you.", "I look forward for hear from you.", "I look forward heard from you."]
  },
  {
    id: "en_10_11_q35",
    text: "Many people believe that working from home is more productive. [gap], recent studies suggest the opposite is sometimes true.",
    instruction: "Complete the text with ONE word in each gap (Clauses of contrast).",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"]
  },
  {
    id: "en_10_11_q36",
    text: "[gap] the flexibility it offers, some employees struggle with focus.",
    instruction: "Complete the text with ONE word in each gap (Clauses of contrast).",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"]
  },
  {
    id: "en_10_11_q37",
    text: "[gap], others thrive without office distractions.",
    instruction: "Complete the text with ONE word in each gap (Clauses of contrast).",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"]
  },
  {
    id: "en_10_11_q38",
    text: "[gap] a home environment may suit introverts...",
    instruction: "Complete the text with ONE word in each gap (Clauses of contrast).",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"]
  },
  {
    id: "en_10_11_q39",
    text: "...[gap] extroverts often miss social interaction.",
    instruction: "Complete the text with ONE word in each gap (Clauses of contrast).",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"]
  },
  {
    id: "en_10_11_q40",
    text: "[gap] these differences, most companies now adopt hybrid models.",
    instruction: "Complete the text with ONE word in each gap (Clauses of contrast).",
    points: 1,
    type: "inline_dropdown",
    inlineOptions: ["despite", "although", "however", "whereas", "nevertheless", "in spite of", "while"]
  },
  {
    id: "en_10_11_q41",
    text: "for / been / has / she / looking / job / a / months / six / for",
    instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.",
    points: 1,
    type: "drag_and_drop",
    dragItems: ["for", "been", "has", "she", "looking", "job", "a", "months", "six", "for"]
  },
  {
    id: "en_10_11_q42",
    text: "remember / I / lock / door / the / to / before / leaving",
    instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.",
    points: 1,
    type: "drag_and_drop",
    dragItems: ["remember", "I", "lock", "door", "the", "to", "before", "leaving"]
  },
  {
    id: "en_10_11_q43",
    text: "at / would / I / rather / home / stay / than / go / out",
    instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.",
    points: 1,
    type: "drag_and_drop",
    dragItems: ["at", "would", "I", "rather", "home", "stay", "than", "go", "out"]
  },
  {
    id: "en_10_11_q44",
    text: "the / despite / rain / heavy / went / they / out",
    instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.",
    points: 1,
    type: "drag_and_drop",
    dragItems: ["the", "despite", "rain", "heavy", "went", "they", "out"]
  },
  {
    id: "en_10_11_q45",
    text: "try / button / pressing / this / to / see / if / works / it",
    instruction: "Reordering: Put the words in the correct order to make a grammatical sentence.",
    points: 1,
    type: "drag_and_drop",
    dragItems: ["try", "button", "pressing", "this", "to", "see", "if", "works", "it"]
  }
];
var testsData = {
  "7": {
    grade: 7,
    english: [],
    russian: [
      {
        id: "russian_1",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21161. \u041D\u0430\u0439\u0434\u0438 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u0435\u0441\u0442\u044C \u0444\u0440\u0430\u0437\u0435\u043E\u043B\u043E\u0433\u0438\u0437\u043C:",
        options: [
          "\u041C\u044B \u043D\u0435 \u043C\u043E\u0433\u043B\u0438 \u0440\u0430\u0441\u043F\u0443\u0442\u0430\u0442\u044C \u044D\u0442\u043E\u0442 \u0443\u0437\u0435\u043B \u043D\u0430 \u0432\u0435\u0440\u0435\u0432\u043A\u0435, \u043F\u0440\u0438\u0448\u043B\u043E\u0441\u044C \u0435\u0433\u043E \u0440\u0430\u0437\u0440\u0443\u0431\u0438\u0442\u044C.",
          "\u041F\u0435\u0440\u0432\u0430\u044F \u0441\u043A\u0440\u0438\u043F\u043A\u0430, \u043A\u043E\u0442\u043E\u0440\u0443\u044E \u043F\u043E\u0434\u0430\u0440\u0438\u043B\u0438 \u0432 \u0434\u0435\u0442\u0441\u0442\u0432\u0435 \u0440\u043E\u0434\u0438\u0442\u0435\u043B\u0438, \u0445\u0440\u0430\u043D\u0438\u0442\u0441\u044F \u0443 \u043C\u0435\u043D\u044F \u0438 \u0441\u0435\u0433\u043E\u0434\u043D\u044F.",
          "\u0413\u0432\u043E\u0437\u0434\u0435\u043C \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0431\u044B\u043B\u043E \u0432\u044B\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435 \u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0433\u043E \u0430\u043A\u0442\u0435\u0440\u0430.",
          "\u041E\u043D \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u043B \u0440\u0443\u043A\u0443 \u0432 \u043C\u0435\u0448\u043E\u043A \u0438 \u0432\u044B\u0442\u0430\u0449\u0438\u043B \u043E\u0442\u0442\u0443\u0434\u0430 \u0437\u0430\u0439\u0447\u043E\u043D\u043A\u0430."
        ]
      },
      {
        id: "russian_2",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21162. \u041A\u0430\u043A\u043E\u0435 \u0441\u043B\u043E\u0432\u043E \u043E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u043D\u043E \u043F\u0440\u0438\u0441\u0442\u0430\u0432\u043E\u0447\u043D\u044B\u043C \u0441\u043F\u043E\u0441\u043E\u0431\u043E\u043C?",
        options: ["\u0417\u0430\u043F\u043B\u044B\u0432", "\u0411\u0435\u0437\u0440\u0443\u043A\u0430\u0432\u043A\u0430", "\u0411\u0435\u0441\u043F\u043E\u043B\u0435\u0437\u043D\u044B\u0439", "\u0412\u043E\u0434\u043D\u044B\u0439"]
      },
      {
        id: "russian_3",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u0412 \u043A\u0430\u043A\u043E\u043C \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0435 \u043E\u0442\u0432\u0435\u0442\u0430 \u0432 \u043E\u0431\u043E\u0438\u0445 \u0441\u043B\u043E\u0432\u0430\u0445 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u0430 \u0431\u0443\u043A\u0432\u0430 \u041E?",
        options: [
          "\u0431\u0435\u043B\u044C\u0447\u2026\u043D\u043E\u043A, \u0448\u2026\u043F\u043E\u0442",
          "\u0447\u2026\u0440\u043D\u044B\u0439, \u043C\u043E\u0440\u043E\u0437\u0446\u2026\u043C",
          "\u043A\u0440\u044B\u0436\u2026\u0432\u043D\u0438\u043A, \u0432\u0435\u0449\u2026\u0432\u043E\u0439",
          "\u0434\u0435\u0432\u0447\u2026\u043D\u043A\u0430, \u043F\u043B\u0430\u0449\u2026\u043C"
        ]
      },
      {
        id: "russian_4",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21164. \u0421\u043E \u0432\u0441\u0435\u043C\u0438 \u0441\u043B\u043E\u0432\u0430\u043C\u0438 \u043A\u0430\u043A\u043E\u0433\u043E \u0440\u044F\u0434\u0430 \u041D\u0415 \u043F\u0438\u0448\u0435\u0442\u0441\u044F \u0441\u043B\u0438\u0442\u043D\u043E?",
        options: [
          "(\u043D\u0435) \u0440\u0435\u0448\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C, (\u043D\u0435) \u043F\u043E\u0434\u0432\u0438\u0436\u043D\u0430\u044F \u0432\u043E\u0434\u0430",
          "\u044F\u0432\u043D\u0430\u044F (\u043D\u0435) \u043B\u0435\u043F\u0438\u0446\u0430, (\u043D\u0435)\u0437\u043D\u0430\u044E \u043E\u0442\u0432\u0435\u0442\u0430",
          "\u0432\u043E\u0432\u0441\u0435 (\u043D\u0435) \u0442\u0440\u0443\u0434\u043D\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430, (\u043D\u0435) \u0432\u044B\u0441\u043E\u043A\u0438\u0435 \u0433\u043E\u0440\u044B",
          "(\u043D\u0435) \u0432\u043D\u0438\u043C\u0430\u0442\u0435\u043B\u0435\u043D, \u0430 \u0440\u0430\u0441\u0441\u0435\u044F\u043D, \u043F\u043E\u0433\u043E\u0434\u0430 (\u043D\u0435) \u043B\u0435\u0442\u043D\u044F\u044F"
        ]
      },
      {
        id: "russian_5",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21165. \u0412 \u043A\u0430\u043A\u043E\u043C \u0440\u044F\u0434\u0443 \u0432\u043E \u0432\u0441\u0435\u0445 \u0441\u043B\u043E\u0432\u0430\u0445 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u0430 \u043E\u0434\u043D\u0430 \u0438 \u0442\u0430 \u0436\u0435 \u0431\u0443\u043A\u0432\u0430?",
        options: [
          "\u041F\u0440...\u043C\u043E\u0440\u044C\u0435, \u043F\u0440\u2026\u043C\u0443\u0434\u0440\u044B\u0439, \u043F\u0440\u2026\u043C\u0438\u043B\u044B\u0439",
          "\u041F\u0440\u2026\u043F\u0430\u044F\u0442\u044C, \u043F\u0440\u2026\u043E\u0431\u0440\u0435\u0441\u0442\u0438, \u043F\u0440\u2026\u0443\u0441\u0430\u0434\u0435\u0431\u043D\u044B\u0439",
          "\u041F\u0440\u2026\u0431\u0440\u0435\u0436\u043D\u044B\u0439, \u043F\u0440\u2026\u0437\u0430\u0431\u0430\u0432\u043D\u044B\u0439, \u043F\u0440\u2026\u043D\u0435\u043F\u0440\u0438\u044F\u0442\u043D\u044B\u0439",
          "\u041F\u0440...\u043A\u043B\u0435\u0438\u0442\u044C, \u043F\u0440\u2026\u043E\u0434\u043E\u043B\u0435\u0442\u044C, \u043F\u0440\u2026\u043B\u0435\u0447\u044C"
        ]
      },
      {
        id: "russian_6",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21166. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0441 \u043E\u0448\u0438\u0431\u043A\u043E\u0439 \u0432 \u0443\u043F\u043E\u0442\u0440\u0435\u0431\u043B\u0435\u043D\u0438\u0438 \u0447\u0438\u0441\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0433\u043E:",
        options: [
          "\u041D\u0435\u0442 \u0441 \u0441\u043E\u0431\u043E\u0439 \u0434\u0435\u0432\u044F\u0442\u0438\u0441\u043E\u0442 \u0440\u0443\u0431\u043B\u0435\u0439.",
          "\u042F \u0432\u0441\u0442\u0440\u0435\u0442\u0438\u043B \u0442\u0440\u043E\u0438\u0445 \u0434\u0440\u0443\u0437\u0435\u0439.",
          "\u041C\u044B \u0436\u0438\u0432\u0435\u043C \u0432 \u0442\u0440\u0438\u0441\u0442\u0430 \u0434\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0439 \u043A\u0432\u0430\u0440\u0442\u0438\u0440\u0435.",
          "\u041A \u0447\u0435\u0442\u044B\u0440\u0435\u0445\u0441\u0442\u0430\u043C \u043F\u0440\u0438\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u044F\u0442\u044C\u0434\u0435\u0441\u044F\u0442."
        ]
      },
      {
        id: "ru_7_new",
        type: "dropdown_multiple",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21167. \u0421\u043E\u043E\u0442\u043D\u0435\u0441\u0438\u0442\u0435 \u044F\u0437\u044B\u043A\u043E\u0432\u044B\u0435 \u0442\u0435\u0440\u043C\u0438\u043D\u044B \u0441 \u0438\u0445 \u0444\u0443\u043D\u043A\u0446\u0438\u0435\u0439 (\u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0435\u0439).",
        dropdownItems: [
          { label: "\u041F\u0440\u0438\u043B\u0430\u0433\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0435", options: ["\u0427\u0430\u0441\u0442\u044C \u0440\u0435\u0447\u0438", "\u0427\u043B\u0435\u043D \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F"] },
          { label: "\u0421\u043A\u0430\u0437\u0443\u0435\u043C\u043E\u0435", options: ["\u0427\u0430\u0441\u0442\u044C \u0440\u0435\u0447\u0438", "\u0427\u043B\u0435\u043D \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F"] },
          { label: "\u0421\u043E\u044E\u0437", options: ["\u0427\u0430\u0441\u0442\u044C \u0440\u0435\u0447\u0438", "\u0427\u043B\u0435\u043D \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F"] },
          { label: "\u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435", options: ["\u0427\u0430\u0441\u0442\u044C \u0440\u0435\u0447\u0438", "\u0427\u043B\u0435\u043D \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F"] },
          { label: "\u0421\u0443\u0449\u0435\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435", options: ["\u0427\u0430\u0441\u0442\u044C \u0440\u0435\u0447\u0438", "\u0427\u043B\u0435\u043D \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F"] }
        ]
      },
      {
        id: "russian_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21168. \u041E\u0442\u043C\u0435\u0442\u044C\u0442\u0435, \u0433\u0434\u0435 \u0437\u043D\u0430\u043A\u0438 \u0440\u0430\u0441\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u044B \u0412\u0415\u0420\u041D\u041E:",
        options: [
          "\u0418\u0437-\u043F\u043E\u0434 \u044D\u0442\u043E\u0439 \u0442\u0443\u0447\u0438 \u0432\u044B\u0440\u0432\u0430\u043B\u0438\u0441\u044C \u044F\u0440\u043A\u0438\u0435 \u043B\u0443\u0447\u0438, \u0438 \u043C\u043E\u043A\u0440\u044B\u0435 \u043B\u0435\u0441\u0430 \u0438 \u043F\u043E\u043B\u044F \u0437\u0430\u0441\u0432\u0435\u0440\u043A\u0430\u043B\u0438.",
          "\u0418\u0437-\u043F\u043E\u0434 \u044D\u0442\u043E\u0439 \u0442\u0443\u0447\u0438 \u0432\u044B\u0440\u0432\u0430\u043B\u0438\u0441\u044C \u044F\u0440\u043A\u0438\u0435 \u043B\u0443\u0447\u0438, \u0438 \u043C\u043E\u043A\u0440\u044B\u0435 \u043B\u0435\u0441\u0430, \u0438 \u043F\u043E\u043B\u044F \u0437\u0430\u0441\u0432\u0435\u0440\u043A\u0430\u043B\u0438.",
          "\u0418\u0437-\u043F\u043E\u0434 \u044D\u0442\u043E\u0439 \u0442\u0443\u0447\u0438 \u0432\u044B\u0440\u0432\u0430\u043B\u0438\u0441\u044C \u044F\u0440\u043A\u0438\u0435 \u043B\u0443\u0447\u0438 \u0438 \u043C\u043E\u043A\u0440\u044B\u0435 \u043B\u0435\u0441\u0430, \u0438 \u043F\u043E\u043B\u044F \u0437\u0430\u0441\u0432\u0435\u0440\u043A\u0430\u043B\u0438."
        ]
      },
      {
        id: "ru_9",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21169. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u0435\u0441\u0442\u044C \u0444\u0440\u0430\u0437\u0435\u043E\u043B\u043E\u0433\u0438\u0437\u043C.",
        options: [
          "\u041C\u044B \u043D\u0435 \u043C\u043E\u0433\u043B\u0438 \u0440\u0430\u0441\u043F\u0443\u0442\u0430\u0442\u044C \u044D\u0442\u043E\u0442 \u0443\u0437\u0435\u043B \u043D\u0430 \u0432\u0435\u0440\u0435\u0432\u043A\u0435, \u043F\u0440\u0438\u0448\u043B\u043E\u0441\u044C \u0435\u0433\u043E \u0440\u0430\u0437\u0440\u0443\u0431\u0438\u0442\u044C.",
          "\u041F\u0435\u0440\u0432\u0430\u044F \u0441\u043A\u0440\u0438\u043F\u043A\u0430, \u043A\u043E\u0442\u043E\u0440\u0443\u044E \u043F\u043E\u0434\u0430\u0440\u0438\u043B\u0438 \u0432 \u0434\u0435\u0442\u0441\u0442\u0432\u0435 \u0440\u043E\u0434\u0438\u0442\u0435\u043B\u0438, \u0445\u0440\u0430\u043D\u0438\u0442\u0441\u044F \u0443 \u043C\u0435\u043D\u044F \u0438 \u0441\u0435\u0433\u043E\u0434\u043D\u044F.",
          "\u0413\u0432\u043E\u0437\u0434\u0435\u043C \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u044B \u0431\u044B\u043B\u043E \u0432\u044B\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0435 \u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0433\u043E \u0430\u043A\u0442\u0435\u0440\u0430.",
          "\u041E\u043D \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u043B \u0440\u0443\u043A\u0443 \u0432 \u043C\u0435\u0448\u043E\u043A \u0438 \u0432\u044B\u0442\u0430\u0449\u0438\u043B \u043E\u0442\u0442\u0443\u0434\u0430 \u0437\u0430\u0439\u0447\u043E\u043D\u043A\u0430."
        ]
      },
      {
        id: "ru_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211610. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0432\u0435\u0440\u043D\u043E\u0435 \u0442\u043E\u043B\u043A\u043E\u0432\u0430\u043D\u0438\u0435 \u0441\u043B\u043E\u0432\u0430 \u041F\u0423\u041D\u041A\u0422\u0423\u0410\u041B\u042C\u041D\u042B\u0419:",
        options: ["\u041C\u0435\u0441\u0442\u043D\u044B\u0439", "\u0410\u043A\u043A\u0443\u0440\u0430\u0442\u043D\u044B\u0439, \u0442\u043E\u0447\u043D\u044B\u0439", "\u041C\u0435\u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439", "\u0411\u0435\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439"]
      },
      {
        id: "ru_11",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211611. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0441 \u043E\u0448\u0438\u0431\u043A\u043E\u0439 \u0432 \u0443\u043F\u043E\u0442\u0440\u0435\u0431\u043B\u0435\u043D\u0438\u0438 \u0447\u0438\u0441\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0433\u043E:",
        options: [
          "\u041D\u0435\u0442 \u0441 \u0441\u043E\u0431\u043E\u0439 \u0434\u0435\u0432\u044F\u0442\u0438\u0441\u043E\u0442 \u0440\u0443\u0431\u043B\u0435\u0439.",
          "\u042F \u0432\u0441\u0442\u0440\u0435\u0442\u0438\u043B \u0442\u0440\u043E\u0438\u0445 \u0434\u0440\u0443\u0437\u0435\u0439.",
          "\u041C\u044B \u0436\u0438\u0432\u0435\u043C \u0432 \u0442\u0440\u0438\u0441\u0442\u0430 \u0434\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u043E\u0439 \u043A\u0432\u0430\u0440\u0442\u0438\u0440\u0435.",
          "\u041A \u0447\u0435\u0442\u044B\u0440\u0435\u0445\u0441\u0442\u0430\u043C \u043F\u0440\u0438\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u044F\u0442\u044C\u0434\u0435\u0441\u044F\u0442."
        ]
      },
      {
        id: "ru_12",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211612. \u0412 \u043A\u0430\u043A\u043E\u043C \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u044B \u0432\u0441\u0435 \u0441\u043B\u043E\u0432\u0430, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043F\u0438\u0448\u0443\u0442\u0441\u044F \u0447\u0435\u0440\u0435\u0437 \u0434\u0435\u0444\u0438\u0441?",
        options: [
          "(\u0432\u043E\u0441\u0442\u043E\u0447\u043D\u043E)\u0435\u0432\u0440\u043E\u043F\u0435\u0439\u0441\u043A\u0438\u0439, \u0433\u043E\u0440\u044C\u043A\u043E(\u0441\u043E\u043B\u0435\u043D\u044B\u0439), (\u043A\u043E\u0435)\u0441 \u0447\u0435\u043C",
          "(\u0436\u0435\u043B\u0442\u043E)\u0437\u0435\u043B\u0435\u043D\u044B\u0439, (\u0442\u0435\u043C\u043D\u043E)\u0432\u043E\u043B\u043E\u0441\u044B\u0439, (\u0437\u0430\u043F\u0430\u0434\u043D\u043E)\u0441\u0438\u0431\u0438\u0440\u0441\u043A\u0438\u0439",
          "(\u0434\u0440\u0435\u0432\u043D\u0435)\u0440\u0443\u0441\u0441\u043A\u0438\u0439, (\u0436\u0435\u043B\u0435\u0437\u043D\u043E)\u0434\u043E\u0440\u043E\u0436\u043D\u044B\u0439, (\u043E\u0444\u0438\u0446\u0438\u0430\u043B\u044C\u043D\u043E)\u0434\u0435\u043B\u043E\u0432\u043E\u0439",
          "\u043A\u0430\u043A\u043E\u0439(\u043B\u0438\u0431\u043E), (\u0448\u0430\u0445\u043C\u0430\u0442\u043D\u043E)\u0448\u0430\u0448\u0435\u0447\u043D\u044B\u0439, \u044F\u0440\u043A\u043E(\u043A\u0440\u0430\u0441\u043D\u044B\u0439)"
        ]
      },
      {
        id: "ru_13",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211613. \u041E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442, \u0433\u0434\u0435 \u0437\u043D\u0430\u043A\u0438 \u043F\u0440\u0435\u043F\u0438\u043D\u0430\u043D\u0438\u044F \u0440\u0430\u0441\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u044B \u0412\u0415\u0420\u041D\u041E:",
        options: [
          "\u0418\u0437-\u043F\u043E\u0434 \u044D\u0442\u043E\u0439 \u0442\u0443\u0447\u0438 \u0432\u044B\u0440\u0432\u0430\u043B\u0438\u0441\u044C \u044F\u0440\u043A\u0438\u0435 \u043B\u0443\u0447\u0438, \u0438 \u043C\u043E\u043A\u0440\u044B\u0435 \u043B\u0435\u0441\u0430 \u0438 \u043F\u043E\u043B\u044F \u0437\u0430\u0441\u0432\u0435\u0440\u043A\u0430\u043B\u0438.",
          "\u0418\u0437-\u043F\u043E\u0434 \u044D\u0442\u043E\u0439 \u0442\u0443\u0447\u0438 \u0432\u044B\u0440\u0432\u0430\u043B\u0438\u0441\u044C \u044F\u0440\u043A\u0438\u0435 \u043B\u0443\u0447\u0438, \u0438 \u043C\u043E\u043A\u0440\u044B\u0435 \u043B\u0435\u0441\u0430, \u0438 \u043F\u043E\u043B\u044F \u0437\u0430\u0441\u0432\u0435\u0440\u043A\u0430\u043B\u0438.",
          "\u0418\u0437-\u043F\u043E\u0434 \u044D\u0442\u043E\u0439 \u0442\u0443\u0447\u0438 \u0432\u044B\u0440\u0432\u0430\u043B\u0438\u0441\u044C \u044F\u0440\u043A\u0438\u0435 \u043B\u0443\u0447\u0438 \u0438 \u043C\u043E\u043A\u0440\u044B\u0435 \u043B\u0435\u0441\u0430, \u0438 \u043F\u043E\u043B\u044F \u0437\u0430\u0441\u0432\u0435\u0440\u043A\u0430\u043B\u0438."
        ]
      }
    ],
    math: [
      {
        id: "ma_3_new",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u0427\u0435\u043C\u0443 \u0440\u0430\u0432\u043D\u0430 \u0440\u0430\u0437\u043D\u043E\u0441\u0442\u044C \u0447\u0438\u0441\u0435\u043B 15/7 \u0438 20/3?",
        html: "\u0427\u0435\u043C\u0443 \u0440\u0430\u0432\u043D\u0430 \u0440\u0430\u0437\u043D\u043E\u0441\u0442\u044C \u0447\u0438\u0441\u0435\u043B <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 4px;'><span style='border-bottom:1px solid currentColor;'>15</span><span>7</span></span> \u0438 <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 4px;'><span style='border-bottom:1px solid currentColor;'>20</span><span>3</span></span> ?",
        options: ["35/10", "60/19", "5/4", "60/37"]
      },
      {
        id: "math_1",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21161. \u0420\u0430\u0437\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0447\u0438\u0441\u043B\u0430 42 \u043D\u0430 \u043F\u0440\u043E\u0441\u0442\u044B\u0435 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u0438 \u0438\u043C\u0435\u0435\u0442 \u0432\u0438\u0434.",
        options: ["4\xB72\xB77", "2\u22193\u22197", "2\u22192\u22193\u22197", "6\u22197"]
      },
      {
        id: "math_2",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21162. \u041A\u0430\u043A\u043E\u0435 \u0438\u0437 \u0447\u0438\u0441\u0435\u043B \u0434\u0435\u043B\u0438\u0442\u0441\u044F \u043D\u0430 5?",
        options: ["121333", "133050", "411148", "555554"]
      },
      {
        id: "math_3",
        type: "free_text",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u0427\u0435\u043C\u0443 \u0440\u0430\u0432\u043D\u0430 \u0440\u0430\u0437\u043D\u043E\u0441\u0442\u044C \u0447\u0438\u0441\u0435\u043B 7/15 \u0438 3/20? (\u0418\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E \u043F\u043E \u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044E)"
      },
      {
        id: "math_4",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21164. \u0421\u043A\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0442\u0443\u0440\u0430\u043B\u044C\u043D\u044B\u0445 \u0447\u0438\u0441\u0435\u043B \u0440\u0430\u0441\u043F\u043E\u043B\u043E\u0436\u0435\u043D\u043E \u043D\u0430 \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u043D\u043E\u0439 \u043F\u0440\u044F\u043C\u043E\u0439 \u043C\u0435\u0436\u0434\u0443 \u0447\u0438\u0441\u043B\u0430\u043C\u0438 \u22124 \u0438 5?",
        options: ["4", "5", "6", "9"]
      },
      {
        id: "math_5",
        type: "free_text",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21165. \u0412\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u0435 4 - 1(2/3). (\u0418\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E \u043F\u043E \u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u044E)"
      },
      {
        id: "math_6",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21166. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043E\u0434\u043D\u0443 \u0432\u043E\u0441\u044C\u043C\u0443\u044E \u0447\u0430\u0441\u0442\u044C \u043E\u0442 \u0447\u0438\u0441\u043B\u0430 32000.",
        options: ["300", "4000", "40", "1600"]
      },
      {
        id: "math_7",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21167. \u0421\u0440\u0430\u0432\u043D\u0438 \u0438 \u043F\u043E\u0441\u0442\u0430\u0432\u044C \u0437\u043D\u0430\u043A: 8\u043C 6\u0434\u043C 4\u0441\u043C \u2013 763 \u0441\u043C \u2026 8\u043C \u2013 6\u043C 98\u0441\u043C",
        options: ["\u0411\u043E\u043B\u044C\u0448\u0435", "\u041C\u0435\u043D\u044C\u0448\u0435", "\u0420\u0430\u0432\u043D\u043E"]
      },
      {
        id: "math_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21168. \u0420\u0435\u0448\u0435\u043D\u0438\u0435\u043C \u043A\u0430\u043A\u043E\u0433\u043E \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0447\u0438\u0441\u043B\u043E 9?",
        options: ["96 \u2013 \u0425 = 85", "63 : \u0425 = 7", "\u0425 + 8 = 16"]
      },
      {
        id: "math_9",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21169. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043F\u043B\u043E\u0449\u0430\u0434\u044C \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u0430, \u0435\u0441\u043B\u0438 \u0435\u0433\u043E \u043F\u0435\u0440\u0438\u043C\u0435\u0442\u0440 \u0440\u0430\u0432\u0435\u043D \u043F\u0435\u0440\u0438\u043C\u0435\u0442\u0440\u0443 \u043F\u0440\u044F\u043C\u043E\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0430 \u0441\u043E \u0441\u0442\u043E\u0440\u043E\u043D\u0430\u043C\u0438 16 \u0441\u043C \u0438 4 \u0441\u043C.",
        options: ["300 \u0441\u043C\xB2", "100 \u0441\u043C\xB2", "200 \u0441\u043C\xB2", "400 \u0441\u043C\xB2"]
      },
      {
        id: "math_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211610. \u0418\u0437 \u0434\u0432\u0443\u0445 \u0433\u043E\u0440\u043E\u0434\u043E\u0432 \u043D\u0430\u0432\u0441\u0442\u0440\u0435\u0447\u0443 \u0434\u0440\u0443\u0433 \u0434\u0440\u0443\u0433\u0443 \u0432\u044B\u0435\u0445\u0430\u043B\u0438 \u0434\u0432\u0435 \u043C\u0430\u0448\u0438\u043D\u044B. \u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043F\u0435\u0440\u0432\u043E\u0439 \u2013 60 \u043A\u043C/\u0447, \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0432\u0442\u043E\u0440\u043E\u0439 \u2013 80 \u043A\u043C/\u0447. \u0427\u0435\u0440\u0435\u0437 \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0447\u0430\u0441\u043E\u0432 \u043C\u0430\u0448\u0438\u043D\u044B \u0432\u0441\u0442\u0440\u0435\u0442\u044F\u0442\u0441\u044F, \u0435\u0441\u043B\u0438 \u0440\u0430\u0441\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043C\u0435\u0436\u0434\u0443 \u0433\u043E\u0440\u043E\u0434\u0430\u043C\u0438 280 \u043A\u043C?",
        options: ["1 \u0447\u0430\u0441", "3 \u0447\u0430\u0441\u0430", "30 \u043C\u0438\u043D", "2 \u0447\u0430\u0441\u0430"]
      },
      {
        id: "math_11",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211611. \u0412 \u0430\u0442\u0435\u043B\u044C\u0435 \u043F\u0440\u0438\u0432\u0435\u0437\u043B\u0438 320 \u043C\u0435\u0442\u0440\u043E\u0432 \u0442\u043A\u0430\u043D\u0438. \u0418\u0437 \u044D\u0442\u043E\u0439 \u0442\u043A\u0430\u043D\u0438 \u0441\u0448\u0438\u043B\u0438 28 \u0431\u043B\u0443\u0437\u043E\u043A, \u0440\u0430\u0441\u0445\u043E\u0434\u0443\u044F \u043D\u0430 \u043A\u0430\u0436\u0434\u0443\u044E \u043F\u043E 3 \u043C\u0435\u0442\u0440\u0430. \u0418\u0437 \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u043E\u0439 \u0442\u043A\u0430\u043D\u0438 \u0441\u0448\u0438\u043B\u0438 \u0440\u0443\u0431\u0430\u0448\u043A\u0438, \u0440\u0430\u0441\u0445\u043E\u0434\u0443\u044F \u043D\u0430 \u043A\u0430\u0436\u0434\u0443\u044E \u043F\u043E 4 \u043C\u0435\u0442\u0440\u0430. \u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0440\u0443\u0431\u0430\u0448\u0435\u043A \u0441\u0448\u0438\u043B\u0438?",
        options: ["39", "49", "59", "69"]
      }
    ],
    logic: commonLogicQuestions
  },
  "8": {
    grade: 8,
    english: english_grade_8,
    russian: [
      {
        id: "russian_1",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21161. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0441\u043B\u043E\u0432\u043E\u0441\u043E\u0447\u0435\u0442\u0430\u043D\u0438\u0435 \u0441\u043E \u0441\u0442\u0440\u0430\u0434\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u043F\u0440\u0438\u0447\u0430\u0441\u0442\u0438\u0435\u043C",
        options: [
          "\u0420\u0430\u0441\u043A\u043E\u043B\u043E\u0442\u044B\u0439 \u043E\u0440\u0435\u0445",
          "\u0418\u0433\u0440\u0430\u0432\u0448\u0438\u0439 \u0440\u0435\u0431\u0435\u043D\u043E\u043A",
          "\u041A\u043E\u043B\u044E\u0449\u0438\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442",
          "\u0421\u043E\u0433\u043D\u0443\u0432\u0448\u0438\u0439 \u0432\u0435\u0442\u043A\u0443"
        ]
      },
      {
        id: "russian_2",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21162. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0441\u043B\u043E\u0432\u043E\u0441\u043E\u0447\u0435\u0442\u0430\u043D\u0438\u0435 \u0441 \u0434\u0435\u0435\u043F\u0440\u0438\u0447\u0430\u0441\u0442\u0438\u0435\u043C \u0441\u043E\u0432\u0435\u0440\u0448\u0435\u043D\u043D\u043E\u0433\u043E \u0432\u0438\u0434\u0430",
        options: [
          "\u041D\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u043E\u0435 \u043F\u0438\u0441\u044C\u043C\u043E",
          "\u0417\u043D\u0430\u044F \u043E \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0435",
          "\u041D\u0430\u0439\u0434\u0443 \u043E\u0448\u0438\u0431\u043A\u0438",
          "\u041A\u0443\u043F\u0438\u0432 \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u044B"
        ]
      },
      {
        id: "russian_3",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0440\u0438\u0447\u0430\u0441\u0442\u0438\u0435 \u0441 \u0441\u0443\u0444\u0444\u0438\u043A\u0441\u043E\u043C \u2013\u0410\u0429-(-\u042F\u0429-)",
        options: [
          "\u0411\u0440\u0435\u2026\u0449\u0438\u0439\u0441\u044F \u043C\u0443\u0436\u0447\u0438\u043D\u0430",
          "\u041F\u043B\u0435\u0449\u2026\u0449\u0438\u0435\u0441\u044F \u0432\u043E\u043B\u043D\u044B",
          "\u0421\u0442\u0440\u043E\u2026\u0449\u0438\u0439\u0441\u044F \u0434\u043E\u043C",
          "\u0420\u0435\u0448\u0430\u2026\u0449\u0438\u0439 \u0432\u043E\u043F\u0440\u043E\u0441"
        ]
      },
      {
        id: "russian_4",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21164. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0440\u0438\u0447\u0430\u0441\u0442\u0438\u0435 \u0441 \u0441\u0443\u0444\u0444\u0438\u043A\u0441\u043E\u043C \u2013\u0418\u041C-.",
        options: [
          "\u0413\u043E\u043D\u044F\u2026\u043C\u044B\u0435 \u043F\u043E \u043F\u043E\u043B\u044E",
          "\u0412\u0438\u0434\u2026\u043C\u044B\u0439 \u0441\u0432\u0435\u0442",
          "\u0412\u044B\u043F\u043E\u043B\u043D\u044F\u2026\u043C\u044B\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u044F",
          "\u0417\u0430\u043F\u043E\u043B\u043D\u044F\u2026\u043C\u044B\u0435 \u0431\u043B\u0430\u043D\u043A\u0438"
        ]
      },
      {
        id: "russian_5",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21165. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0441\u043B\u043E\u0432\u043E \u0441 \u043E\u0440\u0444\u043E\u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u043E\u0448\u0438\u0431\u043A\u043E\u0439.",
        options: ["\u041F\u043E\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0439", "\u041E\u0431\u0438\u0434\u0435\u0432", "\u0420\u0430\u0441\u0442\u0430\u0438\u0432", "\u0417\u0430\u043F\u0430\u044F\u043D\u043D\u044B\u0439"]
      },
      {
        id: "russian_6",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21166. \u041E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \u0440\u044F\u0434, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u0432\u0441\u0435 \u0441\u043B\u043E\u0432\u0430 \u043F\u0438\u0448\u0443\u0442\u0441\u044F \u0441 \u043E\u0434\u043D\u043E\u0439 \u041D.",
        options: [
          "\u0420\u0430\u0441\u043F\u0438\u043B\u0435\u2026.\u044B\u0435 \u0434\u0440\u043E\u0432\u0430, \u043F\u0443\u0433\u0430\u2026.\u0430\u044F \u0432\u043E\u0440\u043E\u043D\u0430",
          "\u041D\u0435\u0433\u043B\u0430\u0436\u0435\u2026.\u043E\u0435 \u0431\u0435\u043B\u044C\u0435, \u0438\u0437\u0431\u0430\u043B\u043E\u0432\u0430\u2026.\u044B\u0439 \u0440\u0435\u0431\u0435\u043D\u043E\u043A",
          "\u0421\u0442\u0440\u0438\u0436\u0435\u2026.\u044B\u0439 \u043C\u0430\u043C\u043E\u0439, \u0433\u043B\u0438\u043D\u044F\u2026.\u0430\u044F \u0432\u0430\u0437\u0430",
          "\u041A\u043E\u0432\u0430\u2026.\u044B\u0439 \u0441\u0443\u043D\u0434\u0443\u043A, \u043A\u0430\u0440\u0442\u043E\u0448\u043A\u0430 \u043F\u043E\u0436\u0430\u0440\u0435\u2026.\u0430"
        ]
      },
      {
        id: "russian_7",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21167. \u041D\u0415 \u043F\u0438\u0448\u0435\u0442\u0441\u044F \u0440\u0430\u0437\u0434\u0435\u043B\u044C\u043D\u043E",
        options: [
          "(\u043D\u0435) \u043D\u0430\u0432\u0438\u0434\u044F\u0449\u0438\u0439 \u043B\u043E\u0436\u044C",
          "(\u043D\u0435) \u0441\u043C\u043E\u043B\u043A\u0430\u044E\u0449\u0438\u0435 \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440\u044B",
          "(\u043D\u0435) \u0437\u0430\u043A\u0440\u044B\u0432 \u0434\u0432\u0435\u0440\u044C",
          "(\u043D\u0435) \u0433\u0440\u0435\u044E\u0449\u0435\u0435 \u0441\u043E\u043B\u043D\u0446\u0435"
        ]
      },
      {
        id: "ru_8_new",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21168. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043D\u043E\u043C\u0435\u0440 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u043E \u0440\u0430\u0441\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u044B \u0437\u043D\u0430\u043A\u0438 \u043F\u0440\u0435\u043F\u0438\u043D\u0430\u043D\u0438\u044F:",
        options: [
          "1) \u0423\u0441\u044B\u043F\u0430\u043D\u043D\u043E\u0435 \u044F\u0440\u043A\u0438\u043C\u0438 \u0437\u0432\u0435\u0437\u0434\u0430\u043C\u0438 \u043D\u0435\u0431\u043E, \u043C\u0430\u043D\u0438\u043B\u043E \u043D\u0430\u0441 \u0441\u0432\u043E\u0435\u0439 \u0442\u0430\u0438\u043D\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u044C\u044E.",
          "2) \u041A\u043E\u043C\u043D\u0430\u0442\u0430, \u0441 \u0443\u0442\u0440\u0430 \u043F\u0440\u0438\u0431\u0440\u0430\u043D\u043D\u0430\u044F \u0441\u0435\u0441\u0442\u0440\u043E\u0439 \u0441\u0432\u0435\u0440\u043A\u0430\u043B\u0430 \u0447\u0438\u0441\u0442\u043E\u0442\u043E\u0439.",
          "3) \u041F\u043E\u0441\u0435\u0442\u0438\u0442\u0435\u043B\u044C \u043A\u0430\u0444\u0435, \u0437\u0435\u0432\u0430\u044F, \u0437\u0430\u043A\u0430\u0437\u0430\u043B \u043D\u0430 \u043E\u0431\u0435\u0434 \u0440\u044B\u0431\u0443 \u0436\u0430\u0440\u0435\u043D\u043D\u0443\u044E \u0432 \u0442\u0435\u0441\u0442\u0435.",
          "4) \u0423\u0431\u0440\u0430\u043D\u043D\u043E\u0435 \u0441 \u043B\u0443\u0433\u043E\u0432 \u0441\u0435\u043D\u043E, \u043A\u0440\u0435\u0441\u0442\u044C\u044F\u043D\u0435 \u0441\u043B\u043E\u0436\u0438\u043B\u0438 \u0432 \u0431\u043E\u043B\u044C\u0448\u0438\u0435 \u0441\u0442\u043E\u0433\u0430, \u0443\u043A\u0440\u044B\u0432 \u043E\u0442 \u0434\u043E\u0436\u0434\u044F."
        ]
      },
      {
        id: "ru_9",
        type: "clickable_text",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21169. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u043D\u0430 \u0446\u0438\u0444\u0440\u044B, \u043D\u0430 \u043C\u0435\u0441\u0442\u0435 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0434\u043E\u043B\u0436\u043D\u044B \u0441\u0442\u043E\u044F\u0442\u044C \u0437\u0430\u043F\u044F\u0442\u044B\u0435:",
        clickableSegments: [
          { "text": "\u0424\u043E\u043D\u0430\u0440\u044C" },
          { "text": " [,] ", "id": "1", "isTarget": true },
          { "text": "\u043E\u0434\u0438\u043D\u043E\u043A\u043E" },
          { "text": " [,] ", "id": "2", "isTarget": true },
          { "text": "\u0441\u0442\u043E\u044F\u0432\u0448\u0438\u0439" },
          { "text": " [,] ", "id": "3", "isTarget": true },
          { "text": "\u043D\u0430" },
          { "text": " [,] ", "id": "4", "isTarget": true },
          { "text": "\u0437\u0435\u043C\u043B\u0435" },
          { "text": " [,] ", "id": "5", "isTarget": true },
          { "text": "\u043E\u0441\u0432\u0435\u0442\u0438\u043B" },
          { "text": " [,] ", "id": "6", "isTarget": true },
          { "text": "\u0438\u0437\u0434\u0430\u044E\u0449\u0435\u0435" },
          { "text": " [,] ", "id": "7", "isTarget": true },
          { "text": "\u043D\u0435\u043F\u043E\u043D\u044F\u0442\u043D\u044B\u0435" },
          { "text": " [,] ", "id": "8", "isTarget": true },
          { "text": "\u0437\u0432\u0443\u043A\u0438" },
          { "text": " [,] ", "id": "9", "isTarget": true },
          { "text": "\u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0435." }
        ]
      },
      {
        id: "ru_10",
        type: "clickable_text",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211610. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0432\u0441\u0435 \u0446\u0438\u0444\u0440\u044B, \u043D\u0430 \u043C\u0435\u0441\u0442\u0435 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0441\u0442\u0430\u0432\u044F\u0442\u0441\u044F \u0437\u0430\u043F\u044F\u0442\u044B\u0435:",
        clickableSegments: [
          { "text": "\u041F\u0440\u043E\u0445\u043E\u0434\u044F" },
          { "text": " [,] ", "id": "1", "isTarget": true },
          { "text": "\u043F\u043E" },
          { "text": " [,] ", "id": "2", "isTarget": true },
          { "text": "\u0437\u0430\u043B\u0430\u043C" },
          { "text": " [,] ", "id": "3", "isTarget": true },
          { "text": "\u043C\u0443\u0437\u0435\u0435\u0432" },
          { "text": " [,] ", "id": "4", "isTarget": true },
          { "text": "\u043B\u044E\u0434\u0438" },
          { "text": " [,] ", "id": "5", "isTarget": true },
          { "text": "\u043E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u044E\u0442\u0441\u044F" },
          { "text": " [,] ", "id": "6", "isTarget": true },
          { "text": "\u0443" },
          { "text": " [,] ", "id": "7", "isTarget": true },
          { "text": "\u043F\u0440\u0435\u043A\u0440\u0430\u0441\u043D\u044B\u0445" },
          { "text": " [,] ", "id": "8", "isTarget": true },
          { "text": "\u043A\u0430\u0440\u0442\u0438\u043D" },
          { "text": " [,] ", "id": "9", "isTarget": true },
          { "text": "\u0445\u0443\u0434\u043E\u0436\u043D\u0438\u043A\u0430" },
          { "text": " [,] ", "id": "10", "isTarget": true },
          { "text": "\u0418." },
          { "text": " [,] ", "id": "11", "isTarget": true },
          { "text": "\u0420\u0435\u043F\u0438\u043D\u0430" },
          { "text": " [,] ", "id": "12", "isTarget": true },
          { "text": "\u0432\u043E\u0441\u0445\u0438\u0449\u0430\u044F\u0441\u044C" },
          { "text": " [,] ", "id": "13", "isTarget": true },
          { "text": "\u0441\u043E\u0432\u0435\u0440\u0448\u0435\u043D\u0441\u0442\u0432\u043E\u043C" },
          { "text": " [,] ", "id": "14", "isTarget": true },
          { "text": "\u0436\u0438\u0432\u043E\u043F\u0438\u0441\u0438." }
        ]
      },
      {
        id: "russian_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211610. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u043E\u0442\u0432\u0435\u0442\u0430...\n\u041F\u0440\u043E\u0445\u043E\u0434\u044F (1) \u043F\u043E \u0437\u0430\u043B\u0430\u043C \u043C\u0443\u0437\u0435\u0435\u0432 (2) \u043B\u044E\u0434\u0438 (3) \u043E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u0443 \u043F\u0440\u0435\u043A\u0440\u0430\u0441\u043D\u044B\u0445 \u043A\u0430\u0440\u0442\u0438\u043D \u0445\u0443\u0434\u043E\u0436\u043D\u0438\u043A\u0430 \u0418.\u0420\u0435\u043F\u0438\u043D\u0430 (4) \u0432\u043E\u0441\u0445\u0438\u0449\u0430\u044F\u0441\u044C (5) \u0441\u043E\u0432\u0435\u0440\u0448\u0435\u043D\u0441\u0442\u0432\u043E\u043C \u0436\u0438\u0432\u043E\u043F\u0438\u0441\u0438.",
        options: ["1, 2", "1, 4", "2, 4", "2, 3, 4, 5"]
      }
    ],
    math: [
      {
        id: "ma_1_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21161. \u0423\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u0435: 12x - 5(1 - x) + 7",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21161. \u0423\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u0435: 12x - 5(1 - x) + 7",
        options: ["17x - 12", "17x + 2", "7(x - 1)", "17x + 12", "7x + 2"]
      },
      {
        id: "ma_2_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21162. \u0417\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u0432 \u0432\u0438\u0434\u0435 \u043C\u043D\u043E\u0433\u043E\u0447\u043B\u0435\u043D\u0430: (4n^2 - 1)(n^2 + 5)",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21162. \u0417\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u0432 \u0432\u0438\u0434\u0435 \u043C\u043D\u043E\u0433\u043E\u0447\u043B\u0435\u043D\u0430: (4n<sup>2</sup> - 1)(n<sup>2</sup> + 5)",
        options: ["-4n^2 + 5 - 20n^4", "20n^4 + 4n^2 - 5", "4n^4 + 19n^2 - 5", "n^4 + n^2 + 5", "2n + 20n^2 - 5"]
      },
      {
        id: "ma_3_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u0412 \u0442\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0435 MKE \u0443\u0433\u043E\u043B K \u0440\u0430\u0432\u0435\u043D 42\xB0, \u0443\u0433\u043E\u043B M \u043D\u0430 57\xB0 \u0431\u043E\u043B\u044C\u0448\u0435. \u0412\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u0435 \u0433\u0440\u0430\u0434\u0443\u0441\u043D\u0443\u044E \u043C\u0435\u0440\u0443 \u0443\u0433\u043B\u0430 E.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u0412 \u0442\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0435 MKE \u0443\u0433\u043E\u043B K \u0440\u0430\u0432\u0435\u043D 42&deg;, \u0443\u0433\u043E\u043B M \u043D\u0430 57&deg; \u0431\u043E\u043B\u044C\u0448\u0435. \u0412\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u0435 \u0433\u0440\u0430\u0434\u0443\u0441\u043D\u0443\u044E \u043C\u0435\u0440\u0443 \u0443\u0433\u043B\u0430 E.",
        options: ["101\xB0", "82\xB0", "39\xB0", "27\xB0", "49\xB0"]
      },
      {
        id: "ma_4_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21164. \u041E\u0434\u0438\u043D \u0438\u0437 \u0441\u043C\u0435\u0436\u043D\u044B\u0445 \u0443\u0433\u043B\u043E\u0432 \u043D\u0430 54\xB0 \u0431\u043E\u043B\u044C\u0448\u0435 \u0434\u0440\u0443\u0433\u043E\u0433\u043E. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0431\u043E\u043B\u044C\u0448\u0438\u0439 \u0443\u0433\u043E\u043B.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21164. \u041E\u0434\u0438\u043D \u0438\u0437 \u0441\u043C\u0435\u0436\u043D\u044B\u0445 \u0443\u0433\u043B\u043E\u0432 \u043D\u0430 54&deg; \u0431\u043E\u043B\u044C\u0448\u0435 \u0434\u0440\u0443\u0433\u043E\u0433\u043E. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0431\u043E\u043B\u044C\u0448\u0438\u0439 \u0443\u0433\u043E\u043B.",
        options: ["117\xB0", "108\xB0", "84\xB0", "78\xB0", "107\xB0"]
      },
      {
        id: "ma_5_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21165. \u0420\u0430\u0437\u043B\u043E\u0436\u0438\u0442\u0435 \u043D\u0430 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u0438: 64a^6 - c^12",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21165. \u0420\u0430\u0437\u043B\u043E\u0436\u0438\u0442\u0435 \u043D\u0430 \u043C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u0438: 64a<sup>6</sup> - c<sup>12</sup>",
        options: ["(8a^3 + c^6)(8a^3 - c^6)", "(2a + c^2)(2a - c^2)(4a^2 - 2ac^2 + c^4)", "(2a + c^2)(2a - c^2)(4a^2 + 2ac^2 + c^4)", "(4a^2 + c^4)(4a^2 - c^4)", "(2a + c^2)(2a - c^2)(4a^2 - 2ac^2 + c^4)(4a^2 + 2ac^2 + c^4)"]
      },
      {
        id: "ma_6_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21166. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043A\u043E\u0440\u043D\u0438 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F: 7 + 2x^2 = 2(x + 1)(x + 3)",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21166. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043A\u043E\u0440\u043D\u0438 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F: 7 + 2x<sup>2</sup> = 2(x + 1)(x + 3)",
        options: ["1/8", "1/6", "1/9", "2/5", "1/7"]
      },
      {
        id: "ma_7_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21167. 5 \u043A\u043E\u043D\u0434\u0438\u0442\u0435\u0440\u043E\u0432 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0442 \u0437\u0430\u043A\u0430\u0437 \u0437\u0430 12 \u0447\u0430\u0441\u043E\u0432. \u0417\u0430 \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0447\u0430\u0441\u043E\u0432 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0442 \u044D\u0442\u043E\u0442 \u0437\u0430\u043A\u0430\u0437 6 \u043A\u043E\u043D\u0434\u0438\u0442\u0435\u0440\u043E\u0432?",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21167. 5 \u043A\u043E\u043D\u0434\u0438\u0442\u0435\u0440\u043E\u0432 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0442 \u0437\u0430\u043A\u0430\u0437 \u0437\u0430 12 \u0447\u0430\u0441\u043E\u0432. \u0417\u0430 \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0447\u0430\u0441\u043E\u0432 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0442 \u044D\u0442\u043E\u0442 \u0437\u0430\u043A\u0430\u0437 6 \u043A\u043E\u043D\u0434\u0438\u0442\u0435\u0440\u043E\u0432?",
        options: ["14 \u0447", "10 \u0447", "12 \u0447", "13 \u0447", "11 \u0447"]
      },
      {
        id: "ma_8_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21168. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0447\u0438\u0441\u043B\u043E, \u0438\u043C\u0435\u044E\u0449\u0435\u0435 \u043D\u0430\u0438\u043C\u0435\u043D\u044C\u0448\u0438\u0439 \u043C\u043E\u0434\u0443\u043B\u044C.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21168. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0447\u0438\u0441\u043B\u043E, \u0438\u043C\u0435\u044E\u0449\u0435\u0435 \u043D\u0430\u0438\u043C\u0435\u043D\u044C\u0448\u0438\u0439 \u043C\u043E\u0434\u0443\u043B\u044C.",
        options: ["4,7", "-135", "0", "-0,28", "14,3"]
      },
      {
        id: "ma_9_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21169. \u0422\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A, \u0441 \u043A\u0430\u043A\u0438\u043C\u0438 \u0441\u0442\u043E\u0440\u043E\u043D\u0430\u043C\u0438 \u043C\u043E\u0436\u043D\u043E \u0438\u0437\u043E\u0431\u0440\u0430\u0437\u0438\u0442\u044C?",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21169. \u0422\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A, \u0441 \u043A\u0430\u043A\u0438\u043C\u0438 \u0441\u0442\u043E\u0440\u043E\u043D\u0430\u043C\u0438 \u043C\u043E\u0436\u043D\u043E \u0438\u0437\u043E\u0431\u0440\u0430\u0437\u0438\u0442\u044C?",
        options: ["2; 2; 4", "8; 11; 2", "11; 6; 6", "18; 9; 8", "3; 2; 6"]
      },
      {
        id: "ma_10_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211610. \u0423\u0433\u043B\u044B \u0442\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0430 ABC \u043E\u0442\u043D\u043E\u0441\u044F\u0442\u0441\u044F \u043A\u0430\u043A 5:3:1. \u0412\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u0435 \u0441\u0430\u043C\u044B\u0439 \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0443\u0433\u043E\u043B \u044D\u0442\u043E\u0433\u043E \u0442\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0430.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211610. \u0423\u0433\u043B\u044B \u0442\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0430 ABC \u043E\u0442\u043D\u043E\u0441\u044F\u0442\u0441\u044F \u043A\u0430\u043A 5:3:1. \u0412\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u0435 \u0441\u0430\u043C\u044B\u0439 \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0443\u0433\u043E\u043B \u044D\u0442\u043E\u0433\u043E \u0442\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0430.",
        options: ["140\xB0", "130\xB0", "100\xB0", "80\xB0", "90\xB0"]
      },
      {
        id: "ma_11_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211611. \u0420\u0435\u0448\u0438\u0442\u0435 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435: |x - 7| = 2",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211611. \u0420\u0435\u0448\u0438\u0442\u0435 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435: |x - 7| = 2",
        options: ["5; 9", "9; 6", "10; 1", "-5; 6", "6 1/7; 8"]
      },
      {
        id: "ma_12_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211612. \u0420\u0435\u0448\u0438\u0442\u0435 \u043D\u0435\u0440\u0430\u0432\u0435\u043D\u0441\u0442\u0432\u043E: 4y + 4 < y - 5",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211612. \u0420\u0435\u0448\u0438\u0442\u0435 \u043D\u0435\u0440\u0430\u0432\u0435\u043D\u0441\u0442\u0432\u043E: 4y + 4 &lt; y - 5",
        options: ["(-\u221E; -3)", "(-\u221E; 3)", "(-\u221E; -9)", "(3; +\u221E)", "(-3; +\u221E)"]
      },
      {
        id: "ma_13_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211613. \u0421\u0443\u043C\u043C\u0430 \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0445 \u0443\u0433\u043B\u043E\u0432 \u0440\u0430\u0432\u043D\u0430 136\xB0. \u0412\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u0435 \u043E\u0434\u0438\u043D \u0438\u0437 \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0445 \u0443\u0433\u043B\u043E\u0432.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211613. \u0421\u0443\u043C\u043C\u0430 \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0445 \u0443\u0433\u043B\u043E\u0432 \u0440\u0430\u0432\u043D\u0430 136&deg;. \u0412\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u0435 \u043E\u0434\u0438\u043D \u0438\u0437 \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0445 \u0443\u0433\u043B\u043E\u0432.",
        options: ["56\xB0", "102\xB0", "284\xB0", "68\xB0", "86\xB0"]
      },
      {
        id: "ma_14_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211614. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0435\u0440\u043D\u043E\u0435 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435. \u0415\u0441\u043B\u0438 \u0434\u0432\u0435 \u043F\u0430\u0440\u0430\u043B\u043B\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u0440\u044F\u043C\u044B\u0435 \u043F\u0435\u0440\u0435\u0441\u0435\u0447\u0435\u043D\u044B \u0441\u0435\u043A\u0443\u0449\u0435\u0439, \u0442\u043E",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211614. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0435\u0440\u043D\u043E\u0435 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435. \u0415\u0441\u043B\u0438 \u0434\u0432\u0435 \u043F\u0430\u0440\u0430\u043B\u043B\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u0440\u044F\u043C\u044B\u0435 \u043F\u0435\u0440\u0435\u0441\u0435\u0447\u0435\u043D\u044B \u0441\u0435\u043A\u0443\u0449\u0435\u0439, \u0442\u043E",
        options: ["\u043D\u0430\u043A\u0440\u0435\u0441\u0442 \u043B\u0435\u0436\u0430\u0449\u0438\u0435 \u0443\u0433\u043B\u044B \u0432 \u0441\u0443\u043C\u043C\u0435 \u0434\u0430\u044E\u0442 180\xB0", "\u0441\u043C\u0435\u0436\u043D\u044B\u0435 \u0443\u0433\u043B\u044B \u0440\u0430\u0432\u043D\u044B", "\u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0435 \u0443\u0433\u043B\u044B \u0440\u0430\u0432\u043D\u044B", "\u043E\u0434\u043D\u043E\u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0435 \u0443\u0433\u043B\u044B \u0440\u0430\u0432\u043D\u044B", "\u0441\u0443\u043C\u043C\u0430 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0443\u0433\u043B\u043E\u0432 \u0440\u0430\u0432\u043D\u0430 180\xB0"]
      },
      {
        id: "ma_15_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211615. \u041F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0432 \u0432\u0438\u0434\u0435 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F: x(a - b) + y(b - a)",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211615. \u041F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0432 \u0432\u0438\u0434\u0435 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F: x(a - b) + y(b - a)",
        options: ["(a - b)(x - y)", "(b - a)(x - y)", "-(x + y)(a + b)", "(x + y)(b - a)", "(a - b)(x + y)"]
      },
      {
        id: "ma_16_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211616. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0441\u0443\u043C\u043C\u0443 \u0443\u0433\u043B\u043E\u0432 1 + 2 + 3, \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u043D\u044B\u0445 \u043D\u0430 \u0440\u0438\u0441\u0443\u043D\u043A\u0435.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211616. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0441\u0443\u043C\u043C\u0443 \u0443\u0433\u043B\u043E\u0432 1 + 2 + 3, \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u043D\u044B\u0445 \u043D\u0430 \u0440\u0438\u0441\u0443\u043D\u043A\u0435.<br><br><img src='/math8_16.png' alt='\u0423\u0433\u043B\u044B \u043D\u0430 \u0440\u0438\u0441\u0443\u043D\u043A\u0435' style='max-width:300px;display:block;margin:10px 0;' />",
        options: ["90\xB0", "150\xB0", "180\xB0", "360\xB0", "200\xB0"]
      },
      {
        id: "ma_17_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211617. \u0412 \u043F\u0440\u044F\u043C\u043E\u0443\u0433\u043E\u043B\u044C\u043D\u043E\u043C \u0442\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0435 ABC \u0443\u0433\u043E\u043B B \u0440\u0430\u0432\u0435\u043D 90\xB0, \u0443\u0433\u043E\u043B C \u0440\u0430\u0432\u0435\u043D 45\xB0. \u0421\u0440\u0430\u0432\u043D\u0438\u0442\u0435 \u0441\u0442\u043E\u0440\u043E\u043D\u044B \u0442\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0430.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211617. \u0412 \u043F\u0440\u044F\u043C\u043E\u0443\u0433\u043E\u043B\u044C\u043D\u043E\u043C \u0442\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0435 ABC \u0443\u0433\u043E\u043B B \u0440\u0430\u0432\u0435\u043D 90&deg;, \u0443\u0433\u043E\u043B C \u0440\u0430\u0432\u0435\u043D 45&deg;. \u0421\u0440\u0430\u0432\u043D\u0438\u0442\u0435 \u0441\u0442\u043E\u0440\u043E\u043D\u044B \u0442\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0430.",
        options: ["AB < AC < BC", "AB > AC > BC", "AB = BC < AC", "CA = AB = BC", "AB > BC = AC"]
      },
      {
        id: "ma_18_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211618. \u0410\u0439\u043C\u0430\u043D \u043A\u0443\u043F\u0438\u043B\u0430 \u0434\u043B\u044F \u0431\u0440\u0430\u0442\u0438\u043A\u0430 \u0443\u043F\u0430\u043A\u043E\u0432\u043A\u0443 \u0432\u043E\u0437\u0434\u0443\u0448\u043D\u044B\u0445 \u0448\u0430\u0440\u0438\u043A\u043E\u0432. \u041E\u043A\u0430\u0437\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E \u0438\u0437 20 \u0448\u0430\u0440\u0438\u043A\u043E\u0432 12 \u043A\u0440\u0430\u0441\u043D\u044B\u0435, \u0430 \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 - \u0437\u0435\u043B\u0435\u043D\u044B\u0435. \u041A\u0430\u043A\u043E\u0432\u0430 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C \u0442\u043E\u0433\u043E, \u0447\u0442\u043E \u0431\u0440\u0430\u0442 \u043D\u0430\u0443\u0433\u0430\u0434 \u0434\u043E\u0441\u0442\u0430\u043D\u0435\u0442 \u0438\u0437 \u0443\u043F\u0430\u043A\u043E\u0432\u043A\u0438 \u0437\u0435\u043B\u0435\u043D\u044B\u0439 \u0448\u0430\u0440\u0438\u043A?",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211618. \u0410\u0439\u043C\u0430\u043D \u043A\u0443\u043F\u0438\u043B\u0430 \u0434\u043B\u044F \u0431\u0440\u0430\u0442\u0438\u043A\u0430 \u0443\u043F\u0430\u043A\u043E\u0432\u043A\u0443 \u0432\u043E\u0437\u0434\u0443\u0448\u043D\u044B\u0445 \u0448\u0430\u0440\u0438\u043A\u043E\u0432. \u041E\u043A\u0430\u0437\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E \u0438\u0437 20 \u0448\u0430\u0440\u0438\u043A\u043E\u0432 12 \u043A\u0440\u0430\u0441\u043D\u044B\u0435, \u0430 \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 - \u0437\u0435\u043B\u0435\u043D\u044B\u0435. \u041A\u0430\u043A\u043E\u0432\u0430 \u0432\u0435\u0440\u043E\u044F\u0442\u043D\u043E\u0441\u0442\u044C \u0442\u043E\u0433\u043E, \u0447\u0442\u043E \u0431\u0440\u0430\u0442 \u043D\u0430\u0443\u0433\u0430\u0434 \u0434\u043E\u0441\u0442\u0430\u043D\u0435\u0442 \u0438\u0437 \u0443\u043F\u0430\u043A\u043E\u0432\u043A\u0438 \u0437\u0435\u043B\u0435\u043D\u044B\u0439 \u0448\u0430\u0440\u0438\u043A?",
        options: ["3/5", "1/20", "1/12", "2/5", "1/8"]
      },
      {
        id: "ma_19_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211619. \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F: (2a^2 b)^3",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211619. \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F: (2a<sup>2</sup> b)<sup>3</sup>",
        options: ["2a^6 b^3", "8a^6 b^3", "2 b", "8 b^3", "16a^4 b^3"]
      },
      {
        id: "ma_20_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211620. \u041F\u0440\u0438 \u043A\u0430\u043A\u0438\u0445 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F\u0445 m \u0433\u0440\u0430\u0444\u0438\u043A\u0438 \u0444\u0443\u043D\u043A\u0446\u0438\u0439 y = mx + 12 \u0438 y = -4x + 3 \u043F\u0430\u0440\u0430\u043B\u043B\u0435\u043B\u044C\u043D\u044B?",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211620. \u041F\u0440\u0438 \u043A\u0430\u043A\u0438\u0445 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F\u0445 m \u0433\u0440\u0430\u0444\u0438\u043A\u0438 \u0444\u0443\u043D\u043A\u0446\u0438\u0439 y = mx + 12 \u0438 y = -4x + 3 \u043F\u0430\u0440\u0430\u043B\u043B\u0435\u043B\u044C\u043D\u044B?",
        options: ["-4", "4", "3", "-3", "12"]
      },
      {
        id: "ma_21_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211621. \u0420\u0435\u0448\u0438\u0442\u0435 \u0441\u0438\u0441\u0442\u0435\u043C\u0443 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0439: -2x + 5y = 12 \u0438 3x - y = 8",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211621. \u0420\u0435\u0448\u0438\u0442\u0435 \u0441\u0438\u0441\u0442\u0435\u043C\u0443 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0439:<br><div style='display:inline-block;border-left:1px solid;padding-left:5px;'>-2x + 5y = 12<br>3x - y = 8</div>",
        options: ["(4; -4)", "(2; 2)", "(4; 4)", "(-4; 4)", "(1; 3)"]
      },
      {
        id: "ma_22_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211622. \u0421\u0430\u043C\u0438\u0440 \u043F\u043E\u043B\u043E\u0436\u0438\u043B \u0432 \u0431\u0430\u043D\u043A 12000 \u0441\u043E\u043C \u043F\u043E\u0434 10% \u0433\u043E\u0434\u043E\u0432\u044B\u0445. \u041A\u0430\u043A\u0430\u044F \u043E\u0431\u0449\u0430\u044F \u0441\u0443\u043C\u043C\u0430 \u0434\u0435\u043D\u0435\u0433 \u0431\u0443\u0434\u0435\u0442 \u043D\u0430 \u0435\u0433\u043E \u0441\u0447\u0435\u0442\u0443 \u0447\u0435\u0440\u0435\u0437 3 \u0433\u043E\u0434\u0430?",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211622. \u0421\u0430\u043C\u0438\u0440 \u043F\u043E\u043B\u043E\u0436\u0438\u043B \u0432 \u0431\u0430\u043D\u043A 12000 \u0441\u043E\u043C \u043F\u043E\u0434 10% \u0433\u043E\u0434\u043E\u0432\u044B\u0445. \u041A\u0430\u043A\u0430\u044F \u043E\u0431\u0449\u0430\u044F \u0441\u0443\u043C\u043C\u0430 \u0434\u0435\u043D\u0435\u0433 \u0431\u0443\u0434\u0435\u0442 \u043D\u0430 \u0435\u0433\u043E \u0441\u0447\u0435\u0442\u0443 \u0447\u0435\u0440\u0435\u0437 3 \u0433\u043E\u0434\u0430?",
        options: ["120360", "123600", "156000", "120120", "123060"]
      }
    ],
    logic: commonLogicQuestions
  },
  "9": {
    grade: 9,
    english: english_grade_9,
    russian: [
      {
        id: "russian_1",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21161. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0441\u043B\u043E\u0432\u043E\u0441\u043E\u0447\u0435\u0442\u0430\u043D\u0438\u0435 \u0441\u043E \u0441\u0432\u044F\u0437\u044C\u044E \u043F\u0440\u0438\u043C\u044B\u043A\u0430\u043D\u0438\u0435:",
        options: [
          "\u0414\u0435\u0440\u0435\u0432\u044F\u043D\u043D\u044B\u0439 \u0441\u0442\u043E\u043B",
          "\u0411\u044B\u0441\u0442\u0440\u043E \u0431\u0435\u0436\u0430\u0442\u044C",
          "\u0427\u0438\u0442\u0430\u0442\u044C \u043A\u043D\u0438\u0433\u0443",
          "\u0412\u0441\u0442\u0440\u0435\u0447\u0430 \u0441 \u0434\u0440\u0443\u0433\u043E\u043C"
        ]
      },
      {
        id: "russian_2",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21162. \u041E\u0431\u044A\u044F\u0441\u043D\u0438 \u043F\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u0441\u043A\u043E\u0431\u043E\u043A \u0432 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0438: \xAB\u0412 \u0436\u0430\u0440\u043A\u043E\u0435 \u043B\u0435\u0442\u043D\u0435\u0435 \u0443\u0442\u0440\u043E (\u044D\u0442\u043E \u0431\u044B\u043B\u043E \u0432 \u0438\u0441\u0445\u043E\u0434\u0435 \u0438\u044E\u043B\u044F) \u0440\u0430\u0437\u0431\u0443\u0434\u0438\u043B\u0438 \u043D\u0430\u0441 \u0440\u0430\u043D\u0435\u0435 \u043E\u0431\u044B\u043A\u043D\u043E\u0432\u0435\u043D\u043D\u043E\u0433\u043E.\xBB",
        options: [
          "\u041F\u0440\u0438\u0447\u0430\u0441\u0442\u043D\u044B\u0439 \u043E\u0431\u043E\u0440\u043E\u0442",
          "\u0412\u0441\u0442\u0430\u0432\u043D\u0430\u044F \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F",
          "\u0412\u0432\u043E\u0434\u043D\u0430\u044F \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F"
        ]
      },
      {
        id: "russian_3",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043D\u043E-\u043B\u0438\u0447\u043D\u043E\u0441\u0442\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435:",
        options: [
          "\u041C\u043D\u0435 \u043D\u0435 \u0441\u043F\u0438\u0442\u0441\u044F.",
          "\u0418\u0434\u0443 \u043F\u043E \u043B\u0435\u0441\u043D\u043E\u0439 \u0442\u0440\u043E\u043F\u0438\u043D\u043A\u0435.",
          "\u0412 \u0434\u0432\u0435\u0440\u044C \u0441\u0442\u0443\u0447\u0430\u0442."
        ]
      },
      {
        id: "russian_4",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21164. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u043E\u0434\u043B\u0435\u0436\u0430\u0449\u0435\u0435 \u0432 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0438: \xAB\u0422\u0440\u0438 \u0443\u0447\u0435\u043D\u0438\u043A\u0430 \u043E\u043F\u043E\u0437\u0434\u0430\u043B\u0438 \u043D\u0430 \u0443\u0440\u043E\u043A\xBB.",
        options: ["\u0442\u0440\u0438", "\u0443\u0440\u043E\u043A", "\u0442\u0440\u0438 \u0443\u0447\u0435\u043D\u0438\u043A\u0430"]
      },
      {
        id: "ru_5_new",
        type: "inline_inputs",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21165. \u0412\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043D\u044B\u0435 \u0431\u0443\u043A\u0432\u044B (\u043D \u0438\u043B\u0438 \u043D\u043D):",
        inlineSegments: [
          { type: "text", text: "\u043D\u0435\u0441\u043B\u044B\u0445\u0430" },
          { type: "input", id: "input1" },
          { type: "text", text: "\u0430\u044F \u0434\u0435\u0440\u0437\u043E\u0441\u0442\u044C\n\u0437\u0430\u0434\u0430\u0447\u0430 \u0440\u0435\u0448\u0435" },
          { type: "input", id: "input2" },
          { type: "text", text: "\u0430." }
        ]
      },
      {
        id: "russian_6",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21166. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0441 \u043F\u0440\u0438\u0447\u0430\u0441\u0442\u043D\u044B\u043C \u043E\u0431\u043E\u0440\u043E\u0442\u043E\u043C, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u043D\u0435 \u043E\u0431\u043E\u0441\u043E\u0431\u043B\u044F\u0435\u0442\u0441\u044F:",
        options: [
          "\u0423\u0442\u043E\u043C\u043B\u0435\u043D\u043D\u044B\u0435 \u0434\u043E\u043B\u0433\u0438\u043C \u043F\u0443\u0442\u0435\u043C \u0442\u0443\u0440\u0438\u0441\u0442\u044B \u043E\u0442\u0434\u044B\u0445\u0430\u043B\u0438.",
          "\u0422\u0443\u0440\u0438\u0441\u0442\u044B \u0443\u0442\u043E\u043C\u043B\u0435\u043D\u043D\u044B\u0435 \u0434\u043E\u043B\u0433\u0438\u043C \u043F\u0443\u0442\u0435\u043C \u043E\u0442\u0434\u044B\u0445\u0430\u043B\u0438"
        ]
      },
      {
        id: "ru_7_new",
        type: "clickable_text",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21167. \u0420\u0430\u0441\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0437\u043D\u0430\u043A\u0438 \u043F\u0440\u0435\u043F\u0438\u043D\u0430\u043D\u0438\u044F \u0432 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0438 (\u043A\u043B\u0438\u043A\u043D\u0438\u0442\u0435 \u0432 \u043C\u0435\u0441\u0442\u0430, \u0433\u0434\u0435 \u043D\u0443\u0436\u043D\u044B \u0437\u0430\u043F\u044F\u0442\u044B\u0435):",
        clickableSegments: [
          { "text": "\u0412\u0435\u0442\u0435\u0440" },
          { "text": " [,] ", "id": "1", "isTarget": true },
          { "text": "\u0434\u0443\u044E\u0449\u0438\u0439" },
          { "text": " [,] ", "id": "2", "isTarget": true },
          { "text": "\u0441" },
          { "text": " [,] ", "id": "3", "isTarget": true },
          { "text": "\u043C\u043E\u0440\u044F" },
          { "text": " [,] ", "id": "4", "isTarget": true },
          { "text": "\u043F\u0440\u0438\u043D\u0435\u0441" },
          { "text": " [,] ", "id": "5", "isTarget": true },
          { "text": "\u043F\u0440\u043E\u0445\u043B\u0430\u0434\u0443." }
        ]
      },
      {
        id: "russian_8",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21168. \u041D\u0415 \u043F\u0438\u0448\u0435\u0442\u0441\u044F \u0440\u0430\u0437\u0434\u0435\u043B\u044C\u043D\u043E:",
        options: [
          "(\u043D\u0435) \u043D\u0430\u0432\u0438\u0434\u044F\u0449\u0438\u0439 \u043B\u043E\u0436\u044C",
          "(\u043D\u0435) \u0441\u043C\u043E\u043B\u043A\u0430\u044E\u0449\u0438\u0435 \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440\u044B",
          "(\u043D\u0435) \u0437\u0430\u043A\u0440\u044B\u0432 \u0434\u0432\u0435\u0440\u044C",
          "(\u043D\u0435) \u0433\u0440\u0435\u044E\u0449\u0435\u0435 \u0441\u043E\u043B\u043D\u0446\u0435"
        ]
      },
      {
        id: "russian_9",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21169. \u041D\u0415 \u043F\u0438\u0448\u0435\u0442\u0441\u044F \u0441\u043B\u0438\u0442\u043D\u043E:",
        options: [
          "\u0412\u043E\u0432\u0441\u0435 (\u043D\u0435) \u043E\u0441\u0432\u0435\u0449\u0435\u043D\u043D\u043E\u0435 \u043E\u043A\u043D\u043E",
          "(\u043D\u0435) \u043D\u0430\u0432\u0438\u0434\u0435\u0432\u0448\u0438\u0439",
          "(\u043D\u0435) \u0437\u0430\u043A\u043E\u043D\u0447\u0438\u0432",
          "(\u043D\u0435) \u043F\u043E\u043A\u0440\u044B\u0442\u0430\u044F \u0441\u043D\u0435\u0433\u043E\u043C"
        ]
      },
      {
        id: "russian_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211610. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0441 \u0434\u0435\u0435\u043F\u0440\u0438\u0447\u0430\u0441\u0442\u043D\u044B\u043C \u043E\u0431\u043E\u0440\u043E\u0442\u043E\u043C (\u0437\u043D\u0430\u043A\u0438 \u043D\u0435 \u0440\u0430\u0441\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u044B):",
        options: [
          "\u041E\u043D \u0441\u0438\u0434\u0435\u043B \u043C\u043E\u043B\u0447\u0430.",
          "\u0417\u0430\u043A\u043E\u043D\u0447\u0438\u0432 \u0440\u0430\u0431\u043E\u0442\u0443 \u044F \u043F\u043E\u0448\u0435\u043B \u0433\u0443\u043B\u044F\u0442\u044C.",
          "\u041F\u0440\u0438\u043B\u0435\u0442\u0435\u0432\u0448\u0430\u044F \u043F\u0442\u0438\u0446\u0430 \u0441\u0435\u043B\u0430 \u043D\u0430 \u0432\u0435\u0442\u043A\u0443."
        ]
      },
      {
        id: "russian_11",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211611. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0441 \u0432\u0432\u043E\u0434\u043D\u044B\u043C \u0441\u043B\u043E\u0432\u043E\u043C (\u0437\u043D\u0430\u043A\u0438 \u043D\u0435 \u0440\u0430\u0441\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u044B):",
        options: [
          "\u041A\u0430\u0436\u0435\u0442\u0441\u044F \u0434\u043E\u0436\u0434\u044C \u043D\u0430\u0447\u0438\u043D\u0430\u0435\u0442\u0441\u044F.",
          "\u041E\u043D \u043A\u0430\u0436\u0435\u0442\u0441\u044F \u043C\u043D\u0435 \u0437\u043D\u0430\u043A\u043E\u043C\u044B\u043C.",
          "\u041E\u043D \u043A\u0430\u0436\u0435\u0442\u0441\u044F \u0443\u0441\u0442\u0430\u043B\u044B\u043C."
        ]
      },
      {
        id: "russian_12",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211612. \u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u0435 \u0432\u0438\u0434 \u0441\u043A\u0430\u0437\u0443\u0435\u043C\u043E\u0433\u043E: \xAB\u041E\u043D \u0445\u043E\u0442\u0435\u043B \u043D\u0430\u0443\u0447\u0438\u0442\u0441\u044F \u0442\u0430\u043D\u0446\u0435\u0432\u0430\u0442\u044C\xBB.",
        options: [
          "\u041F\u0440\u043E\u0441\u0442\u043E\u0435 \u0433\u043B\u0430\u0433\u043E\u043B\u044C\u043D\u043E\u0435.",
          "\u0421\u043E\u0441\u0442\u0430\u0432\u043D\u043E\u0435 \u0438\u043C\u0435\u043D\u043D\u043E\u0435.",
          "\u0421\u043E\u0441\u0442\u0430\u0432\u043D\u043E\u0435 \u0433\u043B\u0430\u0433\u043E\u043B\u044C\u043D\u043E\u0435."
        ]
      },
      {
        id: "ru_13_new",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211613. \u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u0435 \u0442\u0438\u043F \u043F\u0435\u0440\u0432\u043E\u0439 \u0447\u0430\u0441\u0442\u0438 \u0441\u043B\u043E\u0436\u043D\u043E\u0433\u043E \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F (\xAB\u041D\u0430 \u0443\u043B\u0438\u0446\u0435 \u043F\u043E\u0445\u043E\u043B\u043E\u0434\u0430\u043B\u043E...\xBB):\n\u041D\u0430 \u0443\u043B\u0438\u0446\u0435 \u043F\u043E\u0445\u043E\u043B\u043E\u0434\u0430\u043B\u043E, \u0438 \u043C\u044B \u0432\u0435\u0440\u043D\u0443\u043B\u0438\u0441\u044C \u0434\u043E\u043C\u043E\u0439.",
        options: ["\u0411\u0435\u0437\u043B\u0438\u0447\u043D\u043E\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435", "\u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u043E-\u043B\u0438\u0447\u043D\u043E\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435", "\u041D\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u043E-\u043B\u0438\u0447\u043D\u043E\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435", "\u0414\u0432\u0443\u0441\u043E\u0441\u0442\u0430\u0432\u043D\u043E\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435"]
      },
      {
        id: "ru_14_new",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211614. \u041A\u0430\u043A\u043E\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u043E \u043E\u0431\u044A\u044F\u0441\u043D\u044F\u0435\u0442 \u043F\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0443 \u0434\u0432\u043E\u0435\u0442\u043E\u0447\u0438\u044F \u0432 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0438: \xAB\u042F \u043F\u043E\u043D\u0438\u043C\u0430\u043B: \u0435\u0441\u043B\u0438 \u043D\u0435 \u043F\u043E\u0442\u043E\u0440\u043E\u043F\u043B\u044E\u0441\u044C, \u0442\u043E \u043E\u043F\u043E\u0437\u0434\u0430\u044E, \u0438 \u0432\u0441\u0435 \u043F\u0440\u043E\u043F\u0430\u0434\u0435\u0442\xBB?",
        options: [
          "1) \u0412\u0442\u043E\u0440\u0430\u044F \u0447\u0430\u0441\u0442\u044C \u0440\u0430\u0441\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435 \u043F\u0435\u0440\u0432\u043E\u0439 (\u043C\u043E\u0436\u043D\u043E \u0432\u0441\u0442\u0430\u0432\u0438\u0442\u044C \xAB\u0430 \u0438\u043C\u0435\u043D\u043D\u043E\xBB).",
          "2) \u0412\u0442\u043E\u0440\u0430\u044F \u0447\u0430\u0441\u0442\u044C \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u043D\u0430 \u043F\u0440\u0438\u0447\u0438\u043D\u0443 \u0442\u043E\u0433\u043E, \u043E \u0447\u0451\u043C \u0433\u043E\u0432\u043E\u0440\u0438\u0442\u0441\u044F \u0432 \u043F\u0435\u0440\u0432\u043E\u0439 (\u043C\u043E\u0436\u043D\u043E \u0432\u0441\u0442\u0430\u0432\u0438\u0442\u044C \xAB\u043F\u043E\u0442\u043E\u043C\u0443 \u0447\u0442\u043E\xBB).",
          "3) \u041F\u0435\u0440\u0432\u0430\u044F \u0447\u0430\u0441\u0442\u044C \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u043D\u0430 \u0443\u0441\u043B\u043E\u0432\u0438\u0435 \u0441\u043E\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0432\u043E \u0432\u0442\u043E\u0440\u043E\u0439 \u0447\u0430\u0441\u0442\u0438."
        ]
      }
    ],
    math: [
      {
        id: "ma_1_9",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21161. \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0434\u0435\u043B\u0435\u043D\u0438\u0435: (6x + 6y)/x : (x^2 - y^2)/x^2",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21161. \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0434\u0435\u043B\u0435\u043D\u0438\u0435: <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>6x + 6y</span><span>x</span></span> : <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>x<sup>2</sup> - y<sup>2</sup></span><span>x<sup>2</sup></span></span>",
        options: ["6/(x - y)", "6x/(x + y)", "(x + y)/6x", "6x/(x - y)"],
        optionsHtml: ["<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>6</span><span>x - y</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>6x</span><span>x + y</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>x + y</span><span>6x</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>6x</span><span>x - y</span></span>"]
      },
      {
        id: "ma_2_9",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21162. \u041F\u043E\u0434\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0432\u0430 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u0446\u0435\u043B\u044B\u0445 \u0447\u0438\u0441\u043B\u0430, \u043C\u0435\u0436\u0434\u0443 \u043A\u043E\u0442\u043E\u0440\u044B\u043C\u0438 \u0437\u0430\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u0447\u0438\u0441\u043B\u043E \u221A37.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21162. \u041F\u043E\u0434\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0432\u0430 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u0446\u0435\u043B\u044B\u0445 \u0447\u0438\u0441\u043B\u0430, \u043C\u0435\u0436\u0434\u0443 \u043A\u043E\u0442\u043E\u0440\u044B\u043C\u0438 \u0437\u0430\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u0447\u0438\u0441\u043B\u043E &radic;37.",
        options: ["36 \u0438 38", "6 \u0438 7", "7 \u0438 8", "\u043D\u0435\u0442 \u0442\u0430\u043A\u0438\u0445 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439"]
      },
      {
        id: "ma_3_9",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u044F: \u221A(0,04 \xB7 81) - 7 \xB7 \u221A(1/49)",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u044F: &radic;(0,04 &middot; 81) - 7 &middot; &radic;<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>1</span><span>49</span></span>",
        options: ["17", "0,8", "17 1/6", "4"],
        optionsHtml: ["17", "0,8", "17 <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>1</span><span>6</span></span>", "4"]
      },
      {
        id: "ma_4_9",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21164. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0440\u0430\u0432\u0435\u043D\u0441\u0442\u0432\u043E:",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21164. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0440\u0430\u0432\u0435\u043D\u0441\u0442\u0432\u043E:",
        options: ["\u221A16 = 4", "\u221A0,4 = 0,2", "7 - \u221A25 = 2", "\u221A((-15)^2) = 15"],
        optionsHtml: ["&radic;16 = 4", "&radic;0,4 = 0,2", "7 - &radic;25 = 2", "&radic;((-15)<sup>2</sup>) = 15"]
      },
      {
        id: "ma_5_9",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21165. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043A\u043E\u0440\u043D\u0438 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F: x^2 + 7x - 18 = 0.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21165. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043A\u043E\u0440\u043D\u0438 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F: x<sup>2</sup> + 7x - 18 = 0.",
        options: ["-2 \u0438 9", "-9 \u0438 2", "\u043A\u043E\u0440\u043D\u0435\u0439 \u043D\u0435\u0442", "2 \u0438 9"]
      },
      {
        id: "ma_6_9",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21166. \u0413\u0440\u0430\u0444\u0438\u043A\u043E\u043C \u043A\u0430\u043A\u043E\u0439 \u0438\u0437 \u0444\u0443\u043D\u043A\u0446\u0438\u0439 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0433\u0438\u043F\u0435\u0440\u0431\u043E\u043B\u0430?",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21166. \u0413\u0440\u0430\u0444\u0438\u043A\u043E\u043C \u043A\u0430\u043A\u043E\u0439 \u0438\u0437 \u0444\u0443\u043D\u043A\u0446\u0438\u0439 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0433\u0438\u043F\u0435\u0440\u0431\u043E\u043B\u0430?",
        options: ["y = x/4", "y = -x/4", "y = 4/x", "y = 4x^2"],
        optionsHtml: ["y = <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>x</span><span>4</span></span>", "y = -<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>x</span><span>4</span></span>", "y = <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>4</span><span>x</span></span>", "y = 4x<sup>2</sup>"]
      },
      {
        id: "ma_7_9",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21167. \u0412 \u043F\u0440\u044F\u043C\u043E\u0443\u0433\u043E\u043B\u044C\u043D\u043E\u043C \u0442\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0435 ABC \u0443\u0433\u043E\u043B B \u0440\u0430\u0432\u0435\u043D 90 \u0433\u0440\u0430\u0434\u0443\u0441\u043E\u0432, AB = 5 \u0441\u043C, AC = 7 \u0441\u043C. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 BC.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21167. \u0412 \u043F\u0440\u044F\u043C\u043E\u0443\u0433\u043E\u043B\u044C\u043D\u043E\u043C \u0442\u0440\u0435\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0435 ABC \u0443\u0433\u043E\u043B B \u0440\u0430\u0432\u0435\u043D 90 \u0433\u0440\u0430\u0434\u0443\u0441\u043E\u0432, AB = 5 \u0441\u043C, AC = 7 \u0441\u043C. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 BC.",
        options: ["24 \u0441\u043C", "12 \u0441\u043C", "2 \u0441\u043C", "\u221A24 \u0441\u043C"],
        optionsHtml: ["24 \u0441\u043C", "12 \u0441\u043C", "2 \u0441\u043C", "&radic;24 \u0441\u043C"]
      },
      {
        id: "ma_8_9",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21168. \u0425\u043E\u0440\u0434\u044B AB \u0438 CD \u043F\u0435\u0440\u0435\u0441\u0435\u043A\u0430\u044E\u0442\u0441\u044F \u0432 \u0442\u043E\u0447\u043A\u0435 E. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 ED, \u0435\u0441\u043B\u0438 AE = 5, BE = 2, CE = ED.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21168. \u0425\u043E\u0440\u0434\u044B AB \u0438 CD \u043F\u0435\u0440\u0435\u0441\u0435\u043A\u0430\u044E\u0442\u0441\u044F \u0432 \u0442\u043E\u0447\u043A\u0435 E. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 ED, \u0435\u0441\u043B\u0438 AE = 5, BE = 2, CE = ED.",
        options: ["10", "\u221A10", "7", "\u221A7"],
        optionsHtml: ["10", "&radic;10", "7", "&radic;7"]
      },
      {
        id: "ma_9_9",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21169. \u0421\u0443\u043C\u043C\u0430 \u0434\u0432\u0443\u0445 \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u043B\u043E\u0436\u043D\u044B\u0445 \u0441\u0442\u043E\u0440\u043E\u043D \u043E\u043F\u0438\u0441\u0430\u043D\u043D\u043E\u0433\u043E \u0447\u0435\u0442\u044B\u0440\u0435\u0445\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0430 \u0440\u0430\u0432\u043D\u0430 12 \u0441\u043C, \u0430 \u0440\u0430\u0434\u0438\u0443\u0441 \u0432\u043F\u0438\u0441\u0430\u043D\u043D\u043E\u0439 \u0432 \u043D\u0435\u0433\u043E \u043E\u043A\u0440\u0443\u0436\u043D\u043E\u0441\u0442\u0438 \u0440\u0430\u0432\u0435\u043D 5 \u0441\u043C. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043F\u043B\u043E\u0449\u0430\u0434\u044C \u0447\u0435\u0442\u044B\u0440\u0435\u0445\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0430.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21169. \u0421\u0443\u043C\u043C\u0430 \u0434\u0432\u0443\u0445 \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u043B\u043E\u0436\u043D\u044B\u0445 \u0441\u0442\u043E\u0440\u043E\u043D \u043E\u043F\u0438\u0441\u0430\u043D\u043D\u043E\u0433\u043E \u0447\u0435\u0442\u044B\u0440\u0435\u0445\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0430 \u0440\u0430\u0432\u043D\u0430 12 \u0441\u043C, \u0430 \u0440\u0430\u0434\u0438\u0443\u0441 \u0432\u043F\u0438\u0441\u0430\u043D\u043D\u043E\u0439 \u0432 \u043D\u0435\u0433\u043E \u043E\u043A\u0440\u0443\u0436\u043D\u043E\u0441\u0442\u0438 \u0440\u0430\u0432\u0435\u043D 5 \u0441\u043C. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043F\u043B\u043E\u0449\u0430\u0434\u044C \u0447\u0435\u0442\u044B\u0440\u0435\u0445\u0443\u0433\u043E\u043B\u044C\u043D\u0438\u043A\u0430.",
        options: ["120 \u0441\u043C^2", "60 \u0441\u043C^2", "30 \u0441\u043C^2", "17 \u0441\u043C"],
        optionsHtml: ["120 \u0441\u043C<sup>2</sup>", "60 \u0441\u043C<sup>2</sup>", "30 \u0441\u043C<sup>2</sup>", "17 \u0441\u043C"]
      },
      {
        id: "ma_10_9",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211610. \u041C\u043E\u0442\u043E\u0446\u0438\u043A\u043B\u0438\u0441\u0442 \u043F\u0440\u043E\u0435\u0445\u0430\u043B 40 \u043A\u043C \u043E\u0442 \u0434\u043E\u043C\u0430 \u0434\u043E \u0440\u0435\u043A\u0438. \u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u044F\u0441\u044C \u043E\u0431\u0440\u0430\u0442\u043D\u043E \u0441\u043E \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C\u044E \u043D\u0430 10 \u043A\u043C/\u0447 \u043C\u0435\u043D\u044C\u0448\u0435\u0439 \u043F\u0435\u0440\u0432\u043E\u043D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0439, \u043E\u043D \u0437\u0430\u0442\u0440\u0430\u0442\u0438\u043B \u043D\u0430 \u044D\u0442\u043E\u0442 \u043F\u0443\u0442\u044C \u043D\u0430 20 \u043C\u0438\u043D \u0431\u043E\u043B\u044C\u0448\u0435. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043F\u0435\u0440\u0432\u043E\u043D\u0430\u0447\u0430\u043B\u044C\u043D\u0443\u044E \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043C\u043E\u0442\u043E\u0446\u0438\u043A\u043B\u0438\u0441\u0442\u0430. \u0415\u0441\u043B\u0438 \u044D\u0442\u0443 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043E\u0431\u043E\u0437\u043D\u0430\u0447\u0438\u0442\u044C \u0437\u0430 \u0445 \u043A\u043C/\u0447, \u0442\u043E \u0437\u0430\u0434\u0430\u0447\u0430 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0440\u0435\u0448\u0435\u043D\u0430 \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F:",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211610. \u041C\u043E\u0442\u043E\u0446\u0438\u043A\u043B\u0438\u0441\u0442 \u043F\u0440\u043E\u0435\u0445\u0430\u043B 40 \u043A\u043C \u043E\u0442 \u0434\u043E\u043C\u0430 \u0434\u043E \u0440\u0435\u043A\u0438. \u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u044F\u0441\u044C \u043E\u0431\u0440\u0430\u0442\u043D\u043E \u0441\u043E \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C\u044E \u043D\u0430 10 \u043A\u043C/\u0447 \u043C\u0435\u043D\u044C\u0448\u0435\u0439 \u043F\u0435\u0440\u0432\u043E\u043D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0439, \u043E\u043D \u0437\u0430\u0442\u0440\u0430\u0442\u0438\u043B \u043D\u0430 \u044D\u0442\u043E\u0442 \u043F\u0443\u0442\u044C \u043D\u0430 20 \u043C\u0438\u043D \u0431\u043E\u043B\u044C\u0448\u0435. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043F\u0435\u0440\u0432\u043E\u043D\u0430\u0447\u0430\u043B\u044C\u043D\u0443\u044E \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043C\u043E\u0442\u043E\u0446\u0438\u043A\u043B\u0438\u0441\u0442\u0430. \u0415\u0441\u043B\u0438 \u044D\u0442\u0443 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u043E\u0431\u043E\u0437\u043D\u0430\u0447\u0438\u0442\u044C \u0437\u0430 \u0445 \u043A\u043C/\u0447, \u0442\u043E \u0437\u0430\u0434\u0430\u0447\u0430 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0440\u0435\u0448\u0435\u043D\u0430 \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F:",
        options: ["40/x + 40/(x-10) = 20 + 3(x-10) = 40", "40/(x-10) - 40/x = 1/3", "40/(x-10) + 40/x = 1/3", "\u0445"],
        optionsHtml: ["<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>40</span><span>x</span></span> + <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>40</span><span>x - 10</span></span> = 20 + 3(x - 10) = 40", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>40</span><span>x - 10</span></span> - <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>40</span><span>x</span></span> = <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>1</span><span>3</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>40</span><span>x - 10</span></span> + <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>40</span><span>x</span></span> = <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>1</span><span>3</span></span>", "\u0445"]
      }
    ],
    logic: commonLogicQuestions
  },
  "10": {
    grade: 10,
    english: english_grade_10_11,
    russian: [
      {
        id: "russian_1",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21161. \u0412\u044B\u043F\u0438\u0448\u0438\u0442\u0435 \u0441\u043B\u043E\u0432\u043E, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u041D\u0415\u0412\u0415\u0420\u041D\u041E \u0432\u044B\u0434\u0435\u043B\u0435\u043D \u0443\u0434\u0430\u0440\u043D\u044B\u0439 \u0433\u043B\u0430\u0441\u043D\u044B\u0439 \u0437\u0432\u0443\u043A.",
        options: ["\u0446\u0435\u043F\u041E\u0447\u043A\u0430", "\u0433\u0430\u0437\u043E\u043F\u0440\u041E\u0432\u043E\u0434", "\u043F\u0440\u043E\u0437\u043E\u0440\u043B\u0418\u0432\u0430", "\u0434\u043E\u043D\u0415\u043B\u044C\u0437\u044F"]
      },
      {
        id: "ru_2_new",
        type: "free_text",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21162. \u0418\u0441\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u043B\u0435\u043A\u0441\u0438\u0447\u0435\u0441\u043A\u0443\u044E \u043E\u0448\u0438\u0431\u043A\u0443 \u0432 \u043E\u0434\u043D\u043E\u043C \u0438\u0437 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0439, \u043F\u043E\u0434\u043E\u0431\u0440\u0430\u0432 \u043A \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u043C\u0443 \u0441\u043B\u043E\u0432\u0443 \u043F\u0430\u0440\u043E\u043D\u0438\u043C. \u0417\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u043F\u043E\u0434\u043E\u0431\u0440\u0430\u043D\u043D\u043E\u0435 \u0441\u043B\u043E\u0432\u043E.\n\n\u041B\u0435\u0442\u043E\u043C \u0432 \u041B\u0415\u0421\u0418\u0421\u0422\u041E\u0419 \u0447\u0430\u0449\u043E\u0431\u0435 \u043F\u043E\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u043F\u043E\u043B\u0447\u0438\u0449\u0430 \u043A\u043E\u043C\u0430\u0440\u043E\u0432.\n\u0421\u0442\u0430\u0442\u044C\u044F \u043E\u043A\u0430\u0437\u0430\u043B\u0430\u0441\u044C \u043F\u043E\u043B\u0435\u0437\u043D\u043E\u0439 \u0438 \u0418\u041D\u0424\u041E\u0420\u041C\u0410\u0422\u0418\u0412\u041D\u041E\u0419.\n\u0412 \u0420\u043E\u0441\u0441\u0438\u0439\u0441\u043A\u043E\u0439 \u0438\u043C\u043F\u0435\u0440\u0438\u0438 \u0432\u044B\u0441\u0448\u0438\u043C \u0441\u0443\u0434\u0435\u0431\u043D\u044B\u043C \u043E\u0440\u0433\u0430\u043D\u043E\u043C \u0431\u044B\u043B \u0412\u0415\u0420\u0425\u041E\u0412\u041D\u042B\u0419 \u0443\u0433\u043E\u043B\u043E\u0432\u043D\u044B\u0439 \u0441\u0443\u0434.\n\u0411\u0443\u0434\u0443 \u0432\u0430\u043C \u043A\u0440\u0430\u0439\u043D\u0435, \u043E\u0447\u0435\u043D\u044C, \u0431\u0435\u0441\u043A\u043E\u043D\u0435\u0447\u043D\u043E \u041F\u0420\u0418\u0417\u041D\u0410\u0422\u0415\u041B\u042C\u041D\u0410."
      },
      {
        id: "russian_3",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u043D\u0443\u0436\u043D\u043E \u043F\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043E\u0434\u043D\u0443 \u0437\u0430\u043F\u044F\u0442\u0443\u044E.",
        options: [
          "\u0412 \u043F\u0440\u0438\u0440\u043E\u0434\u0435 \u043D\u0438 \u043B\u0438\u0441\u0442 \u043D\u0438 \u0441\u043E\u043B\u043E\u043C\u0438\u043D\u043A\u0430 \u043D\u0438 \u0434\u0435\u0440\u0435\u0432\u043E \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u044E\u0442\u0441\u044F.",
          "\u0422\u0443\u043C\u0430\u043D\u044B \u0437\u0434\u0435\u0441\u044C \u0431\u044B\u0432\u0430\u044E\u0442 \u0435\u0441\u043B\u0438 \u043D\u0435 \u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C \u0442\u043E \u0447\u0435\u0440\u0435\u0437 \u0434\u0435\u043D\u044C \u043D\u0435\u043F\u0440\u0435\u043C\u0435\u043D\u043D\u043E.",
          "\u041C\u044B \u0443\u0432\u0438\u0434\u0435\u043B\u0438 \u0437\u0430\u0440\u043E\u0441\u043B\u0438 \u0437\u0435\u043C\u043B\u044F\u043D\u0438\u043A\u0438 \u0438 \u043B\u0435\u0441\u043D\u043E\u0439 \u043C\u0430\u043B\u0438\u043D\u044B \u0438 \u0440\u0435\u0448\u0438\u043B\u0438 \u043D\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u043D\u0430\u0448\u0438 \u043A\u043E\u0440\u0437\u0438\u043D\u043A\u0438.",
          "\u041C\u043E\u043B\u0447\u0430\u043B\u0438 \u0431\u0435\u0440\u0435\u0433 \u0438 \u043C\u043E\u0440\u0435 \u0438 \u043B\u0435\u0441."
        ]
      },
      {
        id: "russian_4",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21164. \u0412\u044B\u0434\u0435\u043B\u0438\u0442\u0435 \u0441\u043B\u043E\u0432\u043E, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u0430 \u0431\u0435\u0437\u0443\u0434\u0430\u0440\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C\u0430\u044F \u0433\u043B\u0430\u0441\u043D\u0430\u044F \u043A\u043E\u0440\u043D\u044F.",
        options: [
          "\u043E\u0437..\u0440\u0438\u0442\u044C",
          "\u043C..\u043B\u0438\u0442\u0432\u0430",
          "\u0437\u0430\u0433..\u0440\u0430\u0442\u044C",
          "\u0441\u043E\u0447..\u0442\u0430\u043D\u0438\u0435",
          "\u043A\u2026\u043B\u043B\u0435\u043A\u0446\u0438\u044F"
        ]
      },
      {
        id: "russian_5",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21165. \u0412\u044B\u043F\u0438\u0448\u0438\u0442\u0435 \u0440\u044F\u0434, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u0432 \u043E\u0431\u043E\u0438\u0445 \u0441\u043B\u043E\u0432\u0430\u0445 \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u0430 \u043E\u0434\u043D\u0430 \u0438 \u0442\u0430 \u0436\u0435 \u0431\u0443\u043A\u0432\u0430.",
        options: [
          "\u0431\u0435..\u0437\u0430\u0449\u0438\u0442\u043D\u044B\u0439, \u0432\u043E\u2026\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u0435;",
          "\u043F\u0440\u0435\u0434..\u044F\u0432\u0438\u0442\u044C, \u0441..\u0435\u0437\u0434;",
          "\u043F\u0440..\u0431\u043B\u0438\u0437\u0438\u0442\u044C, \u043F\u0440..\u0441\u0442\u0430\u0440\u0435\u043B\u044B\u0439;",
          "\u043D..\u043C\u0435\u0440\u0435\u043D\u0438\u0435, \u0432\u0437..\u0431\u0440\u0430\u0442\u044C\u0441\u044F;",
          "\u0438..\u043F\u043E\u0434\u0442\u0438\u0448\u043A\u0430, \u0440\u0430..\u0436\u0430\u043B\u043E\u0431\u0438\u0442\u044C."
        ]
      },
      {
        id: "russian_6",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21166. \u0412\u044B\u043F\u0438\u0448\u0438\u0442\u0435 \u0441\u043B\u043E\u0432\u043E, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u043D\u0430 \u043C\u0435\u0441\u0442\u0435 \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430 \u043F\u0438\u0448\u0435\u0442\u0441\u044F \u0431\u0443\u043A\u0432\u0430 \u0415.",
        options: [
          "\u0437\u0430\u0431\u043E\u043B\u2026\u0432\u0430",
          "\u0432\u044B\u043F\u044F\u0447\u2026\u0432\u0430\u0442\u044C",
          "\u0432\u044B\u043F\u044F\u0447\u2026\u0432\u0430\u0442\u044C",
          "\u0434\u043E\u0441\u0442\u0440\u0430..\u0432\u0430\u0442\u044C",
          "\u043F\u0440\u0438\u0432\u0435\u0440\u0435\u0434\u043B..\u0432\u044B\u0439"
        ]
      },
      {
        id: "russian_7",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21167. \u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u041D\u0415 \u0441\u043E \u0441\u043B\u043E\u0432\u043E\u043C \u043F\u0438\u0448\u0435\u0442\u0441\u044F \u0421\u041B\u0418\u0422\u041D\u041E.",
        options: [
          "\u0418\u0440\u0438\u043D\u0430 \u0410\u043D\u0434\u0440\u0435\u0435\u0432\u043D\u0430 \u0433\u043E\u0432\u043E\u0440\u0438\u043B\u0430 (\u043D\u0435)\u0433\u0440\u043E\u043C\u043A\u043E, \u043D\u043E \u043E\u0447\u0435\u043D\u044C \u0432\u044B\u0440\u0430\u0437\u0438\u0442\u0435\u043B\u044C\u043D\u043E.",
          "\u042F \u0431\u044B\u043B (\u043D\u0435)\u0433\u043E\u0442\u043E\u0432...",
          "(\u041D\u0435)\u0443\u043C\u043E\u043B\u043A\u0430\u044E\u0449\u0438\u0435 \u0434\u043E \u0433\u043B\u0443\u0431\u043E\u043A\u043E\u0439 \u043D\u043E\u0447\u0438 \u0437\u0432\u0443\u043A\u0438...",
          "\u041A\u043E\u043D\u0435\u0447\u043D\u043E, \u044D\u0442\u043E \u0431\u044B\u043B \u0434\u0430\u043B\u0435\u043A\u043E (\u043D\u0435)\u043B\u0443\u0447\u0448\u0438\u0439...",
          "(\u041D\u0435) \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u0430\u044F \u0432\u043E\u0432\u0440\u0435\u043C\u044F \u0442\u0435\u043B\u0435\u0433\u0440\u0430\u043C\u043C\u0430..."
        ]
      },
      {
        id: "ru_8_new",
        type: "free_text",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21168. \u0412 \u043A\u0430\u043A\u043E\u043C \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u043E\u0431\u0430 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u044B\u0445 \u0441\u043B\u043E\u0432\u0430 \u043F\u0438\u0448\u0443\u0442\u0441\u044F \u0421\u041B\u0418\u0422\u041D\u041E? \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u044D\u0442\u043E \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0438 \u0432\u044B\u043F\u0438\u0448\u0438\u0442\u0435 \u044D\u0442\u0438 \u0434\u0432\u0430 \u0441\u043B\u043E\u0432\u0430 \u0431\u0435\u0437 \u043F\u0440\u043E\u0431\u0435\u043B\u043E\u0432 (\u0441\u043B\u0438\u0442\u043D\u043E \u0432 \u043E\u0434\u0438\u043D \u0440\u044F\u0434, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0442\u0430\u043A\u0436\u0435\u043F\u043E\u044D\u0442\u043E\u043C\u0443).\n\n1) \u0427\u0422\u041E(\u0411\u042B) ... \u0422\u0410\u041A(\u0416\u0415)\n2) (\u0412)\u0417\u0410\u041A\u041B\u042E\u0427\u0415\u041D\u0418\u0415 ... (\u0418)\u0422\u0410\u041A\n3) (\u0422\u041E\u0422)\u0427\u0410\u0421 ... \u041F\u0415\u0420\u0412\u042B\u0419(\u0416\u0415)\n4) \u041A\u0410\u041A(\u0411\u042B) ... (\u041D\u0410)\u041F\u0415\u0420\u0415\u0413\u041E\u041D\u041A\u0418\n5) \u0422\u0410\u041A(\u0416\u0415) ... (\u041F\u041E)\u042D\u0422\u041E\u041C\u0423"
      }
    ],
    math: [
      {
        id: "ma_1_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21161. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u044F: (5/12 + 3/8) \xB7 12/19",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21161. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u044F: ( <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>5</span><span>12</span></span> + <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>3</span><span>8</span></span> ) &middot; <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>12</span><span>19</span></span>",
        options: ["1/3", "1/19", "1/2", "5/19"]
      },
      {
        id: "ma_2_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21162. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u044F: 39,156 : 7,8 + 1,18",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21162. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u044F: 39,156 : 7,8 + 1,18",
        options: ["5,28", "6,28", "5,02", "6,2"]
      },
      {
        id: "ma_3_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u0420\u0435\u0448\u0438\u0442\u0435 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435: 15,3 : 1,5 = 2x : 8,2",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u0420\u0435\u0448\u0438\u0442\u0435 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435: 15,3 : 1,5 = 2x : 8,2",
        options: ["41,82", "41,62", "83,61", "83,64"]
      },
      {
        id: "ma_4_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21164. \u0418\u0437 2,5 \u043A\u0433 \u0440\u0436\u0430\u043D\u043E\u0439 \u043C\u0443\u043A\u0438 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442\u0441\u044F 3,5 \u043A\u0433 \u0445\u043B\u0435\u0431\u0430. \u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0445\u043B\u0435\u0431\u0430 \u043C\u043E\u0436\u043D\u043E \u0438\u0441\u043F\u0435\u0447\u044C \u0438\u0437 70 \u0442 \u0440\u0436\u0430\u043D\u043E\u0439 \u043C\u0443\u043A\u0438?",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21164. \u0418\u0437 2,5 \u043A\u0433 \u0440\u0436\u0430\u043D\u043E\u0439 \u043C\u0443\u043A\u0438 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442\u0441\u044F 3,5 \u043A\u0433 \u0445\u043B\u0435\u0431\u0430. \u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0445\u043B\u0435\u0431\u0430 \u043C\u043E\u0436\u043D\u043E \u0438\u0441\u043F\u0435\u0447\u044C \u0438\u0437 70 \u0442 \u0440\u0436\u0430\u043D\u043E\u0439 \u043C\u0443\u043A\u0438?",
        options: ["98\u0442", "50 \u0442", "108\u0442", "86\u0442"]
      },
      {
        id: "ma_5_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21165. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u044F: 3,8 \xB7 (-1,5) + (-35,2) : (-5)",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21165. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u044F: 3,8 &middot; (-1,5) + (-35,2) : (-5)",
        options: ["- 7,4", "1,34", "\u2013 1,34", "12,04"]
      },
      {
        id: "ma_6_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21166. \u0412\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u0435 2x / \u221A(x - 12) \u043F\u0440\u0438 x = 12,5 (25/2)",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21166. \u0412\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u0435 <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 4px;'><span style='border-bottom:1px solid currentColor;'>2x</span><span>&radic;(x - 12)</span></span> \u043F\u0440\u0438 x = 12,5 (25/2)",
        options: ["12,5\u221A2", "\u221A2", "25\u221A2", "2\u221A2"]
      },
      {
        id: "ma_7_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21167. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043D\u0430\u0438\u0431\u043E\u043B\u044C\u0448\u0435\u0435 \u0438\u0437 \u0447\u0438\u0441\u0435\u043B, \u0435\u0441\u043B\u0438 \u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E, \u0447\u0442\u043E 0 < x < 1",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21167. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043D\u0430\u0438\u0431\u043E\u043B\u044C\u0448\u0435\u0435 \u0438\u0437 \u0447\u0438\u0441\u0435\u043B, \u0435\u0441\u043B\u0438 \u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E, \u0447\u0442\u043E 0 &lt; x &lt; 1",
        options: ["x^15", "x^13", "x^5", "x^16"],
        optionsHtml: ["x<sup>15</sup>", "x<sup>13</sup>", "x<sup>5</sup>", "x<sup>16</sup>"]
      },
      {
        id: "ma_8_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21168. \u0423\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u0435 (2a - 3)^2 - 5a(6a - 7)",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21168. \u0423\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u0435 (2a - 3)<sup>2</sup> - 5a(6a - 7)",
        options: ["-26a^2 - 23a + 9", "26a^2 + 23a + 9", "-26a^2 - 23a - 9", "-26a^2 + 23a + 9"],
        optionsHtml: ["-26a<sup>2</sup> - 23a + 9", "26a<sup>2</sup> + 23a + 9", "-26a<sup>2</sup> - 23a - 9", "-26a<sup>2</sup> + 23a + 9"]
      },
      {
        id: "ma_9_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21169. \u0423\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u0435 b / (a^2 - ab) : b^2 / (a^2 - b^2)",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21169. \u0423\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u0435 <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>b</span><span>a<sup>2</sup> - ab</span></span> : <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>b<sup>2</sup></span><span>a<sup>2</sup> - b<sup>2</sup></span></span>",
        options: ["(a+b)/a", "(a+b)/ab", "(a+b)/b", "ab/(a+b)"],
        optionsHtml: ["<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>a+b</span><span>a</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>a+b</span><span>ab</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>a+b</span><span>b</span></span>", "<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;'><span style='border-bottom:1px solid currentColor;'>ab</span><span>a+b</span></span>"]
      },
      {
        id: "ma_10_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211610. \u0423\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u0435 ((a^7 \xB7 a^-3) / a)^3",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211610. \u0423\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u0435 ( <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>a<sup>7</sup> &middot; a<sup>-3</sup></span><span>a</span></span> )<sup>3</sup>",
        options: ["a^11", "a^6", "a^9", "a^-1"],
        optionsHtml: ["a<sup>11</sup>", "a<sup>6</sup>", "a<sup>9</sup>", "a<sup>-1</sup>"]
      },
      {
        id: "ma_11_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211611. \u041F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C a_n \u0437\u0430\u0434\u0430\u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u043C \u043E\u0431\u0440\u0430\u0437\u043E\u043C: a_1 = 2, a_n = a_(n-1) - 3. \u0427\u0435\u043C\u0443 \u0440\u0430\u0432\u043D\u043E a_5 - a_4?",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211611. \u041F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C a<sub>n</sub> \u0437\u0430\u0434\u0430\u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u043C \u043E\u0431\u0440\u0430\u0437\u043E\u043C: a<sub>1</sub> = 2, a<sub>n</sub> = a<sub>n-1</sub> - 3. \u0427\u0435\u043C\u0443 \u0440\u0430\u0432\u043D\u043E a<sub>5</sub> - a<sub>4</sub>?",
        options: ["-10", "3", "-7", "-3"]
      },
      {
        id: "ma_12_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211612. \u0412 \u043A\u0430\u043A\u043E\u043C \u043F\u0440\u043E\u043C\u0435\u0436\u0443\u0442\u043A\u0435 \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u0441\u044F \u043A\u043E\u0440\u0435\u043D\u044C \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F (2x + 20) / 24 = (x + 12) / 15",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211612. \u0412 \u043A\u0430\u043A\u043E\u043C \u043F\u0440\u043E\u043C\u0435\u0436\u0443\u0442\u043A\u0435 \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u0441\u044F \u043A\u043E\u0440\u0435\u043D\u044C \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>2x + 20</span><span>24</span></span> = <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>x + 12</span><span>15</span></span>",
        options: ["(-\u221E; -3)", "(0; 3)", "(-3; 0)", "(3; +\u221E)"]
      },
      {
        id: "ma_13_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211613. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0441\u0443\u043C\u043C\u0443 \u043A\u043E\u0440\u043D\u0435\u0439 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F: 2x^2 + 3x - 5 = 0",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211613. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0441\u0443\u043C\u043C\u0443 \u043A\u043E\u0440\u043D\u0435\u0439 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u044F: 2x<sup>2</sup> + 3x - 5 = 0",
        options: ["-1,5", "3", "1,5", "-3"]
      },
      {
        id: "ma_14_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211614. \u0421\u043A\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u0440\u043D\u0435\u0439 \u0438\u043C\u0435\u0435\u0442 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435: x^4 + 4x^2 + 4 = 0",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211614. \u0421\u043A\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u0440\u043D\u0435\u0439 \u0438\u043C\u0435\u0435\u0442 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435: x<sup>4</sup> + 4x<sup>2</sup> + 4 = 0",
        options: ["2", "\u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E", "4", "1"]
      },
      {
        id: "ma_15_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211615. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u0435 (x_0; y_0) \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0439 |x - 3| - y = 3 \u0438 x - 2y = 6 \u0438 \u0432\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F x_0 \xB7 y_0",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211615. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u0435 (x<sub>0</sub>; y<sub>0</sub>) \u0441\u0438\u0441\u0442\u0435\u043C\u044B \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0439:<br><div style='display:inline-block;border-left:1px solid;padding-left:5px;'>|x - 3| - y = 3<br>x - 2y = 6</div><br>\u0438 \u0432\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F x<sub>0</sub> &middot; y<sub>0</sub>",
        options: ["-1", "0", "-2", "-4"]
      },
      {
        id: "ma_16_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211616. \u0420\u0435\u0448\u0438\u0442\u0435 \u043D\u0435\u0440\u0430\u0432\u0435\u043D\u0441\u0442\u0432\u043E 7 - 2x < -23 - 5(x - 3). \u0412 \u043E\u0442\u0432\u0435\u0442\u0435 \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u043D\u0430\u0438\u0431\u043E\u043B\u044C\u0448\u0435\u0435 \u0447\u0438\u0441\u043B\u043E.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211616. \u0420\u0435\u0448\u0438\u0442\u0435 \u043D\u0435\u0440\u0430\u0432\u0435\u043D\u0441\u0442\u0432\u043E 7 - 2x &lt; -23 - 5(x - 3). \u0412 \u043E\u0442\u0432\u0435\u0442\u0435 \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u043D\u0430\u0438\u0431\u043E\u043B\u044C\u0448\u0435\u0435 \u0447\u0438\u0441\u043B\u043E.",
        options: ["0", "-6", "-5", "-4"]
      },
      {
        id: "ma_17_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211617. \u0420\u0435\u0448\u0438\u0442\u0435 \u0441\u0438\u0441\u0442\u0435\u043C\u0443 \u043D\u0435\u0440\u0430\u0432\u0435\u043D\u0441\u0442\u0432 (x - 1)/2 > (x - 2)/3 \u0438 2x - 5 < 3x - 8",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211617. \u0420\u0435\u0448\u0438\u0442\u0435 \u0441\u0438\u0441\u0442\u0435\u043C\u0443 \u043D\u0435\u0440\u0430\u0432\u0435\u043D\u0441\u0442\u0432:<br><div style='display:inline-block;border-left:1px solid;padding-left:5px;'><span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>x - 1</span><span>2</span></span> &gt; <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>x - 2</span><span>3</span></span><br><br>2x - 5 &lt; 3x - 8</div>",
        options: ["(-\u221E; -1) \u222A (3; +\u221E)", "(-1; -3)", "(3; +\u221E)", "\u043D\u0435\u0442 \u0440\u0435\u0448\u0435\u043D\u0438\u0439"]
      },
      {
        id: "ma_18_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211618. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0446\u0435\u043B\u044B\u0445 \u0440\u0435\u0448\u0435\u043D\u0438\u0439 \u043D\u0435\u0440\u0430\u0432\u0435\u043D\u0441\u0442\u0432\u0430 2x^2 + 6x - 8 \u2264 0",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211618. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0446\u0435\u043B\u044B\u0445 \u0440\u0435\u0448\u0435\u043D\u0438\u0439 \u043D\u0435\u0440\u0430\u0432\u0435\u043D\u0441\u0442\u0432\u0430 2x<sup>2</sup> + 6x - 8 &le; 0",
        options: ["3", "6", "5", "4"]
      },
      {
        id: "ma_19_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211619. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043E\u0431\u043B\u0430\u0441\u0442\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u0444\u0443\u043D\u043A\u0446\u0438\u0438 y = \u221A(30 - 2x)",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211619. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043E\u0431\u043B\u0430\u0441\u0442\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u0444\u0443\u043D\u043A\u0446\u0438\u0438 y = &radic;(30 - 2x)",
        options: ["(-\u221E; 15]", "(-\u221E; +\u221E)", "(-\u221E; 15)", "[15; +\u221E)"]
      },
      {
        id: "ma_20_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211620. \u0413\u0440\u0430\u0444\u0438\u043A \u043A\u0430\u043A\u043E\u0439 \u0444\u0443\u043D\u043A\u0446\u0438\u0438 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D \u043D\u0430 \u0440\u0438\u0441\u0443\u043D\u043A\u0435?",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211620. \u0413\u0440\u0430\u0444\u0438\u043A \u043A\u0430\u043A\u043E\u0439 \u0444\u0443\u043D\u043A\u0446\u0438\u0438 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D \u043D\u0430 \u0440\u0438\u0441\u0443\u043D\u043A\u0435?<br><br><img src='/math10_20.png' alt='\u0413\u0440\u0430\u0444\u0438\u043A \u0444\u0443\u043D\u043A\u0446\u0438\u0438' style='max-width:300px;display:block;margin:10px 0;' />",
        options: ["y = -x^2 + 1", "y = -x^2 + 4x + 3", "y = -x^2 - 4x - 3", "y = -x^2 + 4x - 3"],
        optionsHtml: ["y = -x<sup>2</sup> + 1", "y = -x<sup>2</sup> + 4x + 3", "y = -x<sup>2</sup> - 4x - 3", "y = -x<sup>2</sup> + 4x - 3"]
      },
      {
        id: "ma_21_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211621. \u041D\u0430 \u0440\u0438\u0441\u0443\u043D\u043A\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0430 \u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u044C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432\u0435\u0449\u0435\u0441\u0442\u0432\u0430 \u0422 \u043E\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 t. \u0423\u043A\u0430\u0436\u0438\u0442\u0435, \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u043A\u0430\u043A\u043E\u0433\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0432\u0435\u0449\u0435\u0441\u0442\u0432\u0430 \u0431\u044B\u043B\u0430 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u0430.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211621. \u041D\u0430 \u0440\u0438\u0441\u0443\u043D\u043A\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0430 \u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u044C \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B \u0432\u0435\u0449\u0435\u0441\u0442\u0432\u0430 \u0422 \u043E\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 t. \u0423\u043A\u0430\u0436\u0438\u0442\u0435, \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u043A\u0430\u043A\u043E\u0433\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430 \u0432\u0435\u0449\u0435\u0441\u0442\u0432\u0430 \u0431\u044B\u043B\u0430 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u0430.<br><br><img src='/math10_21.png' alt='\u0413\u0440\u0430\u0444\u0438\u043A \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u044B' style='max-width:300px;display:block;margin:10px 0;' />",
        options: ["2", "3", "1", "4"]
      }
    ],
    logic: commonLogicQuestions
  },
  "11": {
    grade: 11,
    english: english_grade_10_11,
    russian: [
      {
        id: "russian_1",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21161. \u041E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \u0441\u043B\u043E\u0432\u043E, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u041D\u0415\u0412\u0415\u0420\u041D\u041E \u0432\u044B\u0434\u0435\u043B\u0435\u043D \u0443\u0434\u0430\u0440\u043D\u044B\u0439 \u0433\u043B\u0430\u0441\u043D\u044B\u0439 \u0437\u0432\u0443\u043A \u0432\u0435\u0440\u043E\u0438\u0441\u043F\u043E\u0432\u0435\u0434\u0410\u043D\u0438\u0435",
        options: ["\u0437\u0430\u043F\u0435\u0440\u043B\u0410", "\u043E\u043F\u0442\u041E\u0432\u044B\u0439", "\u043A\u0440\u0430\u0441\u0418\u0432\u0435\u0435"]
      },
      {
        id: "russian_2",
        type: "two_step",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21162. \u0412 \u043E\u0434\u043D\u043E\u043C \u0438\u0437 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0439 \u043D\u0438\u0436\u0435 \u0434\u043E\u043F\u0443\u0449\u0435\u043D\u0430 \u043B\u0435\u043A\u0441\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 (\u043D\u0435\u0432\u0435\u0440\u043D\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u0435 \u0441\u043B\u043E\u0432\u043E).",
        step2Text: "\u0418\u0441\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u043E\u0448\u0438\u0431\u043A\u0443, \u043F\u043E\u0434\u043E\u0431\u0440\u0430\u0432 \u043A \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u043C\u0443 \u0441\u043B\u043E\u0432\u0443 \u0432\u0435\u0440\u043D\u044B\u0439 \u043F\u0430\u0440\u043E\u043D\u0438\u043C. \u0417\u0430\u043F\u0438\u0448\u0438\u0442\u0435 \u043F\u043E\u0434\u043E\u0431\u0440\u0430\u043D\u043D\u043E\u0435 \u0441\u043B\u043E\u0432\u043E \u0432 \u043F\u043E\u043B\u0435 \u043D\u0438\u0436\u0435.",
        options: [
          "1. \u041D\u0430 \u043F\u0440\u043E\u0433\u0443\u043B\u043A\u0443 \u041A\u0430\u0442\u044F \u041D\u0410\u0414\u0415\u041B\u0410 \u0442\u0451\u043F\u043B\u0443\u044E \u0448\u0430\u043F\u043A\u0443.",
          "2. \u041D\u0443\u0436\u043D\u044B \u0441\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u041D\u0410\u041B\u0418\u0427\u041D\u041E\u0421\u0422\u0418 \u0432 \u0444\u043E\u043D\u0434\u0430\u0445 \u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0438 \u043D\u043E\u0432\u044B\u0445 \u043F\u043E\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0439.",
          "3. \u041C\u043D\u043E\u0433\u0438\u0435 \u0436\u0435\u043D\u0449\u0438\u043D\u044B \u043F\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u043B\u0438 \u043D\u0430 \u043D\u043E\u0432\u0443\u044E \u0433\u043E\u0441\u0442\u044C\u044E \u0441 \u0437\u0430\u0432\u0438\u0441\u0442\u044C\u044E \u0438 \u041D\u0415\u0414\u041E\u0411\u0420\u041E\u0416\u0415\u041B\u0410\u0422\u0415\u041B\u042C\u041D\u041E\u0421\u0422\u042C\u042E.",
          "4. \u0418\u0437 \u0440\u0430\u0434\u0438\u043E\u043F\u0440\u0438\u0451\u043C\u043D\u0438\u043A\u0430 \u0434\u043E\u043D\u043E\u0441\u0438\u043B\u0441\u044F \u041D\u0415\u041C\u0423\u0414\u0420\u0401\u041D\u042B\u0419, \u043E\u0434\u043D\u043E\u043E\u0431\u0440\u0430\u0437\u043D\u044B\u0439 \u043C\u043E\u0442\u0438\u0432\u0447\u0438\u043A."
        ]
      },
      {
        id: "russian_3",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21163. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0432\u0435\u0440\u043D\u0443\u044E \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0443 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F: \xAB\u041F\u043E\u043A\u0430 \u043C\u044B \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0438\u043B\u0438 \u0447\u0435\u0440\u0435\u0437 \u043F\u043E\u043B\u044F\u043D\u0443, \u0442\u0443\u0440\u043A\u0438 \u0443\u0441\u043F\u0435\u043B\u0438 \u0441\u0434\u0435\u043B\u0430\u0442\u044C \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0432\u044B\u0441\u0442\u0440\u0435\u043B\u043E\u0432.\xBB \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u043E\u0447\u0438\u043D\u0435\u043D\u043D\u043E\u0435",
        options: ["\u0441\u043B\u043E\u0436\u043D\u043E\u043F\u043E\u0434\u0447\u0438\u043D\u0435\u043D\u043D\u043E\u0435", "\u0431\u0435\u0441\u0441\u043E\u044E\u0437\u043D\u043E\u0435"]
      },
      {
        id: "russian_4",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21164. \u0412\u044B\u0434\u0435\u043B\u0438\u0442\u0435 \u0441\u043B\u043E\u0432\u043E, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u0430 \u0431\u0435\u0437\u0443\u0434\u0430\u0440\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C\u0430\u044F \u0433\u043B\u0430\u0441\u043D\u0430\u044F \u043A\u043E\u0440\u043D\u044F. \u0444..\u043E\u043B\u0435\u0442\u043E\u0432\u044B\u0439",
        options: [
          "\u043F\u0435\u0440\u0435\u0431..\u0440\u0430\u0442\u044C",
          "\u043F\u0440..\u0441\u0442\u043E\u0434\u0443\u0448\u043D\u044B\u0439",
          "\u0432\u044B\u0442..\u0440\u0435\u0442\u044C",
          "\u043F\u0440\u0438\u043A..\u0441\u043D\u043E\u0432\u0435\u043D\u0438\u0435"
        ]
      },
      {
        id: "russian_6",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21166. \u0412\u044B\u043F\u0438\u0448\u0438\u0442\u0435 \u0441\u043B\u043E\u0432\u043E, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u043C \u043D\u0430 \u043C\u0435\u0441\u0442\u0435 \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430 \u043F\u0438\u0448\u0435\u0442\u0441\u044F \u0431\u0443\u043A\u0432\u0430 \u0415. \u043F\u043E\u0434\u0441\u0442\u0440\u0430\u2026\u0432\u0430\u0442\u044C\u0441\u044F",
        options: ["\u044D\u043C\u0430\u043B\u2026\u0432\u044B\u0439", "\u043F\u0440\u043E\u0441\u0442\u0430\u2026\u0432\u0430\u0442\u044C", "\u0438\u0437\u043C\u0435\u043D\u0447..\u0432\u044B\u0439"]
      },
      {
        id: "russian_8",
        type: "two_step",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u21168. \u0412 \u043A\u0430\u043A\u043E\u043C \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u043E\u0431\u0430 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u044B\u0445 \u0441\u043B\u043E\u0432\u0430 \u043F\u0438\u0448\u0443\u0442\u0441\u044F \u0421\u041B\u0418\u0422\u041D\u041E?",
        step2Text: "\u0412\u044B\u043F\u0438\u0448\u0438\u0442\u0435 \u044D\u0442\u0438 \u0434\u0432\u0430 \u0441\u043B\u043E\u0432\u0430 \u0438\u0437 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F. \u041F\u0438\u0448\u0438\u0442\u0435 \u0438\u0445 \u0441\u043B\u0438\u0442\u043D\u043E, \u0431\u0435\u0437 \u043F\u0440\u043E\u0431\u0435\u043B\u043E\u0432 \u0438 \u0437\u043D\u0430\u043A\u043E\u0432 \u043F\u0440\u0435\u043F\u0438\u043D\u0430\u043D\u0438\u044F, \u0432 \u0442\u043E\u043C \u0432\u0438\u0434\u0435, \u0432 \u043A\u0430\u043A\u043E\u043C \u043E\u043D\u0438 \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u0432 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0438.",
        options: [
          "1. (\u041D\u0415)\u0421\u041C\u041E\u0422\u0420\u042F \u043D\u0430 \u0442\u043E \u0447\u0442\u043E \u0431\u043E\u043B\u044C\u0448\u0438\u043D\u0441\u0442\u0432\u043E \u0441\u0442\u0438\u0445\u043E\u0442\u0432\u043E\u0440\u0435\u043D\u0438\u0439 \u0416\u0443\u043A\u043E\u0432\u0441\u043A\u043E\u0433\u043E \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u043D\u044B\u043C\u0438, \u0432 \u043D\u0438\u0445 \u043C\u044B \u0412\u0421\u0401(\u0422\u0410\u041A\u0418) \u0432\u0438\u0434\u0438\u043C \u0440\u0443\u0441\u0441\u043A\u0438\u0439 \u043F\u0435\u0439\u0437\u0430\u0436.",
          "2. \u042F \u0445\u043E\u0447\u0443 \u043F\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C \u0441 \u0432\u0430\u043C\u0438 (\u041D\u0410)\u0421\u0427\u0401\u0422 \u043A\u0432\u0430\u0440\u0442\u0438\u0440\u044B, (\u0412)\u0421\u0412\u042F\u0417\u0418 \u0441 \u0447\u0435\u043C \u043F\u0440\u043E\u0448\u0443 \u0443\u0434\u0435\u043B\u0438\u0442\u044C \u043C\u043D\u0435 \u0432\u043D\u0438\u043C\u0430\u043D\u0438\u0435.",
          "3. \u0421\u0442\u0443\u0434\u0435\u043D\u0442 \u0432\u044B\u0431\u0440\u0430\u043B \u044D\u0442\u0443 \u0442\u0435\u043C\u0443 \u0440\u0435\u0444\u0435\u0440\u0430\u0442\u0430, \u0427\u0422\u041E(\u0411\u042B) \u043B\u0443\u0447\u0448\u0435 \u0443\u0437\u043D\u0430\u0442\u044C \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u043C\u0443\u0437\u044B\u043A\u0438, \u0438 \u0412(\u0422\u0415\u0427\u0415\u041D\u0418\u0415) \u043C\u0435\u0441\u044F\u0446\u0430 \u0438\u0437\u0443\u0447\u0430\u043B \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u044B\u0435 \u0432 \u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0435 \u043A\u043D\u0438\u0433\u0438.",
          "4. \u0422\u0438\u0445\u043E \u043E\u043F\u0443\u0441\u0442\u0438\u043B\u043E\u0441\u044C \u0441\u043E\u043B\u043D\u0446\u0435 \u0437\u0430 \u0433\u043E\u0440\u044B, \u0432\u044B\u0431\u0440\u043E\u0441\u0438\u043B\u043E (\u041A)\u0412\u0415\u0420\u0425\u0423 \u043F\u0440\u043E\u0449\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0435\u043B\u0451\u043D\u044B\u0439 \u043B\u0443\u0447, \u0438 \u0411\u0430\u0439\u043A\u0430\u043B (\u0422\u041E\u0422)\u0427\u0410\u0421 \u043E\u0442\u0440\u0430\u0437\u0438\u043B \u0432 \u0441\u0435\u0431\u0435 \u043D\u0435\u0436\u043D\u0443\u044E \u0437\u0435\u043B\u0435\u043D\u044C.",
          "5. \u0410 \u0432\u0435\u0447\u0435\u0440\u043E\u043C \u043E\u043D \u0441\u0438\u0434\u0435\u043B \u043E\u043F\u044F\u0442\u044C \u0417\u0410 (\u0422\u0415\u041C) \u0436\u0435 \u0441\u0442\u043E\u043B\u043E\u043C \u0438, \u043F\u043E\u043B\u043E\u0436\u0438\u0432 \u0433\u043E\u043B\u043E\u0432\u0443 \u043D\u0430 \u0440\u0443\u043A\u0443, \u0441\u043B\u0443\u0448\u0430\u043B \u041D\u0430\u0441\u0442\u0430\u0441\u044C\u044E \u041F\u0435\u0442\u0440\u043E\u0432\u043D\u0443 \u0438 \u043F\u044B\u0442\u0430\u043B\u0441\u044F \u043F\u043E\u043D\u044F\u0442\u044C, \u041F\u041E (\u0427\u0415\u041C\u0423) \u0435\u043C\u0443 \u0442\u0430\u043A \u0445\u043E\u0440\u043E\u0448\u043E \u0432 \u044D\u0442\u043E\u043C \u0434\u043E\u043C\u0435."
        ]
      },
      {
        id: "russian_10",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u211610. \u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0432\u0441\u0435 \u0446\u0438\u0444\u0440\u044B, \u043D\u0430 \u043C\u0435\u0441\u0442\u0435 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0432 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u0434\u043E\u043B\u0436\u043D\u044B \u0441\u0442\u043E\u044F\u0442\u044C \u0437\u0430\u043F\u044F\u0442\u044B\u0435. \u0421\u043E\u043B\u043D\u0446\u0435 (1) \u043D\u0435 \u0441\u043F\u0435\u0448\u0430 (2) \u043F\u043E\u0434\u043D\u0438\u043C\u0430\u043B\u043E\u0441\u044C \u043D\u0430\u0434 \u0433\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u043E\u043C (3) \u043E\u0437\u0430\u0440\u044F\u044F \u043F\u0435\u0440\u0432\u044B\u043C\u0438 \u043B\u0443\u0447\u0430\u043C\u0438 (4) \u043F\u043E\u043B\u044F (5) \u0437\u0430\u0441\u0435\u044F\u043D\u043D\u044B\u0435 \u043F\u0448\u0435\u043D\u0438\u0446\u0435\u0439.",
        options: ["1, 2, 3", "3, 5", "3, 4, 5", "1, 2, 3, 4, 5"]
      }
    ],
    math: [
      {
        id: "ma_1_11",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04101. \u0423\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u0435: -4sin^2 \u03B1 + 5 - 4cos^2 \u03B1",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04101. \u0423\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u0438\u0435: -4sin<sup>2</sup> &alpha; + 5 - 4cos<sup>2</sup> &alpha;",
        options: ["1", "9", "1 + 8sin^2 \u03B1", "1 + 8cos^2 \u03B1"],
        optionsHtml: ["1", "9", "1 + 8sin<sup>2</sup> &alpha;", "1 + 8cos<sup>2</sup> &alpha;"]
      },
      {
        id: "ma_2_11",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04102. \u0412\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u044C: 4sin(x/7)cos(x/7) \u043F\u0440\u0438 x = 7/4\u03C0",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04102. \u0412\u044B\u0447\u0438\u0441\u043B\u0438\u0442\u044C: 4sin<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>x</span><span>7</span></span>cos<span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>x</span><span>7</span></span> \u043F\u0440\u0438 x = <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>7</span><span>4</span></span>&pi;",
        options: ["0", "2", "-1", "-2"]
      },
      {
        id: "ma_3_11",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04103. \u0420\u0435\u0448\u0438\u0442\u0435 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435: cos^2 x - sin^2 x = 0,5",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04103. \u0420\u0435\u0448\u0438\u0442\u0435 \u0443\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435: cos<sup>2</sup> x - sin<sup>2</sup> x = 0,5",
        options: ["\xB1\u03C0/3 + \u03C0n, n \u2208 Z", "\xB1\u03C0/3 + 2\u03C0n, n \u2208 Z", "\xB1\u03C0/6 + \u03C0n, n \u2208 Z", "\xB1\u03C0/6 + 2\u03C0n, n \u2208 Z"]
      },
      {
        id: "ma_4_11",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04104. \u0420\u0435\u0448\u0438\u0442\u0435 \u043D\u0435\u0440\u0430\u0432\u0435\u043D\u0441\u0442\u0432\u043E: ((2x - 3)(6 + 3x)) / (7 - 4x) \u2265 0",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04104. \u0420\u0435\u0448\u0438\u0442\u0435 \u043D\u0435\u0440\u0430\u0432\u0435\u043D\u0441\u0442\u0432\u043E: <span style='display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-size:0.9em;margin:0 2px;'><span style='border-bottom:1px solid currentColor;'>(2x - 3)(6 + 3x)</span><span>7 - 4x</span></span> &ge; 0",
        options: ["(-\u221E; -2] \u222A [1,5; 0)", "[-2; -1,5] \u222A (1,75; +\u221E)", "(-2; -1,5) \u222A [1,75; +\u221E)", "(-\u221E; -2] \u222A [1,5; 1,75)"]
      },
      {
        id: "ma_5_11",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04105. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043C\u043D\u043E\u0436\u0435\u0441\u0442\u0432\u043E \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439 \u0444\u0443\u043D\u043A\u0446\u0438\u0438: y = 11cos x",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04105. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043C\u043D\u043E\u0436\u0435\u0441\u0442\u0432\u043E \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439 \u0444\u0443\u043D\u043A\u0446\u0438\u0438: y = 11cos x",
        options: ["[0; 11]", "[-1; 1]", "(-\u221E; +\u221E)", "[-11; 11]"]
      },
      {
        id: "ma_6_11",
        type: "multiple_choice",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04106. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u043D\u0443\u044E \u0444\u0443\u043D\u043A\u0446\u0438\u0438: y = 3x^2 cos x",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04106. \u041D\u0430\u0439\u0434\u0438\u0442\u0435 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u043D\u0443\u044E \u0444\u0443\u043D\u043A\u0446\u0438\u0438: y = 3x<sup>2</sup> cos x",
        options: ["-6xsin x", "6xcos x - 3x^2sin x", "x^3cos x + 3x^2sin x", "6xcos x + 3x^2sin x"],
        optionsHtml: ["-6xsin x", "6xcos x - 3x<sup>2</sup>sin x", "x<sup>3</sup>cos x + 3x<sup>2</sup>sin x", "6xcos x + 3x<sup>2</sup>sin x"]
      },
      {
        id: "ma_7_11",
        type: "free_text",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04121. \u0422\u043E\u0447\u043A\u0430 \u0434\u0432\u0438\u0436\u0435\u0442\u0441\u044F \u043F\u043E \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u043D\u043E\u0439 \u043F\u0440\u044F\u043C\u043E\u0439 \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u0437\u0430\u043A\u043E\u043D\u0443 X(t) = 3 + 2t + t^2, \u0433\u0434\u0435 X(t) \u2014 \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u0430 \u0442\u043E\u0447\u043A\u0438 \u0432 \u043C\u043E\u043C\u0435\u043D\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 t. \u0412 \u043A\u0430\u043A\u043E\u0439 \u043C\u043E\u043C\u0435\u043D\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0442\u043E\u0447\u043A\u0438 \u0431\u0443\u0434\u0435\u0442 \u0440\u0430\u0432\u043D\u0430 5?",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04121. \u0422\u043E\u0447\u043A\u0430 \u0434\u0432\u0438\u0436\u0435\u0442\u0441\u044F \u043F\u043E \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u043D\u043E\u0439 \u043F\u0440\u044F\u043C\u043E\u0439 \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u0437\u0430\u043A\u043E\u043D\u0443 X(t) = 3 + 2t + t<sup>2</sup>, \u0433\u0434\u0435 X(t) \u2014 \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u0430 \u0442\u043E\u0447\u043A\u0438 \u0432 \u043C\u043E\u043C\u0435\u043D\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 t. \u0412 \u043A\u0430\u043A\u043E\u0439 \u043C\u043E\u043C\u0435\u043D\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0442\u043E\u0447\u043A\u0438 \u0431\u0443\u0434\u0435\u0442 \u0440\u0430\u0432\u043D\u0430 5?"
      },
      {
        id: "ma_8_11",
        type: "free_text",
        points: 1,
        text: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04122. \u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u0435 \u0430\u0431\u0441\u0446\u0438\u0441\u0441\u044B \u0442\u043E\u0447\u0435\u043A, \u0432 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0443\u0433\u043B\u043E\u0432\u043E\u0439 \u043A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442 \u043A\u0430\u0441\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0439 \u043A \u0433\u0440\u0430\u0444\u0438\u043A\u0443 \u0444\u0443\u043D\u043A\u0446\u0438\u0438 h(x) = 1 - 2sin^2 x \u0440\u0430\u0432\u0435\u043D 2.",
        html: "\u0417\u0430\u0434\u0430\u043D\u0438\u0435 \u04122. \u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u0435 \u0430\u0431\u0441\u0446\u0438\u0441\u0441\u044B \u0442\u043E\u0447\u0435\u043A, \u0432 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u0443\u0433\u043B\u043E\u0432\u043E\u0439 \u043A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442 \u043A\u0430\u0441\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0439 \u043A \u0433\u0440\u0430\u0444\u0438\u043A\u0443 \u0444\u0443\u043D\u043A\u0446\u0438\u0438 h(x) = 1 - 2sin<sup>2</sup> x \u0440\u0430\u0432\u0435\u043D 2."
      }
    ],
    logic: commonLogicQuestions
  }
};
