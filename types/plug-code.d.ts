import * as React from 'react';

// ==========================================
// Tipos Generales
// ==========================================

export declare type ObjectType = Record<string, any>;

export type Slot = () => React.ReactNode;
interface SlotRegistry {}
type SlotKey = keyof SlotRegistry | (string & {});

/**
 * Función para ejecutar lógica de negocio (Acciones).
 * Puede ser síncrona o asíncrona.
 */
export type CommandFn<T = any, R = any> = (payload: T) => Promise<R> | R;

/**
 * Función para transformar datos (Pipes).
 * Debe ser pura y síncrona preferiblemente.
 */
export type TransformerFn<D = any, C = any> = (data: D, context: C) => D;

// ==========================================
// Core: Store
// ==========================================

export declare class PlcStore<S extends ObjectType> {
    constructor(initial: S, debug: boolean);

    get<K extends keyof S>(key: K): S[K];
    getState(): S;
    set<K extends keyof S>(key: K, value: S[K]): void;

    /** Agrupa múltiples actualizaciones en un solo evento de notificación */
    batch(updater: (draft: S) => void): void;

    subscribe(listener: () => void): () => void;
    subscribe<K extends keyof S>(key: K, listener: () => void): () => void;
}

// ==========================================
// Core: API Principal
// ==========================================

export declare class PlcAPI<S extends ObjectType> {
    constructor(store: PlcStore<S>);

    // --- Configuración del Sistema (Fluent Interface) ---

    /**
     * Registra un módulo o feature en el sistema.
     * @param name Identificador único para debugging y prevención de duplicados.
     * @param setupFn Función de configuración donde registras slots, comandos, etc.
     */
    watch<T>(storeKey: string, selector: (data: any) => T, callback: (newValue: T, oldValue: T) => void): () => void
    override<K extends string>(key: K & "root", data: any, slot?: string): void
    // --- Gestión de UI (Slots & Rendering) ---
    
    redraw(key: string): void
    register(slot: string, node: (props?: any) => React.ReactNode): void;
    register<K extends string>(slot: string, node: (data: any, props?: any) => React.ReactNode, dependencyKey: K): void;

    /** Envuelve un slot existente (Decorador/Wrapper) */
    wrap(slot: string, fn: (next: () => React.ReactNode) => () => React.ReactNode): void;

    /** Agrega contenido después de un slot existente */
    after(slot: string, node: () => React.ReactNode): void;

    /** Renderiza el contenido de un slot */
    render(slot: string, contextData?: any): React.ReactNode;

    /** Fuerza la regeneración del caché de un slot */
    invalidate(slot?: string): void;

    // --- Gestión de Datos (Scope & State) ---

    createData<K extends string, T>(key: K, initialState: T): void;

    getData(key: string): any;
    
    derive<K extends string>(outputKey: K, dependencies: string[], calculator: () => any): void

    update(key: string | "root", updater: (draft: any) => void, slot?: string, triggerKey?: string): void;

    subscribe(listener: () => void): () => void;

    /**
     * Obtiene una interfaz tipada para interactuar con una parte específica del estado.
     */
    scope<T = any>(key: string): {
        get: () => T;
        update: (updater: (draft: T) => void, slot?: string, triggerKey?: string) => void;
        connect: <P = {}, R = any>(
            selector: (data: T, props: P) => R
        ) => (WrappedComponent: React.ComponentType<P & R>) => React.FC<P>;

        render: (slotName: SlotKey) => React.FC;
        receive: (context?: any) => any;
        root: PlcAPI<S>;
    };

    /** Conecta un componente a una parte del estado (HOC) */
    connect<State = any, OwnProps = {}, ResultProps = {}>(key: string, selector: (state: State, props: OwnProps) => ResultProps): (WrappedComponent: React.ComponentType<OwnProps & ResultProps>) => React.FC<OwnProps>;

    // --- Pipeline de Datos (Transforms) ---

    /**
     * Registra un transformador en un canal específico.
     * @param channel Nombre del canal (ej: 'calculo-impuestos')
     * @param id Identificador único del transformador
     * @param fn Función transformadora
     * @param priority Mayor número se ejecuta al final (default: 0)
     */
    send(channel: string, id: string, fn: TransformerFn, priority?: number): void;

    /**
     * Ejecuta la tubería de transformación para un canal.
     */
    receive(channel: string, initialData: any, context?: any): any;

    // --- Sistema de Comandos (Actions) ---

    /**
     * Registra una acción ejecutable.
     */
    registerCommand<T = any, R = any>(id: string, fn: CommandFn<T, R>): void;

    /**
     * Envuelve o intercepta un comando existente.
     */
    wrapCommand<T = any, R = any>(id: string, wrapper: (next: CommandFn<T, R>) => CommandFn<T, R>): void;

    /**
     * Ejecuta una acción registrada.
     * @returns Promesa con el resultado del comando.
     */
    execute<T = any, R = any>(id: string, payload?: T): Promise<R>;
}

// ==========================================
// Entry Point & Hooks
// ==========================================

export type SystemInstance<S extends ObjectType> = {
    api: PlcAPI<S>;
    /** Hook para seleccionar datos del store reactivamente */
    useSelector: <Result>(selector: (state: S) => Result) => Result;
};

/**
 * Inicializa el framework.
 * @param setupSystem Función callback para configurar las features iniciales.
 */
export declare function createPlugAndCode<S extends ObjectType>(
    setupSystem: (api: PlcAPI<S>) => void
): {
    useSystemPlc: (initialProps: S) => SystemInstance<S>;
    SystemPlcRoot: React.FC<{ api: PlcAPI<S>; children?: React.ReactNode }>;
};

/** Hook para acceder al contexto local dentro de un slot renderizado */
export declare function useScopeData<T>(): T;