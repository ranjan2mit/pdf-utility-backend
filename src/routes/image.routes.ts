import { Router } from 'express';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

const router = Router();

// Compress single image
router.post('/compress', async (req, res) => {
    const files = req.files as Express.Multer.File[];
    const file = files && files.length > 0 ? files[0] : null;
    // expects a quality parameter between 1 and 100
    const quality = parseInt(req.body.quality || '80', 10);

    if (!file) {
        return res.status(400).send({ error: 'Please upload an image' });
    }

    const inputFile = file.path;
    const outputFile = path.join(path.dirname(inputFile), `compressed_${Date.now()}.webp`);

    try {
        await sharp(inputFile)
            .webp({ quality: quality })
            .toFile(outputFile);

        res.download(outputFile, (err) => {
            fs.unlink(inputFile, () => { });
            fs.unlink(outputFile, () => { });
        });
    } catch (error) {
        fs.unlink(inputFile, () => { });
        res.status(500).send({ error: 'Failed to compress image' });
    }
});

// Merge multiple images into a single PDF
router.post('/merge', async (req, res) => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length < 2) {
        return res.status(400).send({ error: 'Please upload at least two images to merge' });
    }

    const outputFile = path.join(path.dirname(files[0].path), `merged_images_${Date.now()}.pdf`);

    try {
        const pdfDoc = await PDFDocument.create();

        for (const file of files) {
            // Convert each image to JPEG using sharp for consistent embedding
            const jpegBuffer = await sharp(file.path)
                .jpeg({ quality: 90 })
                .toBuffer();

            const jpgImage = await pdfDoc.embedJpg(jpegBuffer);
            const { width, height } = jpgImage.scale(1);

            // Add a page sized to the image
            const page = pdfDoc.addPage([width, height]);
            page.drawImage(jpgImage, { x: 0, y: 0, width, height });
        }

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputFile, pdfBytes);

        res.download(outputFile, 'merged_images.pdf', (err) => {
            files.forEach(f => fs.unlink(f.path, () => { }));
            fs.unlink(outputFile, () => { });
        });
    } catch (error) {
        files.forEach(f => fs.unlink(f.path, () => { }));
        if (!res.headersSent) {
            res.status(500).send({ error: 'Failed to merge images' });
        }
    }
});

export default router;
