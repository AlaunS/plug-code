import { transformerType } from "../types/core/api";

export class PlcPipeline {
    private transforms: Map<string, transformerType[]> = new Map();

    registerTransform(channel: string, t: transformerType) {
        if (!this.transforms.has(channel))
            this.transforms.set(channel, []);

        const list = this.transforms.get(channel)!;
        const idx = list.findIndex(x => x.id === t.id);

        if (idx >= 0)
            list[idx] = t;
        else list.push(t);

        list.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    }

    removeTransform(channel: string, id: string) {
        const list = this.transforms.get(channel);
        if (!list)
            return;

        const idx = list.findIndex(x => x.id === id);
        if (idx >= 0)
            list.splice(idx, 1);
    }

    getTransforms(channel: string): transformerType[] {
        return this.transforms.get(channel) || []
    }

    compilePipeline(channel: string) {
        const list = this.getTransforms(channel);
        return async (input: any, ctx: any) => {
            let data = input;
            for (const t of list) {
                data = await t.fn(data, ctx);
            }
            return data;
        }
    }
}