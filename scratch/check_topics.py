import re
with open('scratch/Code_Fixed.gs', 'r') as f:
    data = f.read()

count_with_topic = data.count('topic:')
count_without = data.count('ans:')
print(f"Has topic: {count_with_topic}")
print(f"Has ans: {count_without}")
