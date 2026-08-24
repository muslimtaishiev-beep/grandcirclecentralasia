import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { TenantLandingPage, SiteBlock } from '../../types/engine';
import { Star, CheckCircle, XCircle, Clock, MessageCircle, Shield } from 'lucide-react';

export interface Testimonial {
  id: string;
  tenantId: string;
  authorName: string;
  authorRole?: string;
  text: string;
  rating: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export default function TestimonialsManager({ tenantId }: { tenantId: string }) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  // NOTE: In a real app, clients would submit testimonials via a public form that writes to 'testimonials' collection with status 'pending'
  // For now, we mock fetching them and provide the moderation logic

  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const q = query(collection(db, 'testimonials'), where('tenantId', '==', tenantId));
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Testimonial);
        
        // Mock some data if empty for demo purposes
        if (data.length === 0) {
          const mockData: Testimonial[] = [
            { id: 't1', tenantId, authorName: 'Иван И.', authorRole: 'Клиент', text: 'Отличный сервис!', rating: 5, status: 'pending', createdAt: Date.now() },
            { id: 't2', tenantId, authorName: 'Анна М.', text: 'Все понравилось, форма заполнилась быстро.', rating: 4, status: 'approved', createdAt: Date.now() - 86400000 }
          ];
          setTestimonials(mockData);
        } else {
          setTestimonials(data.sort((a, b) => b.createdAt - a.createdAt));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTestimonials();
  }, [tenantId]);

  const updateStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    try {
      // 1. Update in local state
      setTestimonials(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
      
      // 2. Update in Firestore
      // await updateDoc(doc(db, 'testimonials', id), { status: newStatus });
      
      // 3. If approved, sync to Landing Page block
      if (newStatus === 'approved') {
        const approvedTestimonial = testimonials.find(t => t.id === id);
        if (approvedTestimonial) {
          const pageRef = doc(db, 'landing_pages', `${tenantId}_home`);
          const pageSnap = await getDoc(pageRef);
          
          if (pageSnap.exists()) {
            const pageData = pageSnap.data() as TenantLandingPage;
            // Find TESTIMONIALS block
            const updatedBlocks = pageData.blocks.map(block => {
              if (block.type === 'TESTIMONIALS') {
                const existingItems = block.config.items || [];
                // Avoid duplicates
                if (!existingItems.find(i => i.id === id)) {
                  return {
                    ...block,
                    config: {
                      ...block.config,
                      items: [...existingItems, {
                        id,
                        title: approvedTestimonial.authorName,
                        description: approvedTestimonial.text,
                        authorRole: approvedTestimonial.authorRole
                      }]
                    }
                  };
                }
              }
              return block;
            });

            await updateDoc(pageRef, { blocks: updatedBlocks, updatedAt: Date.now() });
            alert('Отзыв одобрен и добавлен на сайт!');
          }
        }
      }

    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Загрузка отзывов...</div>;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--border-color)]">
        <div className="p-3 bg-emerald-500/10 rounded-xl">
          <Shield className="w-6 h-6 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--text-main)]">Модерация Отзывов</h2>
          <p className="text-xs text-[var(--text-muted)]">Одобренные отзывы автоматически появятся на вашем лендинге</p>
        </div>
      </div>

      <div className="space-y-4">
        {testimonials.length === 0 ? (
          <div className="text-center py-8 text-slate-400">Нет отзывов</div>
        ) : (
          testimonials.map(t => (
            <div key={t.id} className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--text-main)]">{t.authorName}</span>
                    <span className="text-xs text-[var(--text-muted)]">{t.authorRole}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < t.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-[var(--text-muted)] mb-3">{t.text}</p>
                
                <div className="flex items-center gap-2">
                  {t.status === 'pending' && <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded"><Clock className="w-3 h-3"/> Ожидает проверки</span>}
                  {t.status === 'approved' && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded"><CheckCircle className="w-3 h-3"/> Опубликовано</span>}
                  {t.status === 'rejected' && <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-1 rounded"><XCircle className="w-3 h-3"/> Отклонено</span>}
                  
                  <span className="text-[10px] text-slate-500 ml-auto">{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {t.status === 'pending' && (
                <div className="flex flex-col gap-2 shrink-0">
                  <button 
                    onClick={() => updateStatus(t.id, 'approved')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg text-xs font-bold transition"
                  >
                    <CheckCircle className="w-3 h-3" /> Одобрить
                  </button>
                  <button 
                    onClick={() => updateStatus(t.id, 'rejected')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-bold transition"
                  >
                    <XCircle className="w-3 h-3" /> Отклонить
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
