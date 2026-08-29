import dotenv from 'dotenv';
dotenv.config();
import { initTaxCertificateWorker } from './workers/taxCertificate.worker.js';

import app from '../app.js';
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
import connectDB  from './db/db.js';

const PORT = process.env.PORT || 5000;

// Start BullMQ Worker
initTaxCertificateWorker();

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