import multer from 'multer';
import { AppError } from '../../utils/AppError.js';

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (allowed.has(file.mimetype)) callback(null, true);
    else callback(new AppError('UPLOAD_INVALID', 'Use a JPEG, PNG, or WebP image.', 400));
  },
});

export function uploadImage(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof AppError) {
      next(err);
      return;
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      next(new AppError('UPLOAD_INVALID', 'Image must be 2 MB or smaller.', 400));
      return;
    }
    next(new AppError('UPLOAD_INVALID', 'Could not read that image.', 400));
  });
}
