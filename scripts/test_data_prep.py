import json

with open("/tmp/tirada_audit.json") as f:
    data = json.load(f)

for it in data["items"]:
    q_num = it["orden"]
    is_ok = it["isCorrect"]
    just = it.get("justificacion", "")
    print(f"Q{q_num:02d}: isCorrect={is_ok}, hasJust={bool(just)}")
