import React, { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { useCollaboration } from '../../../lib/useCollaboration';
import { useAuth } from '../../../contexts/AuthContext';
import { useParams, Link } from 'react-router-dom';
import { Bold, Italic, Strikethrough, Heading1, Heading2, List, ListOrdered, Undo, Redo, ChevronLeft, Loader2, Save } from 'lucide-react';

const colors = ['#f56565', '#ed8936', '#ecc94b', '#48bb78', '#38b2ac', '#4299e1', '#667eea', '#9f7aea', '#ed64a6'];
const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];

function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  const toggleBtn = (active: boolean) => 
    `p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition ${active ? 'bg-black/10 dark:bg-white/10 text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`;

  return (
    <div className="flex items-center gap-1 p-2 bg-[var(--bg-surface)] border-b border-[var(--border-color)] overflow-x-auto">
      <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={toggleBtn(false)}><Undo className="w-4 h-4" /></button>
      <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={toggleBtn(false)}><Redo className="w-4 h-4" /></button>
      <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={toggleBtn(editor.isActive('heading', { level: 1 }))}><Heading1 className="w-4 h-4" /></button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={toggleBtn(editor.isActive('heading', { level: 2 }))}><Heading2 className="w-4 h-4" /></button>
      <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={toggleBtn(editor.isActive('bold'))}><Bold className="w-4 h-4" /></button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={toggleBtn(editor.isActive('italic'))}><Italic className="w-4 h-4" /></button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={toggleBtn(editor.isActive('strike'))}><Strikethrough className="w-4 h-4" /></button>
      <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={toggleBtn(editor.isActive('bulletList'))}><List className="w-4 h-4" /></button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={toggleBtn(editor.isActive('orderedList'))}><ListOrdered className="w-4 h-4" /></button>
    </div>
  );
}

export default function DocumentEditor() {
  const { orgId, docId } = useParams();
  const { user } = useAuth();
  
  // Need a consistent color for the session
  const [userColor] = useState(getRandomColor());

  const { ydoc, provider, ready } = useCollaboration(docId!, {
    id: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'Unknown',
    color: userColor
  });

  const editor = useEditor({
    extensions: ready && ydoc && provider ? [
      StarterKit, // disable default history to let Yjs handle it
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: user.displayName || user.email?.split('@')[0] || 'Unknown',
          color: userColor,
        },
      }),
    ] : [],
    content: '',
    editable: true,
  }, [ready, ydoc, provider]); // Re-initialize when ready

  return (
    <div className="flex flex-col h-full bg-[var(--bg-app)]">
      
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 bg-[var(--bg-surface)] border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-3">
          <Link to={`/workspace/${orgId}/docs`} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="font-medium text-[var(--text-main)]">Документ</div>
        </div>
        <div className="flex items-center gap-3">
          {!ready && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Loader2 className="w-3 h-3 animate-spin" /> Подключение...
            </div>
          )}
          {ready && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <Save className="w-3 h-3" /> Автосохранение
            </div>
          )}
          <button className="bg-[var(--accent)] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition">Поделиться</button>
        </div>
      </div>

      <EditorToolbar editor={editor} />

      {/* Editor Canvas */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center">
        {!ready ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
          </div>
        ) : (
          <div className="w-full max-w-4xl bg-[var(--bg-surface)] min-h-[1056px] shadow-sm border border-[var(--border-color)] p-12 lg:p-20 tiptap-wrapper">
            <style>{`
              .tiptap-wrapper .ProseMirror {
                outline: none;
                min-height: 500px;
                color: var(--text-main);
              }
              .tiptap-wrapper .ProseMirror p { margin-bottom: 1em; line-height: 1.6; }
              .tiptap-wrapper .ProseMirror h1 { font-size: 2em; font-weight: bold; margin-bottom: 0.5em; line-height: 1.2; }
              .tiptap-wrapper .ProseMirror h2 { font-size: 1.5em; font-weight: bold; margin-top: 1em; margin-bottom: 0.5em; }
              .tiptap-wrapper .ProseMirror ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; }
              .tiptap-wrapper .ProseMirror ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1em; }
              /* Collaboration Cursors */
              .collaboration-cursor__caret {
                border-left: 2px solid #0D0D0D;
                border-right: 2px solid #0D0D0D;
                margin-left: -2px;
                margin-right: -2px;
                pointer-events: none;
                position: relative;
                word-break: normal;
              }
              .collaboration-cursor__label {
                border-radius: 3px 3px 3px 0;
                color: #FFF;
                font-size: 12px;
                font-style: normal;
                font-weight: 600;
                left: -1px;
                line-height: normal;
                padding: 0.1rem 0.3rem;
                position: absolute;
                top: -1.4em;
                user-select: none;
                white-space: nowrap;
              }
            `}</style>
            <EditorContent editor={editor} />
          </div>
        )}
      </div>

    </div>
  );
}
