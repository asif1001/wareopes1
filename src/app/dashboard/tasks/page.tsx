"use client"

import { useState, useCallback } from "react"
import { ListFilter, PlusCircle, Calendar, Clock, BarChart3, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { Task, TaskStatus, TaskPriority, User, UserRole } from "@/lib/types"

// Import our new components
import { TaskCreationDialog } from "@/components/tasks/task-creation-dialog"
import { TaskModificationDialog } from "@/components/tasks/task-modification-dialog"
import { TaskDetailsDialog } from "@/components/tasks/task-details-dialog"
import { TaskSearchFilter } from "@/components/tasks/task-search-filter"
import { TimeManagementPanel } from "@/components/tasks/time-management-panel"
import { TaskStatusBadge } from "@/components/tasks/task-status-badge"
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge"
import { format } from "date-fns"

// Import React Query hooks for optimized data fetching
import { 
  useTasksOptimized, 
  useUsersMinimal, 
  useTaskCounts,
  useUpdateTask,
  useDeleteTask,
  useBatchUpdateTasks
} from "@/lib/react-query/hooks"

export default function TasksPage() {
  const [selectedTab, setSelectedTab] = useState("tasks")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isModifyDialogOpen, setIsModifyDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  
  // Client-side filters for instant filtering without server requests
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const [assignedToFilter, setAssignedToFilter] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  // Use React Query hooks for optimized data fetching with caching
  const { 
    data: tasks = [], 
    isLoading: tasksLoading, 
    error: tasksError,
    refetch: refetchTasks
  } = useTasksOptimized({
    limit: 100, // Pagination - load first 100 tasks
    status: statusFilter.length > 0 ? statusFilter : undefined,
    priority: priorityFilter.length > 0 ? priorityFilter : undefined,
    assignedTo: assignedToFilter.length > 0 ? assignedToFilter : undefined,
    fields: ['id', 'title', 'description', 'status', 'priority', 'assignedTo', 'assignedToAvatar', 'category', 'dueDate', 'estimatedHours', 'actualHours', 'completedAt', 'createdAt', 'updatedAt']
  })

  const { 
    data: users = [], 
    isLoading: usersLoading 
  } = useUsersMinimal()

  const { 
    data: taskCounts,
    isLoading: countsLoading 
  } = useTaskCounts()

  // Optimistic mutation hooks
  const updateTaskMutation = useUpdateTask()
  const deleteTaskMutation = useDeleteTask()
  const batchUpdateMutation = useBatchUpdateTasks()

  // Client-side filtering for instant responses
  const filteredTasks = tasks.filter((task: Task) => {
    // Search filter
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !task.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    return true
  })

  // Handle task creation with optimistic updates
  const handleTaskCreate = useCallback(async (newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; error?: string }> => {
    try {
      // The task creation is handled in the TaskCreationDialog component
      // After creation, React Query will automatically refetch and update the cache
      await refetchTasks()
      return { success: true }
    } catch (error) {
      console.error('Error after task creation:', error)
      return { success: false, error: 'Error refreshing tasks' }
    }
  }, [refetchTasks])

  // Handle task updates with optimistic updates
  const handleTaskUpdate = useCallback(async (updatedTask: Task) => {
    updateTaskMutation.mutate({
      id: updatedTask.id,
      data: updatedTask
    })
  }, [updateTaskMutation])

  // Handle task updates by ID with optimistic updates
  const handleTaskUpdateById = useCallback(async (taskId: string, updates: Partial<Task>) => {
    updateTaskMutation.mutate({
      id: taskId,
      data: updates
    })
  }, [updateTaskMutation])

  // Handle task status toggle with optimistic updates
  const handleTaskStatusToggle = async (taskId: string, currentStatus: string) => {
    const newStatus = (currentStatus === "Done" || currentStatus === "Completed") ? "To Do" : "Done"
    const updates = {
      status: newStatus as any,
      completedAt: newStatus === "Done" ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    }
    
    updateTaskMutation.mutate({
      id: taskId,
      data: updates
    })
  }

  // Helper function to get user display name
  const getUserDisplayName = (assignedTo: string) => {
    const user = users.find((user) => user.name === assignedTo || user.fullName === assignedTo)
    return user?.fullName || assignedTo
  }

  // Handle task deletion with optimistic updates
  const handleTaskDelete = useCallback(async (taskId: string) => {
    deleteTaskMutation.mutate(taskId)
  }, [deleteTaskMutation])

  // Handle task selection for modification
  const handleTaskModify = useCallback((task: Task) => {
    setSelectedTask(task)
    setIsModifyDialogOpen(true)
  }, [])

  // Handle task selection for details view
  const handleTaskDetails = useCallback((task: Task) => {
    setSelectedTask(task)
    setIsDetailsDialogOpen(true)
  }, [])

  // Handle filtered tasks change from search/filter component
  const handleFilteredTasksChange = useCallback((filtered: Task[]) => {
    // This is now handled by client-side filtering for instant responses
    // We can update search query or filters here if needed
  }, [])

  // Get tasks based on current tab with client-side filtering
  const getTabTasks = () => {
    switch (selectedTab) {
      case "active":
        return filteredTasks.filter((task: Task) => task.status !== "Done" && task.status !== "Completed")
      case "completed":
        return filteredTasks.filter((task: Task) => task.status === "Done" || task.status === "Completed")
      case "time":
        return filteredTasks
      default:
        return filteredTasks
    }
  }

  const tabTasks = getTabTasks()
  const isLoading = tasksLoading || usersLoading

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">Task Management</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          + Create Task
        </Button>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="tasks" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              All Tasks
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2">
              <Clock className="h-4 w-4" />
              Active
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              Completed
            </TabsTrigger>
            <TabsTrigger value="time" className="gap-2">
              <Calendar className="h-4 w-4" />
              Time Management
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tasks" className="space-y-4">
          <TaskSearchFilter 
            tasks={tabTasks}
            onFilteredTasksChange={handleFilteredTasksChange}
            availableUsers={users.map(user => user.name).filter((name): name is string => name !== undefined)}
          />
          
          <Card>
            <CardHeader>
              <CardTitle>All Tasks</CardTitle>
              <CardDescription>
                Complete overview of all tasks with advanced filtering and search capabilities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Loading tasks...</p>
                  </div>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">No tasks found</p>
                    <p className="text-xs text-muted-foreground mt-1">Create your first task to get started</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="hidden md:table-cell">Due Date</TableHead>
                      <TableHead className="hidden lg:table-cell">Progress</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {tabTasks.map((task) => (
                    <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <div onClick={() => handleTaskDetails(task)}>
                          <div className="font-medium">{task.title}</div>
                          {task.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {task.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={task.assignedToAvatar} alt={task.assignedTo} />
                            <AvatarFallback>{task.assignedTo.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{getUserDisplayName(task.assignedTo)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TaskStatusBadge status={task.status} />
                      </TableCell>
                      <TableCell>
                        <TaskPriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{task.category}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {format(new Date(task.dueDate), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {task.estimatedHours && (
                          <div className="text-sm">
                            {task.actualHours || 0}h / {task.estimatedHours}h
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleTaskDetails(task)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
            <CardFooter>
              <div className="text-xs text-muted-foreground">
                Showing <strong>{tabTasks.length}</strong> of{" "}
                <strong>{tasks.length}</strong> tasks
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <TaskSearchFilter 
            tasks={tabTasks.filter((task: Task) => task.status !== "Done" && task.status !== "Completed")}
            onFilteredTasksChange={handleFilteredTasksChange}
            availableUsers={users.map(user => user.name).filter((name): name is string => name !== undefined)}
          />
          
          <Card>
            <CardHeader>
              <CardTitle>Active Tasks</CardTitle>
              <CardDescription>
                Tasks that are currently in progress or pending completion.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Loading tasks...</p>
                  </div>
                </div>
              ) : tabTasks.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">No active tasks found</p>
                    <p className="text-xs text-muted-foreground mt-1">All tasks are completed or no tasks exist</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="hidden md:table-cell">Due Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {tabTasks.map((task) => (
                    <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium" onClick={() => handleTaskDetails(task)}>
                        <div className="font-medium">{task.title}</div>
                        {task.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {task.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={task.assignedToAvatar} alt={getUserDisplayName(task.assignedTo)} />
                            <AvatarFallback>{getUserDisplayName(task.assignedTo).split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{getUserDisplayName(task.assignedTo)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TaskStatusBadge status={task.status} />
                      </TableCell>
                      <TableCell>
                        <TaskPriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {format(new Date(task.dueDate), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleTaskDetails(task)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
            <CardFooter>
              <div className="text-xs text-muted-foreground">
                Showing <strong>{tabTasks.length}</strong> active tasks
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Completed Tasks</CardTitle>
              <CardDescription>
                Tasks that have been successfully completed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Loading tasks...</p>
                  </div>
                </div>
              ) : tabTasks.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">No completed tasks found</p>
                    <p className="text-xs text-muted-foreground mt-1">Complete some tasks to see them here</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="hidden md:table-cell">Completed Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {tabTasks.map((task) => (
                    <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium" onClick={() => handleTaskDetails(task)}>
                        <div className="font-medium">{task.title}</div>
                        {task.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {task.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={task.assignedToAvatar} alt={getUserDisplayName(task.assignedTo)} />
                            <AvatarFallback>{getUserDisplayName(task.assignedTo).split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{getUserDisplayName(task.assignedTo)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TaskStatusBadge status={task.status} />
                      </TableCell>
                      <TableCell>
                        <TaskPriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {task.completedAt ? format(new Date(task.completedAt), "MMM dd, yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleTaskDetails(task)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
            <CardFooter>
              <div className="text-xs text-muted-foreground">
                Showing <strong>{tabTasks.length}</strong> completed tasks
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="time" className="space-y-4">
          <TimeManagementPanel 
            tasks={tabTasks}
            onTaskSelect={handleTaskDetails}
            assignableUsers={users.map(user => ({
              ...user,
              name: user.name || user.fullName || user.id,
              employeeNo: 'N/A', // getUsersMinimal doesn't include employeeNo
              department: 'Unknown', // getUsersMinimal doesn't include department
              role: 'User' as UserRole // getUsersMinimal doesn't include role
            }))}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <TaskCreationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onTaskCreate={handleTaskCreate}
        assignableUsers={users.map(user => ({
          id: user.id,
          name: user.name || user.fullName || user.id,
          fullName: user.fullName,
          avatar: user.profilePicture
        }))}
      />

      {selectedTask && (
        <>
          <TaskModificationDialog
            task={selectedTask}
            open={isModifyDialogOpen}
            onOpenChange={setIsModifyDialogOpen}
            onTaskUpdate={handleTaskUpdate}
            assignableUsers={users.map(user => ({
              id: user.id,
              name: user.name || user.fullName || user.id,
              avatar: user.profilePicture || '/placeholder-avatar.png',
              department: 'Unknown', // getUsersMinimal doesn't include department
              fullName: user.fullName
            }))}
          />

          <TaskDetailsDialog
            task={selectedTask}
            open={isDetailsDialogOpen}
            onOpenChange={setIsDetailsDialogOpen}
            onUpdateTask={handleTaskUpdateById}
            onDeleteTask={handleTaskDelete}
            availableUsers={users.map(user => ({
              id: user.id,
              name: user.name || user.fullName || user.id,
              avatar: user.profilePicture || '/placeholder-avatar.png',
              fullName: user.fullName
            }))}
          />
        </>
      )}
    </div>
  )
}
