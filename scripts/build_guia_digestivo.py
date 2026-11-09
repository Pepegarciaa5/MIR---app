import json
import re
import os

AUDIT_JSON = "/tmp/tirada_audit.json"
ESQUELETO_MD = "/tmp/guia_tirada_esqueleto.md"
TARGET_MD = "/Users/hola/.gemini/antigravity/brain/df973222-bcf7-4175-b84e-ecd4db914359/guia_tirada_digestivo_20261103.md"

with open(AUDIT_JSON, "r", encoding="utf-8") as f:
    audit_data = json.load(f)

items = {it["orden"]: it for it in audit_data["items"]}

print(f"Loaded {len(items)} items from audit JSON")
