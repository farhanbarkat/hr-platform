import dotenv from 'dotenv';
dotenv.config();

import app from '../app.js';
import connectDB  from './db/db.js';

const PORT = process.env.PORT || 5000;

// Database Connection then Server Init
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`⚙️  Server is running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Mongo DB connection failed !!!', err);
  });