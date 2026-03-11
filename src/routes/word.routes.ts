import { Router } from 'express';
const docxConverter = require('docx-pdf');
import fs from 'fs';
import path from 'path';

const router = Router();

router.post('/convert', (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).send({ error: 'Please upload a Word document' });
    }

    const inputFile = file.path;
    const outputFile = path.join(path.dirname(inputFile), `converted_${Date.now()}.pdf`);

    try {
        docxConverter(inputFile, outputFile, (err: any, result: any) => {
            if (err) {
                fs.unlink(inputFile, () => { });
                return res.status(500).send({ error: 'Failed to convert Word to PDF.' });
            }

            res.download(outputFile, (downloadErr) => {
                // Cleanup after sending file
                fs.unlink(inputFile, () => { });
                fs.unlink(outputFile, () => { });
            });
        });
    } catch (err) {
        fs.unlink(inputFile, () => { });
        res.status(500).send({ error: 'Unexpected error during conversion' });
    }
});

export default router;
