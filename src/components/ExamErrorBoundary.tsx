import React from "react";

interface Props {
  children: React.ReactNode;
  shortId?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches a render crash anywhere inside the exam.
 *
 * Without this, any thrown error unmounts the whole React tree and the student
 * is left staring at a blank grey page mid-exam, with no way back and no idea
 * whether their answers survived. Answers are mirrored to localStorage on every
 * change, so they almost always have — the problem was purely that nothing told
 * the student that, or offered them a way to continue.
 *
 * The fallback deliberately does NOT clear stored answers: recovering the exam
 * matters far more than tidying up after the bug.
 */
export default class ExamErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Exam] render crash:", error, info.componentStack);
    // Report it so a crash that only happens on a student's device still
    // reaches the audit log. Never allowed to throw in turn.
    try {
      fetch("/api/exams/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          event: "client_error",
          shortId: this.props.shortId
            || (() => { try { return sessionStorage.getItem("shortId") || localStorage.getItem("persist_shortId"); } catch (e) { return null; } })()
            || "unknown",
          detail: `${error.name}: ${error.message}`.slice(0, 300),
        }),
      }).catch(() => {});
    } catch (e) { /* reporting must never mask the original failure */ }
  }

  render() {
    if (!this.state.error) return this.props.children;

    // Read the id from storage rather than props: the crash may have happened
    // before Testing ever passed one down, and this code is the only thing the
    // manager can use to find the student's interrupted session.
    let shortId = this.props.shortId;
    if (!shortId) {
      try {
        shortId = sessionStorage.getItem("shortId")
          || localStorage.getItem("persist_shortId")
          || undefined;
      } catch (e) { /* storage can be unavailable in private mode */ }
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            ⚠
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Страница дала сбой</h2>
          <p className="text-slate-600 mb-2">
            Ваши ответы сохранены на этом устройстве. Нажмите «Продолжить тест» —
            вы вернётесь туда же, где остановились.
          </p>
          <p className="text-xs text-slate-400 mb-6 font-mono break-words">
            {this.state.error.message}
          </p>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg hover:from-blue-700 hover:to-indigo-700 transition mb-3"
          >
            Продолжить тест
          </button>

          {shortId && (
            <p className="text-sm text-slate-500 border-t pt-4">
              Если не помогло, назовите менеджеру этот код:{" "}
              <span className="font-mono font-bold text-slate-800">{shortId}</span>
            </p>
          )}
        </div>
      </div>
    );
  }
}
