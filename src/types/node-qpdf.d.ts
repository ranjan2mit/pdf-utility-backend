declare module 'node-qpdf' {
    export function decrypt(
        inputFile: string,
        outputFile: string,
        password?: string
    ): void;
}
