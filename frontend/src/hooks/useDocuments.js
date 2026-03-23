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
      const data = query?.state?.data;
      // Faster polling if something is processing, slower otherwise
      if (Array.isArray(data) && data.some(d => ['PENDING', 'PROCESSING'].includes(d.status))) {
        return 2000;
      }
      return false; // Smart Polling: Pause completely to save network requests
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
      return false; // Smart Polling: Pause completely if finished
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
    refetchInterval: (query) => {
      // If there are pending docs, refresh metrics more often
      return 15000;
    }
  });
}

export function useUpdateCorrection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await client.patch(`/documents/${id}`, { correctedData: data });
      return res.data;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['documents', id] });
      const previousDoc = queryClient.getQueryData(['documents', id]);
      
      queryClient.setQueryData(['documents', id], (old) => {
        if (!old) return old;
        return {
          ...old,
          extraction: {
            ...old.extraction,
            corrected_data: data // Optimistic UI Update instantly applied!
          }
        };
      });

      return { previousDoc };
    },
    onError: (err, { id }, context) => {
      queryClient.setQueryData(['documents', id], context.previousDoc);
    },
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
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
      // Force immediate poll
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
      const res = await client.post('/documents', formData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    }
  });
}