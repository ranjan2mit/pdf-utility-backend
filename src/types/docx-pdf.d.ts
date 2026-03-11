declare module 'docx-pdf' {
    function docxConverter(inputPath: string, outputPath: string, callback: (err: any, result: any) => void): void;
    export default docxConverter;
}
