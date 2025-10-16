import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './client';
import { 
  getTasksOptimizedAction, 
  getAllTasksAction,
  getUsersMinimalAction, 
  getTaskCountsAction,
  updateTaskAction,
  deleteTaskAction,
  batchUpdateTasksAction,
  createTaskAction
} from '@/app/actions';
import { Task } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

// Optimized tasks query with filtering and caching
export function useTasksOptimized(options?: {
  limit?: number;
  status?: string[];
  assignedTo?: string[];
  priority?: string[];
  fields?: string[];
  filterMode?: 'created' | 'assigned' | 'both';
}) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.tasks.list({ ...options, currentUserId: user?.id }),
    queryFn: async () => {
      const result = await getTasksOptimizedAction({ ...options, currentUserId: user?.id });
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for tasks
    enabled: !!user?.id, // Only run query when user is authenticated
  });
}

// Hook for fetching tasks created by the current user
export function useAllTasks(options?: {
  limit?: number;
  status?: string[];
  assignedTo?: string[];
  priority?: string[];
  fields?: string[];
}) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.tasks.list({ ...options, currentUserId: user?.id, userTasks: true }),
    queryFn: async () => {
      const result = await getAllTasksAction({ ...options, currentUserId: user?.id });
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for tasks
    enabled: !!user?.id, // Only run query when user is authenticated
  });
}

// Hook specifically for tasks created by the current user
export function useCreatedTasks(options?: {
  limit?: number;
  status?: string[];
  priority?: string[];
  fields?: string[];
}) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.tasks.list({ ...options, currentUserId: user?.id, filterMode: 'created' }),
    queryFn: async () => {
      const result = await getTasksOptimizedAction({ 
        ...options, 
        currentUserId: user?.id, 
        filterMode: 'created' 
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for tasks
    enabled: !!user?.id, // Only run query when user is authenticated
  });
}

// Hook specifically for tasks assigned to the current user
export function useAssignedTasks(options?: {
  limit?: number;
  status?: string[];
  priority?: string[];
  fields?: string[];
}) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.tasks.list({ ...options, currentUserId: user?.id, filterMode: 'assigned' }),
    queryFn: async () => {
      const result = await getTasksOptimizedAction({ 
        ...options, 
        currentUserId: user?.id, 
        filterMode: 'assigned' 
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes for tasks
    enabled: !!user?.id, // Only run query when user is authenticated
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
  const { user } = useAuth();
  
  return useQuery({
    queryKey: queryKeys.tasks.counts(user?.id),
    queryFn: async () => {
      const result = await getTaskCountsAction(user?.id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    staleTime: 1 * 60 * 1000, // 1 minute for counts
    enabled: !!user?.id, // Only run query when user is authenticated
  });
}

// Optimistic task update mutation
export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const result = await updateTaskAction(id, data, user?.id);
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
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteTaskAction(id, user?.id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onMutate: async (id) => {
      // Cancel all task-related queries to prevent race conditions
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all });
      
      // Get all current task query data for rollback
      const previousTasks = queryClient.getQueriesData({ queryKey: queryKeys.tasks.all });
      
      // Remove task optimistically from all task queries
      queryClient.setQueriesData({ queryKey: queryKeys.tasks.all }, (old: any) => {
        if (!old) return old;
        return Array.isArray(old) ? old.filter((task: Task) => task.id !== id) : old;
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
      // Invalidate all task-related queries to ensure UI consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.counts() });
    },
  });
}

// Create task mutation
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      const result = await createTaskAction(taskData, user?.id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate all task queries after creation
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.counts() });
    },
  });
}

// Batch update tasks mutation
export function useBatchUpdateTasks() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (updates: { id: string; data: Partial<Task> }[]) => {
      // Add currentUserId to each update for authorization
      const updatesWithUserId = updates.map(update => ({
        ...update,
        currentUserId: user?.id
      }));
      const result = await batchUpdateTasksAction(updatesWithUserId);
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