import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './client';
import { 
  getTasksOptimizedAction, 
  getUsersMinimalAction, 
  getTaskCountsAction,
  updateTaskAction,
  deleteTaskAction,
  batchUpdateTasksAction
} from '@/app/actions';
import { Task } from '@/lib/types';

// Optimized tasks query with filtering and caching
export function useTasksOptimized(options?: {
  limit?: number;
  status?: string[];
  assignedTo?: string[];
  priority?: string[];
  fields?: string[];
}) {
  return useQuery({
    queryKey: queryKeys.tasks.list(options),
    queryFn: async () => {
      const result = await getTasksOptimizedAction(options);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for tasks
  });
}

// Minimal users query for dropdowns and assignments
export function useUsersMinimal() {
  return useQuery({
    queryKey: queryKeys.users.minimal(),
    queryFn: async () => {
      const result = await getUsersMinimalAction();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes for users (changes less frequently)
  });
}

// Task counts for dashboard stats
export function useTaskCounts() {
  return useQuery({
    queryKey: queryKeys.tasks.counts(),
    queryFn: async () => {
      const result = await getTaskCountsAction();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute for counts
  });
}

// Optimistic task update mutation
export function useUpdateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const result = await updateTaskAction(id, data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
      
      // Snapshot previous values
      const previousTasks = queryClient.getQueriesData({ queryKey: queryKeys.tasks.all });
      
      // Optimistically update all task queries
      queryClient.setQueriesData({ queryKey: queryKeys.tasks.all }, (old: any) => {
        if (!old) return old;
        return old.map((task: Task) => 
          task.id === id ? { ...task, ...data, updatedAt: new Date().toISOString() } : task
        );
      });
      
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        context.previousTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

// Optimistic task deletion
export function useDeleteTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteTaskAction(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
      
      const previousTasks = queryClient.getQueriesData({ queryKey: queryKeys.tasks.all });
      
      // Remove task optimistically
      queryClient.setQueriesData({ queryKey: queryKeys.tasks.all }, (old: any) => {
        if (!old) return old;
        return old.filter((task: Task) => task.id !== id);
      });
      
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        context.previousTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}

// Batch update tasks mutation
export function useBatchUpdateTasks() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: { id: string; data: Partial<Task> }[]) => {
      const result = await batchUpdateTasksAction(updates);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate all task queries after batch update
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
  });
}