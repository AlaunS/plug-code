import React, { useState, useEffect } from "react";
import { PlcAPI } from "../plcAPI";

const styles = {
    container: { position: 'fixed', bottom: 0, right: 0, width: '300px', height: '400px', background: '#222', color: '#fff', overflow: 'auto', zIndex: 9999, padding: '10px', borderTopLeftRadius: '8px', fontSize: '12px', fontFamily: 'monospace', boxShadow: '-2px -2px 10px rgba(0,0,0,0.5)' },
    header: { borderBottom: '1px solid #444', paddingBottom: '5px', marginBottom: '5px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' },
    section: { marginBottom: '10px' },
    label: { color: '#888', marginBottom: '2px' },
    item: { paddingLeft: '10px', color: '#4CAF50' },
    value: { color: '#ce9178' }
} as const;

export const PlcInspector: React.FC<{ api: PlcAPI }> = ({ api }) => {
    const [, setTick] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 9999, background: '#333', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
            >
                🛠️ PLC
            </button>
        );
    }

    const slotsMap = (api.layout as any).slots as Map<string, any[]>;
    const slots = Array.from(slotsMap.entries());

    const storeKeys = Array.from((api as any).store.storeData.keys());

    return (
        <div style={styles.container as any}>
            <div style={styles.header}>
                <span>PLC Framework Debugger</span>
                <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={styles.section}>
                <div style={styles.label}>ACTIVE SLOTS ({slots.length})</div>
                {slots.map(([name, items]) => (
                    <div key={name}>
                        <span style={{ color: '#569CD6' }}>{name}</span>
                        <span style={{ color: '#888' }}> ({items.length})</span>
                        {items.map((it: any) => (
                            <div key={it.id} style={styles.item}>
                                └ {it.id} <span style={{ fontSize: '0.9em', color: '#888' }}>(prio: {it.priority})</span>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div style={styles.section}>
                <div style={styles.label}>ROOT STORE KEYS</div>
                {storeKeys.map((k: any) => (
                    <div key={k} style={styles.item}>• {k}</div>
                ))}
            </div>
        </div>
    );
};