
import * as child_process from "child_process";



export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitUntil(epoch: number): Promise<void>;
export async function waitUntil(time: Date): Promise<void>;
export async function waitUntil(time: number | Date): Promise<void> {
    const delay = time.valueOf() - Date.now();
    return await wait(delay);
}



/**
 * Executes the command and returns the output.
 * @param command 
 * @returns 
 */
export async function execute(command: string, options: child_process.ExecOptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        child_process.exec(command, options, (stderr, stdout) => {
            if(stderr) {
                return reject(stderr);
            }
            return resolve(stdout);
        });
    });
}


