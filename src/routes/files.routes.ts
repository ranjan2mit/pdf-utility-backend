import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * DELETE /api/files/cleanup
 * Deletes all files currently sitting in the uploads directory.
 * This lets the frontend explicitly purge any orphaned uploads or
 * processed files that were not automatically removed after download.
 */
router.delete('/cleanup', (req, res) => {
    const uploadsDir = path.join(__dirname, '../../uploads');

    try {
        if (!fs.existsSync(uploadsDir)) {
            return res.json({ message: 'Uploads directory is already empty.', deleted: 0 });
        }

        const files = fs.readdirSync(uploadsDir);
        let deleted = 0;

        files.forEach(file => {
            const filePath = path.join(uploadsDir, file);
            try {
                fs.unlinkSync(filePath);
                deleted++;
            } catch (e) {
                // Skip files that can't be deleted (e.g. directories, locked files)
            }
        });

        res.json({ message: `Successfully deleted ${deleted} file(s) from the server.`, deleted });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clean up server files.' });
    }
});

export default router;
