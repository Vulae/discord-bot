


export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitUntil(epoch: number): Promise<void>;
export async function waitUntil(time: Date): Promise<void>;
export async function waitUntil(time: number | Date): Promise<void> {
    const delay = time.valueOf() - Date.now();
    return await wait(delay);
}


