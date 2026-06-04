import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGroup, motion, type Variants } from "framer-motion";
import { MapPin, GraduationCap, Lightbulb, Route } from "lucide-react";
import { cn } from "../lib/utils";
import type { AppStudent } from "../data/appStudents";
import { distanceFromBishkek } from "../data/appStudents";

const SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };

const listGridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

function initialsFromName(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function StudentAvatar({ student, active, size = "md" }: { student: AppStudent; active: boolean; size?: "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const frameClass = cn(
    "shrink-0 rounded-full border-2 object-cover transition-colors duration-300",
    sizeClass,
    active ? "border-[#9F7AEA] bg-white" : "border-white/80 bg-slate-100"
  );

  if (!failed) {
    return (
      <img
        src={student.avatarUrl}
        alt=""
        onError={() => setFailed(true)}
        className={frameClass}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-sans text-sm font-bold transition-colors duration-300",
        sizeClass,
        active ? "bg-gradient-to-br from-[#9F7AEA] to-[#C4B5FD] text-white" : "bg-[#C4B5FD]/20 text-[#9F7AEA]"
      )}
    >
      {initialsFromName(student.name)}
    </div>
  );
}

function ActiveCardContent({ student }: { student: AppStudent }) {
  const km = distanceFromBishkek(student);
  return (
    <div className="relative z-10 flex flex-col md:flex-row items-start gap-6 w-full text-slate-800 text-[15px]">
      {/* Top Left: Avatar & University */}
      <div className="flex flex-col gap-4 w-full md:w-[260px] shrink-0">
        <div className="flex items-center gap-4">
          <StudentAvatar student={student} active={true} size="lg" />
          <span className="font-bold text-lg text-slate-800">{student.name}</span>
        </div>
        <div className="rounded-xl bg-white/60 backdrop-blur-md border border-slate-300 p-3 flex flex-col gap-1.5 shadow-sm">
          <span className="font-bold text-slate-800">{student.university}</span>
          <span className="text-slate-800 font-medium">~{km.toLocaleString("ru-RU")} км от Бишкека</span>
        </div>
      </div>

      {/* Right side: Full text */}
      <div className="flex-1 w-full border-t md:border-t-0 md:border-l border-slate-300 pt-5 md:pt-0 md:pl-6">
        <p className="leading-relaxed m-0 w-full break-words text-slate-800">
          {student.message}
          {student.tip && (
            <span className="block mt-4 font-bold text-slate-800">
              Совет: <span className="font-normal">{student.tip}</span>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function InactiveCardContent({ student }: { student: AppStudent }) {
  return (
    <div className="flex items-center gap-3 text-slate-800 text-[14px]">
      <StudentAvatar student={student} active={false} size="sm" />
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <span className="truncate font-bold text-slate-800">{student.name}</span>
        <span className="truncate text-slate-800 font-medium">{student.university}</span>
      </div>
    </div>
  );
}

function DesktopExpandingCard({ student, isActive, onSelect, cardRef }: { student: AppStudent; isActive: boolean; onSelect: (id: string) => void; cardRef: (el: HTMLDivElement | null) => void }) {
  return (
    <motion.div ref={cardRef} data-id={student.id} layout="position" animate={{ scale: isActive ? 1.0 : 1, opacity: isActive ? 1 : 0.86 }} transition={SPRING} className={cn("min-w-0 origin-center transition-all duration-300", isActive && "col-span-full order-first z-10")}>
      <motion.button
        type="button"
        onClick={() => onSelect(student.id)}
        whileTap={{ scale: 0.985 }}
        transition={SPRING}
        className={cn(
          "group/card relative w-full text-left transition-shadow duration-300 overflow-hidden",
          isActive ? "bg-[#F5F3FF] p-6 shadow-xl ring-2 ring-[#9F7AEA] rounded-2xl mb-4" : "bg-transparent py-1.5 px-2 hover:bg-slate-100/50 border border-transparent border-b-slate-200"
        )}
      >
        {isActive && (
          <div className="absolute inset-0 z-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(-45deg, #9F7AEA 0, #9F7AEA 2px, transparent 2px, transparent 12px)" }} />
        )}
        {isActive ? <ActiveCardContent student={student} /> : <InactiveCardContent student={student} />}
      </motion.button>
    </motion.div>
  );
}

const MOBILE_SLIDE_WIDTH = "w-[85vw] max-w-[420px] shrink-0 snap-center";

function MobileExpandingCard({ student, isActive, onSelect, cardRef }: { student: AppStudent; isActive: boolean; onSelect: (id: string) => void; cardRef: (el: HTMLDivElement | null) => void }) {
  return (
    <div ref={cardRef} data-id={student.id} className={MOBILE_SLIDE_WIDTH}>
      <motion.div animate={{ scale: isActive ? 1 : 0.96, opacity: isActive ? 1 : 0.72 }} transition={SPRING} className="w-full origin-center">
        <button
          type="button"
          onClick={() => onSelect(student.id)}
          className={cn(
            "group/card relative w-full text-left transition-shadow duration-300 rounded-2xl overflow-hidden",
            isActive ? "bg-[#F5F3FF] p-6 shadow-xl ring-2 ring-[#9F7AEA] z-10" : "bg-white/50 p-3 border border-slate-200/80"
          )}
        >
          {isActive && (
            <div className="absolute inset-0 z-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(-45deg, #9F7AEA 0, #9F7AEA 2px, transparent 2px, transparent 12px)" }} />
          )}
          {isActive ? <ActiveCardContent student={student} /> : <InactiveCardContent student={student} />}
        </button>
      </motion.div>
    </div>
  );
}

