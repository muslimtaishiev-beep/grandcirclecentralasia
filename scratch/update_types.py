with open('src/types.ts', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# Update Subject
content = re.sub(
    r'export type Subject = "russian" \| "math" \| "logic";',
    'export type Subject = "russian" | "math" | "logic" | "english";',
    content
)

# Update Question type
content = re.sub(
    r'type: "multiple_choice" \| "free_text" \| "two_step" \| "logic_matrix" \| "dropdown_multiple" \| "drag_and_drop" \| "number_input" \| "clickable_text" \| "inline_inputs";',
    'type: "multiple_choice" | "free_text" | "two_step" | "logic_matrix" | "dropdown_multiple" | "drag_and_drop" | "number_input" | "clickable_text" | "inline_inputs" | "inline_dropdown";',
    content
)

# Add instruction and inlineOptions to Question
old_question_props = r'  options\?: string\[\]; // Only for multiple_choice and two_step'
new_question_props = r'''  instruction?: string; // Optional task instruction
  options?: string[]; // Only for multiple_choice and two_step
  inlineOptions?: string[]; // For inline_dropdown shared options'''
content = re.sub(old_question_props, new_question_props, content)

# Add english to TestData
old_test_data = r'''export interface TestData \{
  grade: number;
  russian: Question\[\];
  math: Question\[\];
  logic: Question\[\];
\}'''
new_test_data = r'''export interface TestData {
  grade: number;
  russian: Question[];
  math: Question[];
  logic: Question[];
  english?: Question[];
}'''
content = re.sub(old_test_data, new_test_data, content)

with open('src/types.ts', 'w', encoding='utf-8') as f:
    f.write(content)

