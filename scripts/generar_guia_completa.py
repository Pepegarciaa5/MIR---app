import json
import os
import re

AUDIT_JSON = "/tmp/tirada_audit.json"
with open(AUDIT_JSON, "r", encoding="utf-8") as f:
    audit_data = json.load(f)

meta = audit_data["meta"]
items = audit_data["items"]

print(f"Meta: {meta['asignatura']}, total={meta['metricas']['total']}, aciertos={meta['metricas']['aciertos']}, netas={meta['metricas']['netas']}")
print(f"Total audit items: {len(items)}")
