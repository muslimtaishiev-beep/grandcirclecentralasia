import React, { useEffect, useState } from 'react';
import { Reorder } from 'framer-motion';

export default function Ordering({ question, value, onChange }: any) {
  const items = question.content?.items || [];
  const [localItems, setLocalItems] = useState(items);

  // Initialize value if empty
  useEffect(() => {
    if (!value && items.length > 0) {
      onChange(items);
    }
  }, []);

  // Update local state when value changes from outside (e.g. restoration)
  useEffect(() => {
    if (value && Array.isArray(value)) {
      setLocalItems(value);
    }
  }, [value]);

  const handleReorder = (newOrder: any[]) => {
    setLocalItems(newOrder);
    onChange(newOrder);
  };

  return (
    <div className="mt-4">
      <Reorder.Group axis="y" values={localItems} onReorder={handleReorder} className="space-y-3">
        {localItems.map((item: any) => (
          <Reorder.Item 
            key={item.id} 
            value={item}
            className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm cursor-grab active:cursor-grabbing flex items-center justify-between group"
          >
            <span className="font-medium text-slate-700">{item.text}</span>
            <span className="text-slate-400 group-hover:text-purple-500 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </span>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
}
