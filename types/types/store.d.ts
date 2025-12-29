export type Listener<S> = {
    key?: keyof S;
    callback: () => void;
};
