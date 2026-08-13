import { ApiError } from '../utils/ApiError.js';

export const enforceReadOnlyImpersonation = (req, res, next) => {
  // Check if user is in impersonation mode
  if (req.user?.isImpersonating || req.user?.isReadOnly) {
    const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
      req.method.toUpperCase()
    );

    if (isWriteOperation) {
      throw new ApiError(
        403,
        'Read-Only Mode Active: You cannot modify data while impersonating a company.'
      );
    }
  }
  next();
};