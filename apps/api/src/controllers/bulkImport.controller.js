import { parseCsvBuffer, processEmployeeRows } from '../services/employeeImport.service.js';
import { employeeImportQueue, jobResultsStore } from '../queues/employeeImport.queue.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const ASYNC_THRESHOLD = 100;

/**
 * @desc    Bulk Import Employees via CSV
 * @route   POST /api/v1/employees/bulk-import
 */
export const bulkImportEmployees = asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.user?.companyId;

  if (!companyId) {
    throw new ApiError(400, 'Company context is missing.');
  }

  if (!req.file || !req.file.buffer) {
    throw new ApiError(400, 'Please upload a valid CSV file.');
  }

  // 1. Parse CSV stream
  let rows = [];
  try {
    rows = await parseCsvBuffer(req.file.buffer);
  } catch (err) {
    throw new ApiError(400, `CSV Parsing Error: ${err.message}`);
  }

  if (!rows || rows.length === 0) {
    throw new ApiError(400, 'The uploaded CSV file is empty.');
  }

  // 2. Threshold Router: Async (BullMQ) if > 100 rows, else Synchronous
  if (rows.length > ASYNC_THRESHOLD) {
    let job;
    try {
      job = await employeeImportQueue.add('bulk-csv-job', {
        rows,
        companyId,
        uploadedBy: req.user._id,
      });

      jobResultsStore.set(job.id, { status: 'PROCESSING', totalRows: rows.length });

      return res.status(202).json(
        new ApiResponse(
          202,
          {
            jobId: job.id,
            isBackgroundJob: true,
            totalRows: rows.length,
            message: `Dataset exceeds ${ASYNC_THRESHOLD} rows. Processing queued in background.`,
          },
          'Import job scheduled successfully.'
        )
      );
    } catch (queueErr) {
      console.warn('Queue dispatch failed, falling back to synchronous execution:', queueErr.message);
    }
  }

  // 3. Synchronous Per-Row Execution (<= 100 rows)
  const report = await processEmployeeRows(rows, companyId);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        isBackgroundJob: false,
        summary: {
          totalRows: report.totalRows,
          successfulCount: report.successfulCount,
          failedCount: report.failedCount,
        },
        successful: report.successful,
        failed: report.failed,
      },
      `Bulk import completed. ${report.successfulCount} succeeded, ${report.failedCount} failed.`
    )
  );
});

/**
 * @desc    Poll Status of a Background Import Job
 * @route   GET /api/v1/employees/bulk-import/jobs/:jobId
 */
export const getImportJobStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const inMemoryResult = jobResultsStore.get(jobId);
  if (inMemoryResult) {
    return res.status(200).json(
      new ApiResponse(200, inMemoryResult, 'Job status retrieved.')
    );
  }

  const job = await employeeImportQueue.getJob(jobId);
  if (!job) {
    throw new ApiError(404, 'Import job not found.');
  }

  const state = await job.getState();
  const progress = job.progress;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        jobId: job.id,
        status: state.toUpperCase(),
        progress,
        result: job.returnvalue || null,
        failedReason: job.failedReason || null,
      },
      'Job status retrieved.'
    )
  );
});