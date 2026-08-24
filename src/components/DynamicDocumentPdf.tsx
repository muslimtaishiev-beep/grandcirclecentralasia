import React from 'react';
import DOMPurify from 'dompurify';
import { DocumentTemplate } from '../types/engine';

interface DynamicDocumentPdfProps {
  template: DocumentTemplate;
  data: Record<string, any>;
}

export const DynamicDocumentPdf: React.FC<DynamicDocumentPdfProps> = ({ template, data }) => {
  // Replace {{variables}} with actual data
  let finalHtml = template.htmlContent || '';
  
  if (template.variables) {
    template.variables.forEach(v => {
      // Create a global regex for {{variableKey}} or {{ variableKey }}
      const regex = new RegExp(`\\{\\{\\s*${v.key}\\s*\\}\\}`, 'g');
      const replacement = data[v.key] !== undefined ? String(data[v.key]) : '';
      finalHtml = finalHtml.replace(regex, replacement);
    });
  }

  // Sanitize for security
  const safeHtml = DOMPurify.sanitize(finalHtml, {
    ADD_TAGS: ['style'], // Allow inline styles in templates
  });

  // Dimensions based on layout
  const width = template.layout === 'A4-landscape' ? '297mm' : '210mm';
  const height = template.layout === 'A4-landscape' ? '210mm' : '297mm';

  return (
    <div
      className="bg-white text-slate-900 relative"
      style={{
        width,
        height,
        padding: '15mm', // default padding, they can override in HTML via negative margins if needed
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#000000',
      }}
    >
      <div 
        dangerouslySetInnerHTML={{ __html: safeHtml }} 
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};
