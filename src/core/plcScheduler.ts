
// ----------------------
// Scheduler
// ----------------------
export type Priority = "HIGH" | "MED" | "LOW";
export class Scheduler {
    private isFlushing: boolean = false;
    private queue: Map<Priority, Set<() => void>> = new Map([
        ["HIGH", new Set()],
        ["MED", new Set()],
        ["LOW", new Set()],
    ]);

    schedule(fn: () => void, priority: Priority = "MED") {
        this.queue.get(priority)!.add(fn);

        if (!this.isFlushing) {
            if (priority === 'HIGH') {
                this.flush();
            } else {
                queueMicrotask(() => this.flush());
            }
        }
    }

    private flush() {
        this.isFlushing = true;
        for (const level of ["HIGH", "MED", "LOW"] as Priority[]) {
            const set = this.queue.get(level)!;
            set.forEach(fn => fn());
            set.clear();
        }

        this.isFlushing = false;
    }
}