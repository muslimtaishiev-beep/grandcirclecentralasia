import React, { useState, useEffect } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Plus, GripVertical, Type, BarChart2, MousePointerClick, LayoutTemplate, Trash2, Save, Image, Minus, Loader2, Sparkles } from "lucide-react";

type BlockType = "text" | "stats" | "button" | "image" | "divider";

interface ScreenBlock {
  id: string;
  type: BlockType;
  content: any;
}

export default function WorkspaceBuilder() {
  const { activeTenant } = useOutletContext<any>();
  const { orgId } = useParams();
  const { user } = useAuth();
  
  const [screens, setScreens] = useState<any[]>([]);
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);
  
  const [blocks, setBlocks] = useState<ScreenBlock[]>([]);
  const [screenName, setScreenName] = useState("Новый Экран");
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Subscribe to Firestore /app_screens
  useEffect(() => {
    const tenantId = orgId || activeTenant?.id;
    if (!tenantId) {
      setScreens([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "app_screens"),
      where("tenantId", "==", tenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: any[] = [];
      snapshot.forEach(d => docs.push({ id: d.id, ...d.data() }));
      setScreens(docs);
      setLoading(false);

      if (docs.length > 0 && !activeScreenId) {
        setActiveScreenId(docs[0].id);
        setScreenName(docs[0].name || "Новый Экран");
        setBlocks(docs[0].blocks || []);
      }
    });

    return () => unsubscribe();
  }, [orgId, activeTenant]);

  const addBlock = (type: BlockType) => {
    const newBlock: ScreenBlock = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      content: type === "text" ? { text: "Заголовок секции" } 
             : type === "stats" ? { label: "Выручка", value: "$45,000" }
             : type === "image" ? { url: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600", alt: "Превью" }
             : type === "divider" ? { style: "solid" }
             : { label: "Перейти к сделке", url: "#" }
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const updateBlock = (id: string, newContent: any) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, content: newContent } : b));
  };

  const saveScreen = async () => {
    const tenantId = orgId || activeTenant?.id;
    if (!tenantId) return;

    setIsSaving(true);
    try {
      if (activeScreenId) {
        const docRef = doc(db, "app_screens", activeScreenId);
        await updateDoc(docRef, {
          name: screenName,
          blocks,
          updatedAt: serverTimestamp()
        });
      } else {
        const docRef = await addDoc(collection(db, "app_screens"), {
          tenantId,
          name: screenName,
          blocks,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setActiveScreenId(docRef.id);
      }
      alert("Экран успешно сохранён!");
    } catch (e: any) {
      console.error(e);
      alert("Ошибка сохранения экрана: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteScreen = async (id: string) => {
    if (!confirm("Удалить этот кастомный экран?")) return;
    await deleteDoc(doc(db, "app_screens", id));
    if (activeScreenId === id) {
      setActiveScreenId(null);
      setScreenName("Новый Экран");
      setBlocks([]);
    }
  };

  return (
    <div className="flex h-full gap-6 text-[var(--text-main)]">
      
      {/* Sidebar: Screens List */}
      <div className="w-64 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl p-4 flex flex-col shrink-0">
        <div className="flex items-center gap-2 text-xs font-bold font-mono text-[var(--text-muted)] uppercase tracking-wider mb-4">
          <Sparkles className="w-4 h-4 text-[var(--accent)]" />
          No-Code Screens
        </div>

        <div className="space-y-2 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : screens.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--text-muted)]">
              Нет сохранённых экранов.
            </div>
          ) : (
            screens.map(s => (
              <div key={s.id} className="flex items-center group justify-between">
                <button 
                  onClick={() => { setActiveScreenId(s.id); setScreenName(s.name); setBlocks(s.blocks || []); }}
                  className={`flex-1 text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${activeScreenId === s.id ? 'bg-[var(--accent)] text-white font-bold' : 'text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  <LayoutTemplate className="w-4 h-4" />
                  <span className="truncate">{s.name}</span>
                </button>
                <button
                  onClick={() => handleDeleteScreen(s.id)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                  title="Удалить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <button 
          onClick={() => { setActiveScreenId(null); setScreenName("Новый Экран"); setBlocks([]); }}
          className="mt-4 flex items-center justify-center gap-2 text-xs font-bold bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 p-2.5 rounded-xl transition cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Создать новый экран
        </button>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-xs">
        
        {/* Canvas Header */}
        <div className="h-16 border-b border-[var(--border-color)] bg-[var(--bg-panel)] px-6 flex items-center justify-between">
          <input 
            type="text" 
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
            className="bg-transparent text-lg font-bold focus:outline-none border-b border-transparent focus:border-[var(--accent)] text-[var(--text-main)] px-1 transition"
          />
          <button 
            onClick={saveScreen}
            disabled={isSaving}
            className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Сохранение..." : "Сохранить экран"}
          </button>
        </div>

        {/* Builder Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[var(--bg-app)]">
          {blocks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] font-mono text-sm border-2 border-dashed border-[var(--border-color)] rounded-2xl p-12">
              <LayoutTemplate className="w-12 h-12 mb-3 text-[var(--text-muted)]/50" />
              <p className="font-sans font-bold mb-1 text-[var(--text-main)]">Экран пуст</p>
              <p className="font-sans text-xs">Добавьте блоки с помощью нижней панели инструментов.</p>
            </div>
          ) : (
            blocks.map((block) => (
              <div key={block.id} className="group relative bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 hover:border-[var(--accent)] transition-all shadow-xs">
                
                <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 cursor-grab text-[var(--text-muted)]">
                  <GripVertical className="w-4 h-4" />
                </div>
                
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex gap-2">
                  <button onClick={() => removeBlock(block.id)} className="p-1.5 text-[var(--text-muted)] hover:text-red-500 rounded-lg hover:bg-red-500/10 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="pl-6">
                  {block.type === "text" && (
                    <input 
                      type="text"
                      value={block.content.text}
                      onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                      className="w-full bg-transparent text-lg font-semibold focus:outline-none text-[var(--text-main)]"
                    />
                  )}

                  {block.type === "stats" && (
                    <div className="flex gap-4">
                      <input 
                        type="text"
                        value={block.content.label}
                        onChange={(e) => updateBlock(block.id, { ...block.content, label: e.target.value })}
                        className="bg-transparent border-b border-[var(--border-color)] text-xs text-[var(--text-muted)] uppercase font-mono w-1/3 focus:outline-none text-[var(--text-main)]"
                        placeholder="Название метрики"
                      />
                      <input 
                        type="text"
                        value={block.content.value}
                        onChange={(e) => updateBlock(block.id, { ...block.content, value: e.target.value })}
                        className="bg-transparent border-b border-[var(--border-color)] text-2xl font-bold w-1/3 focus:outline-none text-[var(--accent)]"
                        placeholder="Значение"
                      />
                    </div>
                  )}

                  {block.type === "button" && (
                    <div className="flex gap-4 items-center">
                      <input 
                        type="text"
                        value={block.content.label}
                        onChange={(e) => updateBlock(block.id, { ...block.content, label: e.target.value })}
                        className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-bold focus:outline-none w-48"
                      />
                      <input 
                        type="text"
                        value={block.content.url}
                        onChange={(e) => updateBlock(block.id, { ...block.content, url: e.target.value })}
                        className="bg-transparent border-b border-[var(--border-color)] text-xs text-[var(--text-muted)] focus:outline-none flex-1"
                        placeholder="https://..."
                      />
                    </div>
                  )}

                  {block.type === "image" && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={block.content.url}
                        onChange={(e) => updateBlock(block.id, { ...block.content, url: e.target.value })}
                        className="w-full bg-transparent border-b border-[var(--border-color)] text-xs text-[var(--text-muted)] focus:outline-none"
                        placeholder="URL изображения"
                      />
                      {block.content.url && (
                        <img src={block.content.url} alt={block.content.alt || 'Preview'} className="max-h-48 rounded-xl object-cover border border-[var(--border-color)]" />
                      )}
                    </div>
                  )}

                  {block.type === "divider" && (
                    <div className="py-2">
                      <div className="w-full h-px bg-[var(--border-color)]"></div>
                    </div>
                  )}
                </div>

              </div>
            ))
          )}
        </div>

        {/* Bottom Toolbar Palette */}
        <div className="h-20 bg-[var(--bg-panel)] border-t border-[var(--border-color)] p-4 flex items-center justify-center gap-4 shrink-0">
          <span className="text-xs font-mono uppercase text-[var(--text-muted)] mr-2 font-bold">Добавить блок:</span>
          
          <button onClick={() => addBlock("text")} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--accent)]/10 text-[var(--text-main)] border border-[var(--border-color)] rounded-xl text-xs font-medium transition cursor-pointer">
            <Type className="w-4 h-4 text-blue-500" /> Текст
          </button>
          
          <button onClick={() => addBlock("stats")} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--accent)]/10 text-[var(--text-main)] border border-[var(--border-color)] rounded-xl text-xs font-medium transition cursor-pointer">
            <BarChart2 className="w-4 h-4 text-emerald-500" /> Метрика
          </button>

          <button onClick={() => addBlock("button")} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--accent)]/10 text-[var(--text-main)] border border-[var(--border-color)] rounded-xl text-xs font-medium transition cursor-pointer">
            <MousePointerClick className="w-4 h-4 text-purple-500" /> Кнопка
          </button>

          <button onClick={() => addBlock("image")} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--accent)]/10 text-[var(--text-main)] border border-[var(--border-color)] rounded-xl text-xs font-medium transition cursor-pointer">
            <Image className="w-4 h-4 text-orange-500" /> Картинка
          </button>

          <button onClick={() => addBlock("divider")} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--accent)]/10 text-[var(--text-main)] border border-[var(--border-color)] rounded-xl text-xs font-medium transition cursor-pointer">
            <Minus className="w-4 h-4 text-slate-400" /> Разделитель
          </button>
        </div>

      </div>
    </div>
  );
}
