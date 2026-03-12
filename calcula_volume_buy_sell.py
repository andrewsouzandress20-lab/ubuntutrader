import json

with open('companies_snapshot.json', encoding='utf-8') as f:
    data = json.load(f)

buy_volume = 0
sell_volume = 0

total_empresas = len(data['indices']['US30'])

for company in data['indices']['US30']:
    vol = company.get('volume', 0)
    change = company.get('change', 0)
    if change > 0:
        buy_volume += vol
    elif change < 0:
        sell_volume += vol

print(f"Total de empresas: {total_empresas}")
print(f"Volume comprador: {buy_volume}")
print(f"Volume vendedor: {sell_volume}")
if buy_volume + sell_volume > 0:
    buy_pct = 100*buy_volume/(buy_volume+sell_volume)
    sell_pct = 100*sell_volume/(buy_volume+sell_volume)
    print(f"% Buy: {buy_pct:.2f}%")
    print(f"% Sell: {sell_pct:.2f}%")
    if buy_pct > sell_pct:
        print(f"\n📊 Resumo:\n- 📈 Volume comprador dominante ({buy_pct:.2f}% compra)")
    elif sell_pct > buy_pct:
        print(f"\n📊 Resumo:\n- 📉 Volume vendedor dominante ({sell_pct:.2f}% venda)")
    else:
        print(f"\n📊 Resumo:\n- Volume equilibrado entre compra e venda")
else:
    print("Sem volume suficiente para cálculo de percentuais.")
