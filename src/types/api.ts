
export type transformerType = {
    id: string,
    priority: number,
    fn: (data: any, context: any) => any
}

export type CommandFn<T = any, R = any> = (payload: T) => Promise<R> | R;