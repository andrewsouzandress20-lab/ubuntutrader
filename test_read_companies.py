import json

with open('public/companies_snapshot.json', encoding='utf-8') as f:
    data = json.load(f)

for company in data['indices']['US30']:
    print(f"{company['symbol']} | Change: {company['change']} | Status: {company['status']}")
