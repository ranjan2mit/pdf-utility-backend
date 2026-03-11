import { Router } from 'express';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
const qpdf = require('node-qpdf');
qpdf.command = '/opt/homebrew/bin/qpdf';

const router = Router();

// Unlock PDF
router.post('/unlock', async (req, res) => {
    const password = req.body.password;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
        return res.status(400).send({ error: 'No file uploaded' });
    }

    const inputFile = files[0].path;
    const outputFile = path.join(path.dirname(inputFile), `unlocked_${files[0].filename}`);

    try {
        // Attempt decryption
        const outputStream = qpdf.decrypt(inputFile, password, (err: any) => {
            if (err) {
                console.error("qpdf decryption error:", err);
                fs.unlink(inputFile, () => { });
                // Only send response if headers haven't been sent yet
                if (!res.headersSent) {
                    res.status(500).send({ error: 'Failed to unlock PDF. Is the password correct?' });
                }
            }
        });

        if (outputStream) {
            const writeStream = fs.createWriteStream(outputFile);
            outputStream.pipe(writeStream);

            writeStream.on('finish', () => {
                if (!res.headersSent) {
                    res.download(outputFile, (err) => {
                        // Cleanup files after download
                        fs.unlink(inputFile, () => { });
                        fs.unlink(outputFile, () => { });
                    });
                }
            });

            writeStream.on('error', (err) => {
                console.error("Write stream error:", err);
                fs.unlink(inputFile, () => { });
                if (!res.headersSent) {
                    res.status(500).send({ error: 'Failed to write decrypted PDF.' });
                }
            });
        }
    } catch (error) {
        fs.unlink(inputFile, () => { });
        if (!res.headersSent) {
            res.status(500).send({ error: 'Failed to unlock PDF.' });
        }
    }
});

// Merge PDFs
router.post('/merge', async (req, res) => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length < 2) {
        return res.status(400).send({ error: 'Please upload at least two PDFs to merge' });
    }

    try {
        const mergedPdf = await PDFDocument.create();

        for (const file of files) {
            const pdfBytes = fs.readFileSync(file.path);
            // ignoreEncryption allows loading PDFs that have any encryption metadata
            // (even if not password-protected) without throwing
            const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const mergedPdfBytes = await mergedPdf.save();
        const outputPath = path.join(path.dirname(files[0].path), `merged_${Date.now()}.pdf`);

        fs.writeFileSync(outputPath, mergedPdfBytes);

        res.download(outputPath, `merged_${Date.now()}.pdf`, (err) => {
            // Cleanup
            files.forEach(f => fs.unlink(f.path, () => { }));
            fs.unlink(outputPath, () => { });
        });
    } catch (error: any) {
        console.error('Merge PDF error:', error?.message || error);
        files.forEach(f => fs.unlink(f.path, () => { }));
        if (!res.headersSent) {
            res.status(500).send({ error: 'Failed to merge PDFs: ' + (error?.message || 'Unknown error') });
        }
    }
});

// Compress PDF
router.post('/compress', async (req, res) => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
        return res.status(400).send({ error: 'No file uploaded' });
    }

    // Compression level 1 (fastest/least) → 9 (slowest/best). Default 9.
    const level = Math.min(9, Math.max(1, parseInt(req.body.level || '9', 10)));

    const inputFile = files[0].path;
    const outputFile = path.join(path.dirname(inputFile), `compressed_${Date.now()}.pdf`);
    const qpdfBin = '/opt/homebrew/bin/qpdf';

    try {
        // Use qpdf to actually recompress all flate streams at the requested level.
        // --compress-streams=y   : compress any uncompressed streams
        // --recompress-flate     : also recompress already-compressed streams
        // --compression-level=N  : zlib deflate level (1–9)
        const { execSync } = require('child_process');
        execSync(
            `"${qpdfBin}" --compress-streams=y --recompress-flate --compression-level=${level} "${inputFile}" "${outputFile}"`,
            { timeout: 60000 }
        );

        res.download(outputFile, 'compressed.pdf', () => {
            fs.unlink(inputFile, () => { });
            fs.unlink(outputFile, () => { });
        });
    } catch (error: any) {
        fs.unlink(inputFile, () => { });
        if (fs.existsSync(outputFile)) fs.unlink(outputFile, () => { });
        if (!res.headersSent) {
            res.status(500).send({ error: 'Failed to compress PDF. ' + (error?.message || '') });
        }
    }
});

export default router;


