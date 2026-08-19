import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

// Memory storage for fast streaming parsing
const storage = multer.memoryStorage();

const csvFileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'text/csv' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.originalname.toLowerCase().endsWith('.csv')
  ) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Invalid file type. Only CSV files are allowed.'), false);
  }
};

export const uploadCsv = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});