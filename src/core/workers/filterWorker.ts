// ===================================================================
// filterWorker.ts - CREATE THIS FILE IN YOUR PROJECT ROOT OR /workers
// ===================================================================

// Worker code that runs in background thread
const workerCode = `
// Worker receives: { data, props, filter, matcher, caseSensitive, startIdx, endIdx }
self.onmessage = function(e) {
    const { data, props, filter, matcher, caseSensitive, startIdx, endIdx, workerId } = e.data;
    
    const normalizedFilter = caseSensitive ? filter : filter.toLowerCase();
    const results = [];
    
    // Build matcher function
    const matchFn = (() => {
        if (matcher === 'exact') {
            return caseSensitive
                ? (val) => val === normalizedFilter
                : (val) => val.toLowerCase() === normalizedFilter;
        }
        if (matcher === 'startsWith') {
            return caseSensitive
                ? (val) => val.startsWith(normalizedFilter)
                : (val) => val.toLowerCase().startsWith(normalizedFilter);
        }
        // Default: includes
        return caseSensitive
            ? (val) => val.includes(normalizedFilter)
            : (val) => val.toLowerCase().includes(normalizedFilter);
    })();
    
    // Process chunk
    for (let i = startIdx; i < endIdx; i++) {
        const item = data[i];
        
        // Check if any prop matches
        for (const prop of props) {
            const value = item[prop];
            if (value != null && matchFn(String(value))) {
                results.push(i);
                break;
            }
        }
    }
    
    // Send results back
    self.postMessage({
        workerId,
        results,
        startIdx,
        endIdx,
        processed: endIdx - startIdx
    });
};
`;

// Create blob URL for worker
const blob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(blob);

// ===================================================================
// Worker Pool Manager
// ===================================================================

export class FilterWorkerPool {
    private workers: Worker[] = [];
    private availableWorkers: Set<number> = new Set();
    private taskQueue: Array<{
        data: any[];
        props: string[];
        filter: string;
        matcher: string;
        caseSensitive: boolean;
        startIdx: number;
        endIdx: number;
        resolve: (results: number[]) => void;
        reject: (error: Error) => void;
    }> = [];

    constructor(private poolSize: number = navigator.hardwareConcurrency || 4) {
        this.initializePool();
    }

    private initializePool() {
        for (let i = 0; i < this.poolSize; i++) {
            try {
                const worker = new Worker(workerUrl);
                this.workers.push(worker);
                this.availableWorkers.add(i);

                worker.onmessage = (e) => this.handleWorkerMessage(i, e);
                worker.onerror = (err) => this.handleWorkerError(i, err);
            } catch (err) {
                console.warn(`[FilterWorker] Failed to create worker \${i}:~`, err);
            }
        }

        console.debug(`[FilterWorker] Pool initialized with \${this.workers.length} workers`);
    }

    private handleWorkerMessage(workerId: number, event: MessageEvent) {
        const { results } = event.data;

        // Mark worker as available
        this.availableWorkers.add(workerId);

        // Process next task if any
        this.processNextTask();

        // Find and resolve the task (we'll enhance this)
        // For now, this is a simplified version
    }

    private handleWorkerError(workerId: number, error: ErrorEvent) {
        console.error(`[FilterWorker] Worker \${workerId} error:`, error);
        this.availableWorkers.add(workerId);
        this.processNextTask();
    }

    private processNextTask() {
        if (this.taskQueue.length === 0) return;
        if (this.availableWorkers.size === 0) return;

        const workerId = Array.from(this.availableWorkers)[0];
        this.availableWorkers.delete(workerId);

        const task = this.taskQueue.shift()!;
        const worker = this.workers[workerId];

        // Setup one-time listener for this specific task
        const handler = (e: MessageEvent) => {
            if (e.data.workerId === workerId) {
                worker.removeEventListener('message', handler);
                this.availableWorkers.add(workerId);
                task.resolve(e.data.results);
                this.processNextTask();
            }
        };

        worker.addEventListener('message', handler);

        worker.postMessage({
            workerId,
            data: task.data,
            props: task.props,
            filter: task.filter,
            matcher: task.matcher,
            caseSensitive: task.caseSensitive,
            startIdx: task.startIdx,
            endIdx: task.endIdx
        });
    }

    async executeTask(
        data: any[],
        props: string[],
        filter: string,
        matcher: string,
        caseSensitive: boolean,
        startIdx: number,
        endIdx: number
    ): Promise<number[]> {
        return new Promise((resolve, reject) => {
            this.taskQueue.push({
                data,
                props,
                filter,
                matcher,
                caseSensitive,
                startIdx,
                endIdx,
                resolve,
                reject
            });

            this.processNextTask();
        });
    }

    terminate() {
        this.workers.forEach(w => w.terminate());
        this.workers = [];
        this.availableWorkers.clear();
        this.taskQueue = [];
    }
}

// ===================================================================
// Singleton instance
// ===================================================================

let globalWorkerPool: FilterWorkerPool | null = null;

export function getWorkerPool(): FilterWorkerPool {
    if (!globalWorkerPool) {
        globalWorkerPool = new FilterWorkerPool();
    }
    return globalWorkerPool;
}

export function terminateWorkerPool() {
    if (globalWorkerPool) {
        globalWorkerPool.terminate();
        globalWorkerPool = null;
    }
}