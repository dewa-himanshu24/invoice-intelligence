import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';

export function useDocuments(statusFilter) {
  return useQuery({
    queryKey: ['documents', statusFilter],
    queryFn: async () => {
      const params = statusFilter ? { status: statusFilter } : {};
      const { data } = await client.get('/documents', { params });
      return data;
    },
    refetchInterval: (query) => {
      // Accessing data from query state
      const data = query?.state?.data;
      if (Array.isArray(data) && data.some(d => ['PENDING', 'PROCESSING'].includes(d.status))) {
        return 3000;
      }
      return false;
    }
  });
}

export function useDocument(id) {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: async () => {
      const { data } = await client.get(`/documents/${id}`);
      return data;
    },
    refetchInterval: (query) => {
      const data = query?.state?.data;
      if (data && ['PENDING', 'PROCESSING'].includes(data.status)) {
        return 2000;
      }
      return false;
    }
  });
}

export function useMetrics() {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const { data } = await client.get('/metrics');
      return data;
    },
    refetchInterval: 10000
  });
}

export function useUpdateCorrection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await client.patch(`/documents/${id}`, data);
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.id] });
    }
  });
}

export function useReprocess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await client.post(`/reprocess/${id}`);
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
    }
  });
}

export function useUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (files) => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('invoices', file);
      });
      const res = await client.post('/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    }
  });
}