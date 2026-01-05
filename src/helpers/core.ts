export const isEqual = (a: any, b: any) => {
    if (a === b) return true;
    if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every(k => a[k] === b[k]);
    }
    return false;
}