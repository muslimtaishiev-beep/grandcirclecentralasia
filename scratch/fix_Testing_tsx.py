with open('src/pages/Testing.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace:
# <span className="text-slate-700">{formatMathText(opt)}</span>
# with:
# {q.optionsHtml && q.optionsHtml[i] ? (
#   <span className="text-slate-700" dangerouslySetInnerHTML={{__html: q.optionsHtml[i]}} />
# ) : (
#   <span className="text-slate-700">{formatMathText(opt)}</span>
# )}

# Wait, `q.options?.map(opt => (` does not have `i` in Testing.tsx!
# Let's check how the map is declared in Testing.tsx.
