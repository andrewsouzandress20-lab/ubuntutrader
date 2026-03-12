import csv
from typing import List, Dict

def read_dow30_breadth(csv_path: str) -> Dict[str, int]:
    """
    Lê o arquivo dow30_tradingview.csv e retorna a contagem de empresas em alta (advancing)
    e em baixa (declining) com base no título da página (exemplo simplificado).
    """
    advancing = 0
    declining = 0
    with open(csv_path, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            title = row.get('title', '').lower()
            # Exemplo: se o título contém 'alta' ou 'up', conta como advancing
            # se contém 'baixa' ou 'down', conta como declining
            if 'alta' in title or 'up' in title:
                advancing += 1
            elif 'baixa' in title or 'down' in title:
                declining += 1
            # Caso não detecte, pode ignorar ou tratar como neutro
    return {'advancing': advancing, 'declining': declining}

# Exemplo de uso:
if __name__ == "__main__":
    breadth = read_dow30_breadth('dow30_tradingview.csv')
    print(f"Empresas em alta: {breadth['advancing']}")
    print(f"Empresas em baixa: {breadth['declining']}")
    # Aqui você pode integrar com o envio do sinal para o Telegram
    # Exemplo:
    # sendTelegramSignal(assetSymbol='US30', signal='COMPRA', strength='FORTE', score=10, context={
    #     'breadthAdv': breadth['advancing'],
    #     'breadthDec': breadth['declining']
    # })
