import React, { useEffect, useState } from 'react';

type EconomicEvent = {
  country: string;
  event: string;
  impact: string;
  date: string;
  time: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  description?: string;
  brTime: string;
};

const ImpactColor: Record<string, string> = {
  High: '#ff4d4f',
  Medium: '#faad14',
  Low: '#52c41a',
};

const fetchEvents = async (): Promise<EconomicEvent[]> => {
  try {
    const res = await fetch('/economic_events.json');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

const MqlCalendarWidget: React.FC = () => {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [selected, setSelected] = useState<EconomicEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents().then(evts => {
      setEvents(evts);
      setLoading(false);
    });
  }, []);

  // Mostra todas as notícias do dia
  const today = new Date().toISOString().slice(0, 10);
  const filteredEvents = events.filter(ev => {
    // RSS: published pode ser 'YYYY-MM-DD' ou 'YYYY-MM-DD HH:mm:ss'
    if (ev.published) {
      return ev.published.startsWith(today);
    }
    if (ev.date) {
      return ev.date.startsWith(today);
    }
    return false;
  });

  return (
    <div style={{ width: '100%', minHeight: 400, background: '#0a0b16', color: '#fff', borderRadius: 12, padding: 16 }}>
      <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Notícias Econômicas do Dia</h2>
      {loading ? (
        <div>Carregando eventos...</div>
      ) : filteredEvents.length === 0 ? (
        <div>Nenhuma notícia econômica encontrada para hoje.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {filteredEvents.map((ev, idx) => (
            <li
              key={idx}
              style={{
                marginBottom: 10,
                background: '#181a25',
                borderRadius: 8,
                padding: '10px 14px',
                cursor: 'pointer',
                boxShadow: '0 1px 4px #0002',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onClick={() => setSelected(ev)}
            >
              <span>
                <b>{ev.title || ev.event}</b>
              </span>
              <span style={{ fontWeight: 500, fontSize: 15 }}>{ev.published ? ev.published.slice(11, 16) : ''}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Pop-up de detalhes */}
      {selected && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{
              background: '#181a25',
              borderRadius: 12,
              padding: 32,
              minWidth: 320,
              maxWidth: 400,
              color: '#fff',
              boxShadow: '0 2px 16px #0006',
              position: 'relative',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}
              onClick={() => setSelected(null)}
              aria-label="Fechar"
            >×</button>
            <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>{selected.title || selected.event}</h3>
            <div style={{ marginBottom: 8 }}>
              <b>Publicado:</b> {selected.published}<br />
              {selected.link && <a href={selected.link} target="_blank" rel="noopener noreferrer" style={{ color: '#4faaff' }}>Ver notícia original</a>}
            </div>
            {selected.summary && (
              <div style={{ marginBottom: 8 }}><b>Resumo:</b> {selected.summary}</div>
            )}
            {selected.description && (
              <div style={{ marginBottom: 8 }}><b>Descrição:</b> {selected.description}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MqlCalendarWidget;