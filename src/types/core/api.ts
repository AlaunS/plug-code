
export type CommandFn<Payload = any, Result = any> = (payload?: Payload) => Promise<Result> | Result;
export type CommandWrapper<P = any, R = any> = (next: CommandFn<P, R>) => CommandFn<P, R>;
export type transformerType<T = any> = {
    id: string;
    priority: number;
    fn: (data: T, context: any) => T;
};
