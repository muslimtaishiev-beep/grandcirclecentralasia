import json

def process_sentence(sentence, correct_comma_words):
    # correct_comma_words is a list of words AFTER WHICH a comma should be placed.
    words = sentence.split()
    segments = []
    correct_ids = []
    
    for i, word in enumerate(words):
        segments.append({"text": word})
        
        # Add a comma placeholder after every word except the last one
        if i < len(words) - 1:
            id_str = str(i + 1)
            segments.append({
                "text": " [,] ",
                "id": id_str,
                "isTarget": True
            })
            
            # Check if this space should have a comma
            # Clean the word from punctuation for comparison
            clean_word = "".join(c for c in word if c.isalnum())
            if clean_word in correct_comma_words:
                correct_ids.append(id_str)
                
    return segments, correct_ids

# ru_9 (Grade 8)
# "Фонарь, одиноко стоявший на земле, осветил издающее непонятные звуки создание."
# Commas after "Фонарь" and "земле"
ru_9_text = "Фонарь одиноко стоявший на земле осветил издающее непонятные звуки создание."
ru_9_segs, ru_9_ans = process_sentence(ru_9_text, ["Фонарь", "земле"])

# ru_10 (Grade 8)
# "Проходя по залам музеев, люди останавливаются у прекрасных картин художника И. Репина, восхищаясь совершенством живописи."
# Commas after "музеев", "Репина"
ru_10_text = "Проходя по залам музеев люди останавливаются у прекрасных картин художника И. Репина восхищаясь совершенством живописи."
ru_10_segs, ru_10_ans = process_sentence(ru_10_text, ["музеев", "Репина"])

# ru_7_new (Grade 9)
# "Ветер, дующий с моря, принес прохладу."
# Commas after "Ветер", "моря"
ru_7_text = "Ветер дующий с моря принес прохладу."
ru_7_segs, ru_7_ans = process_sentence(ru_7_text, ["Ветер", "моря"])

print("RU_9_SEGS = ", json.dumps(ru_9_segs, ensure_ascii=False, indent=2))
print("RU_9_ANS = ", ru_9_ans)

print("RU_10_SEGS = ", json.dumps(ru_10_segs, ensure_ascii=False, indent=2))
print("RU_10_ANS = ", ru_10_ans)

print("RU_7_SEGS = ", json.dumps(ru_7_segs, ensure_ascii=False, indent=2))
print("RU_7_ANS = ", ru_7_ans)
