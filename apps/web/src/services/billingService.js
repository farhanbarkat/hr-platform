import { apiClient } from '../lib/apiClient.js';

export const billingService = {
  getInvoices: async () => {
    const response = await apiClient.get('/super-admin/billing');
    return response.data?.data || response.data;
  },

  updateInvoiceStatus: async (invoiceId, status) => {
    const response = await apiClient.patch(`/super-admin/billing/${invoiceId}/status`, {
      status,
    });
    return response.data?.data || response.data;
  },

  getPlans: async () => {
    const response = await apiClient.get('/super-admin/plans');
    return response.data?.data || response.data;
  },
};

export default billingService;