function MobileStudentCarousel({ students, activeId, onSelect }: { students: AppStudent[]; activeId: string | null; onSelect: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isProgrammaticScroll = useRef(false);
  const selectionFromScroll = useRef(false);
  const activeIndex = Math.max(0, students.findIndex((s) => s.id === activeId));

  const scrollToStudent = useCallback((id: string, smooth = true) => {
    const root = containerRef.current;
    const el = cardRefs.current[id];
    if (!root || !el) return;
    isProgrammaticScroll.current = true;
    const target = el.offsetLeft - (root.clientWidth - el.offsetWidth) / 2;
    root.scrollTo({ left: Math.max(0, target), behavior: smooth ? "smooth" : "auto" });
    window.setTimeout(() => { isProgrammaticScroll.current = false; }, smooth ? 520 : 0);
  }, []);

  const selectExternal = useCallback((id: string) => {
    selectionFromScroll.current = false;
    onSelect(id);
    scrollToStudent(id);
  }, [onSelect, scrollToStudent]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    let raf = 0;
    const handleScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (isProgrammaticScroll.current) return;
        const rootRect = root.getBoundingClientRect();
        const centerX = rootRect.left + rootRect.width / 2;
        let closestId: string | null = null;
        let closestDist = Infinity;
        for (const student of students) {
          const el = cardRefs.current[student.id];
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const cardCenter = rect.left + rect.width / 2;
          const dist = Math.abs(cardCenter - centerX);
          if (dist < closestDist) { closestDist = dist; closestId = student.id; }
        }
        if (closestId && closestId !== activeId) {
          selectionFromScroll.current = true;
          onSelect(closestId);
        }
      });
    };
    root.addEventListener("scroll", handleScroll, { passive: true });
    return () => { root.removeEventListener("scroll", handleScroll); cancelAnimationFrame(raf); };
  }, [students, activeId, onSelect]);

  useEffect(() => {
    if (!activeId || selectionFromScroll.current) { selectionFromScroll.current = false; return; }
    scrollToStudent(activeId);
  }, [activeId, scrollToStudent]);

  useEffect(() => {
    if (!activeId) return;
    const el = cardRefs.current[activeId];
    const root = containerRef.current;
    if (!el || !root) return;
    const recenter = () => {
      const target = el.offsetLeft - (root.clientWidth - el.offsetWidth) / 2;
      root.scrollTo({ left: Math.max(0, target), behavior: "auto" });
    };
    const ro = new ResizeObserver(() => requestAnimationFrame(recenter));
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeId]);

  return (
    <div className="md:hidden">
      <div ref={containerRef} className="flex items-start gap-0 overflow-x-auto overflow-y-visible overscroll-x-contain scroll-px-4 px-4 pb-2 snap-x snap-mandatory scrollbar-hide">
        {students.map((student) => (
          <MobileExpandingCard key={student.id} student={student} isActive={student.id === activeId} onSelect={selectExternal} cardRef={(el) => { cardRefs.current[student.id] = el; }} />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-3 px-4">
        <div className="flex items-center gap-1.5">
          {students.map((student, index) => {
            const isActive = student.id === activeId;
            return (
              <button key={student.id} type="button" aria-label={`Студент ${index + 1}: ${student.name}`} onClick={() => selectExternal(student.id)} className={cn("rounded-full transition-all duration-300", isActive ? "h-2 w-6 bg-[#9F7AEA]" : "h-2 w-2 bg-slate-300 hover:bg-[#C4B5FD]")} />
            );
          })}
        </div>
        <span className="font-sans text-xs tabular-nums text-slate-400">{activeIndex + 1}/{students.length}</span>
      </div>
    </div>
  );
}

function DesktopStudentGrid({ students, activeId, onSelect }: { students: AppStudent[]; activeId: string | null; onSelect: (id: string) => void }) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  useEffect(() => {
    if (!activeId) return;
    const el = cardRefs.current[activeId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeId]);

  return (
    <LayoutGroup id="student-desktop-grid">
      <motion.div variants={listGridVariants} initial={false} whileInView="show" viewport={{ once: false, amount: 0.2 }} className="hidden md:block w-full">
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-0 w-full items-start">
          {students.map((student) => (
            <DesktopExpandingCard key={student.id} student={student} isActive={student.id === activeId} onSelect={onSelect} cardRef={(el) => { cardRefs.current[student.id] = el; }} />
          ))}
        </div>
      </motion.div>
    </LayoutGroup>
  );
}

export function StudentList({ students, activeId, onSelect }: { students: AppStudent[]; activeId: string | null; onSelect: (id: string) => void }) {
  return (
    <>
      <MobileStudentCarousel students={students} activeId={activeId} onSelect={onSelect} />
      <DesktopStudentGrid students={students} activeId={activeId} onSelect={onSelect} />
    </>
  );
}
