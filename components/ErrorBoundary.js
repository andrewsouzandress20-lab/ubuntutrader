import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        // Você pode logar o erro em um serviço externo aqui
        console.error('ErrorBoundary capturou um erro:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (_jsxs("div", { style: { color: 'red', padding: 32, fontFamily: 'monospace' }, children: [_jsx("h1", { children: "Ocorreu um erro na aplica\u00E7\u00E3o!" }), _jsx("pre", { children: String(this.state.error) })] }));
        }
        return this.props.children;
    }
}
