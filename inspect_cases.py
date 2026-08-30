import json

with open('P02_pharmacy_expiry_public.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Format Note:\n", data.get('format_note'))
print("Total Cases:", len(data.get('cases', [])))
for i, c in enumerate(data.get('cases', [])[:10]):
    print(f"[{i+1}] Case: {c['case_id']}, Today: {c.get('today')}, Items Count: {len(c.get('items', []))}, Mark Returned: {c.get('mark_returned', [])}")
    if i == 0:
        print("Sample Item:", c['items'][0])
