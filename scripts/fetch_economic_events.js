
const API_KEY = 'iUTx9ZrK6o2P6D2poMf0cRWDNjEEKErw';
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const dateStr = `${yyyy}-${mm}-${dd}`;
const url = `https://financialmodelingprep.com/stable/economic-calendar?from=${dateStr}&to=${dateStr}&apikey=${API_KEY}`;

async function fetchEvents() {
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('Resposta bruta da API:', text);
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error('Resposta inesperada da API:', text);
      throw new Error('Resposta da API não é JSON. Veja acima.');
    }
    if (!Array.isArray(data)) {
      console.error('A resposta da API não é um array:', data);
      return;
    }
    const events = data.map(ev => ({
      country: ev.country,
      event: ev.event,
      impact: ev.impact,
      date: ev.date,
      time: ev.time,
      actual: ev.actual,
      forecast: ev.forecast,
      previous: ev.previous,
      description: ev.event || '',
      brTime: ev.time // já vem no horário local
    }));
    const filePath = path.join(__dirname, '../public/economic_events.json');
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2));
    console.log(`Salvo ${events.length} eventos em economic_events.json`);
  } catch (err) {
    console.error('Erro ao buscar eventos:', err.message);
  }
}

fetchEvents();
