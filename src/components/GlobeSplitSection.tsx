import { useCallback, useEffect, useState } from "react";
import { APP_STUDENTS } from "../data/appStudents";
import { StudentGlobe } from "./StudentGlobe";

function useIsDesktopTooltip() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 640px)");
    const sync = () => setIsDesktop(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}

export function GlobeSplitSection() {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    APP_STUDENTS[0]?.id ?? null,
  );
  const [focusKey, setFocusKey] = useState(0);
  const isDesktopTooltip = useIsDesktopTooltip();

  const handleSelect = useCallback((id: string) => {
    setSelectedStudentId(id);
    setFocusKey((k) => k + 1);
  }, []);

  return (
    <section
      id="globe-students"
      aria-label="Интерактивный 3D глобус"
      className="overflow-hidden bg-transparent py-12 md:py-20"
    >
      <div className="w-full flex items-center justify-center min-h-[500px] md:min-h-[650px]">
        <StudentGlobe
          students={APP_STUDENTS}
          activeId={selectedStudentId}
          focusKey={focusKey}
          onSelect={handleSelect}
        />
      </div>
    </section>
  );
}
