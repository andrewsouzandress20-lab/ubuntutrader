import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useEffect, useState } from 'react';
const ImpactColor = {
    High: '#ff4d4f',
    Medium: '#faad14',
    Low: '#52c41a',
};
const fetchEvents = async () => {
    try {
        const res = await fetch('/economic_events.json');
        if (!res.ok)
            return [];
        return await res.json();
    }
    catch {
        return [];
    }
};
const MqlCalendarWidget = () => {
    const [events, setEvents] = useState([]);
    const [selected, setSelected] = useState(null);
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
    return (_jsxs("div", { style: { width: '100%', minHeight: 400, background: '#0a0b16', color: '#fff', borderRadius: 12, padding: 16 }, children: [_jsx("h2", { style: { fontWeight: 700, fontSize: 18, marginBottom: 12 }, children: "Not\u00EDcias Econ\u00F4micas do Dia" }), loading ? (_jsx("div", { children: "Carregando eventos..." })) : filteredEvents.length === 0 ? (_jsx("div", { children: "Nenhuma not\u00EDcia econ\u00F4mica encontrada para hoje." })) : (_jsx("ul", { style: { listStyle: 'none', padding: 0 }, children: filteredEvents.map((ev, idx) => (_jsxs("li", { style: {
                        marginBottom: 10,
                        background: '#181a25',
                        borderRadius: 8,
                        padding: '10px 14px',
                        cursor: 'pointer',
                        boxShadow: '0 1px 4px #0002',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }, onClick: () => setSelected(ev), children: [_jsx("span", { children: _jsx("b", { children: ev.title || ev.event }) }), _jsx("span", { style: { fontWeight: 500, fontSize: 15 }, children: ev.published ? ev.published.slice(11, 16) : '' })] }, idx))) })), selected && (_jsx("div", { style: {
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
                }, onClick: () => setSelected(null), children: _jsxs("div", { style: {
                        background: '#181a25',
                        borderRadius: 12,
                        padding: 32,
                        minWidth: 320,
                        maxWidth: 400,
                        color: '#fff',
                        boxShadow: '0 2px 16px #0006',
                        position: 'relative',
                    }, onClick: e => e.stopPropagation(), children: [_jsx("button", { style: { position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }, onClick: () => setSelected(null), "aria-label": "Fechar", children: "\u00D7" }), _jsx("h3", { style: { fontWeight: 700, fontSize: 20, marginBottom: 8 }, children: selected.title || selected.event }), _jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("b", { children: "Publicado:" }), " ", selected.published, _jsx("br", {}), selected.link && _jsx("a", { href: selected.link, target: "_blank", rel: "noopener noreferrer", style: { color: '#4faaff' }, children: "Ver not\u00EDcia original" })] }), selected.summary && (_jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("b", { children: "Resumo:" }), " ", selected.summary] })), selected.description && (_jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("b", { children: "Descri\u00E7\u00E3o:" }), " ", selected.description] }))] }) }))] }));
};
export default MqlCalendarWidget;
