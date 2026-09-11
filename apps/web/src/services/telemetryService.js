import { apiClient } from '../lib/apiClient.js';

export const telemetryService = {
  getOverview: async () => {
    const response = await apiClient.get('/super-admin/telemetry');
    return response.data?.data || response.data;
  },

  getAuditLogs: async (limit = 10) => {
    const response = await apiClient.get(`/super-admin/audit?limit=${limit}`);
    return response.data?.data || response.data;
  },

  getTenants: async () => {
    const response = await apiClient.get('/super-admin/tenants');
    return response.data?.data || response.data;
  },

  toggleTenantStatus: async (companyId, isActive) => {
    const response = await apiClient.patch(`/super-admin/tenants/${companyId}/status`, {
      isActive,
    });
    return response.data?.data || response.data;
  },
};

export default telemetryService;