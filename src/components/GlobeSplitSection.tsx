import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { APP_STUDENTS } from "../data/appStudents";
import { StudentList } from "./StudentList";
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
      aria-label="Интерактивный глобус и список студентов"
      className="overflow-hidden"
    >
      <div className="mx-auto w-[90vw] max-w-[1800px] py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
          }}
          className="mb-10 md:mb-14"
        >
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-[#9F7AEA] backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C4B5FD]" />
            Карта выпускников
          </span>
          <h2 className="max-w-2xl font-heading text-3xl font-semibold leading-[1.05] tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Наши студенты учатся{" "}
            <span className="bg-gradient-to-r from-slate-900 to-[#9F7AEA] bg-clip-text text-transparent">
              по всему миру
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-base text-slate-500 sm:text-lg">
            Выбери студента — глобус покажет маршрут из Бишкека и раскроет карточку
            с подсказкой. После этого можно свободно вращать глобус — нажми на
            студента ещё раз, чтобы вернуть вид на маршрут.
          </p>
        </motion.div>

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[450px_1fr] xl:grid-cols-[550px_1fr] lg:items-start lg:gap-12">
          <div className="sticky top-24 z-10 w-full bg-transparent aspect-square md:aspect-auto md:h-[600px] lg:h-[700px]">
            <div className="relative h-full w-full bg-transparent">
              <StudentGlobe
                students={APP_STUDENTS}
                activeId={selectedStudentId}
                focusKey={focusKey}
                showDesktopTooltip={isDesktopTooltip}
                onSelect={handleSelect}
              />
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,white_70%)]"
                aria-hidden
              />
            </div>
          </div>

          <div className="w-full">
            <StudentList
              students={APP_STUDENTS}
              activeId={selectedStudentId}
              onSelect={handleSelect}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
