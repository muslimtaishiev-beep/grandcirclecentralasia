import React, { useMemo, useCallback } from "react";
import QuestionFactory from "./QuestionFactory";

/**
 * Один вопрос экзамена — мемоизированная обёртка.
 *
 * Раньше все вопросы теста перерисовывались при каждом изменении любого
 * ответа: обработчик создавался заново для каждой карточки, а внутри рендера
 * ещё и вызывался JSON.parse. Вместе с прокторингом, который перерисовывал
 * страницу 60 раз в секунду, это делало ввод невозможным — каретка прыгала,
 * символы терялись.
 *
 * Теперь перерисовывается только та карточка, чей ответ изменился.
 */
interface Props {
  question: any;
  /** Сырое значение из общего словаря ответов (строка или примитив). */
  rawValue: any;
  onAnswer: (id: string, value: any) => void;
}

function ExamQuestionInner({ question, rawValue, onAnswer }: Props) {
  // Разбор JSON только при изменении значения, а не на каждый рендер.
  const value = useMemo(() => {
    if ((question.type === "MATRIX_GRID" || question.type === "ORDERING") && typeof rawValue === "string") {
      try { return JSON.parse(rawValue); } catch { return rawValue; }
    }
    return rawValue;
  }, [question.type, rawValue]);

  const handleChange = useCallback((val: any) => onAnswer(question.id, val), [onAnswer, question.id]);

  return <QuestionFactory question={question} value={value} onChange={handleChange} />;
}

export default React.memo(ExamQuestionInner);
