export function shallowEqual(objA: any, objB: any): boolean {
    if (Object.is(objA, objB)) return true;

    if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) {
        return false;
    }

    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) return false;

    for (let i = 0; i < keysA.length; i++) {
        const key = keysA[i];
        if (!Object.prototype.hasOwnProperty.call(objB, key) || !Object.is(objA[key], objB[key])) {
            return false;
        }
    }

    return true;
}

export function deepEqual(a: any, b: any): boolean {
    if (Object.is(a, b)) return true;

    if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
        return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }

    return true;
}