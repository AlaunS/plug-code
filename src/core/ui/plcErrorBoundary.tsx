import { Component, ErrorInfo } from "react";

export class SlotErrorBoundary extends Component<{ id: string, fallback?: React.ReactNode, children: React.ReactNode }, { hasError: boolean }> {
    state = { hasError: false };

    static getDerivedStateFromError(_: Error) {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`[PlcLayout] Error in slot item '${this.props.id}':`, error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div style={{ padding: 4, color: 'red', fontSize: '0.8em', border: '1px dashed red' }}>
                    Error: {this.props.id}
                </div>
            );
        }
        return this.props.children;
    }
}