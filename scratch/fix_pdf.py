import re

with open("src/components/DiagnosticReportPdf.tsx", "r") as f:
    content = f.read()

colors = {
    "bg-white": "backgroundColor: '#ffffff'",
    "text-black": "color: '#000000'",
    "text-gray-500": "color: '#6b7280'",
    "bg-green-500": "backgroundColor: '#22c55e'",
    "bg-yellow-500": "backgroundColor: '#eab308'",
    "bg-red-500": "backgroundColor: '#ef4444'",
    "text-green-600": "color: '#16a34a'",
    "text-yellow-600": "color: '#ca8a04'",
    "text-red-600": "color: '#dc2626'",
    "text-blue-700": "color: '#1d4ed8'",
    "bg-blue-50": "backgroundColor: '#eff6ff'",
    "text-indigo-700": "color: '#4338ca'",
    "bg-indigo-50": "backgroundColor: '#eef2ff'",
    "text-purple-700": "color: '#7e22ce'",
    "bg-purple-50": "backgroundColor: '#faf5ff'",
    "text-teal-700": "color: '#0f766e'",
    "bg-teal-50": "backgroundColor: '#f0fdfa'",
    "text-gray-700": "color: '#374151'",
    "bg-gray-50": "backgroundColor: '#f9fafb'",
    "text-gray-900": "color: '#111827'",
    "text-blue-600": "color: '#2563eb'",
    "text-gray-600": "color: '#4b5563'",
    "text-slate-500": "color: '#64748b'",
    "text-slate-800": "color: '#1e293b'",
    "bg-slate-50": "backgroundColor: '#f8fafc'",
    "border-slate-100": "borderColor: '#f1f5f9'",
    "bg-gray-100": "backgroundColor: '#f3f4f6'",
    "text-blue-800": "color: '#1e40af'",
    "text-blue-900": "color: '#1e3a8a'",
    "text-gray-400": "color: '#9ca3af'",
    "border-gray-200": "borderColor: '#e5e7eb'",
    "border-gray-100": "borderColor: '#f3f4f6'",
    "bg-slate-100": "backgroundColor: '#f1f5f9'",
    "border-blue-100": "borderColor: '#dbeafe'",
    "text-gray-800": "color: '#1f2937'",
}

# We'll just manually rewrite the file since it's cleaner.
