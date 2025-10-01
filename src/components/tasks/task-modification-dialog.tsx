"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Edit3, 
  User, 
  Clock, 
  AlertCircle,
  CheckCircle,
  Pause,
  Play,
  XCircle,
  ArrowRight,
  MessageSquare,
  Loader2,
  X
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import type { Task, TaskStatus, TaskPriority, TaskCategory, TaskActivity } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface TaskModificationDialogProps {
  task: Task
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskUpdate: (updatedTask: Task) => void
  assignableUsers: Array<{ id: string; name: string; avatar: string; department: string; fullName?: string }>
}

const STATUS_WORKFLOW: Record<TaskStatus, TaskStatus[]> = {
  "Not Started": ["To Do", "In Progress"],
  "To Do": ["In Progress", "On Hold"],
  "In Progress": ["Completed", "Blocked", "On Hold"],
  "Completed": ["Done"],
  "Done": [], // Final state
  "Blocked": ["To Do", "In Progress", "On Hold"],
  "On Hold": ["To Do", "In Progress"]
}

const STATUS_CONFIG = {
  "Not Started": { icon: Clock, color: "text-gray-500", bgColor: "bg-gray-100" },
  "To Do": { icon: Clock, color: "text-blue-500", bgColor: "bg-blue-100" },
  "In Progress": { icon: Play, color: "text-yellow-500", bgColor: "bg-yellow-100" },
  "Completed": { icon: CheckCircle, color: "text-green-500", bgColor: "bg-green-100" },
  "Done": { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-200" },
  "Blocked": { icon: XCircle, color: "text-red-500", bgColor: "bg-red-100" },
  "On Hold": { icon: Pause, color: "text-orange-500", bgColor: "bg-orange-100" }
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: "Critical", label: "Critical", color: "bg-red-500" },
  { value: "High", label: "High", color: "bg-orange-500" },
  { value: "Medium", label: "Medium", color: "bg-yellow-500" },
  { value: "Low", label: "Low", color: "bg-green-500" },
]

const CATEGORY_OPTIONS: { value: TaskCategory; label: string }[] = [
  { value: "General", label: "General" },
  { value: "Inventory", label: "Inventory Management" },
  { value: "Shipping", label: "Shipping & Logistics" },
  { value: "Quality Control", label: "Quality Control" },
  { value: "Maintenance", label: "Equipment Maintenance" },
  { value: "Documentation", label: "Documentation" },
  { value: "Training", label: "Training & Development" },
]

export function TaskModificationDialog({ 
  task, 
  open, 
  onOpenChange, 
  onTaskUpdate, 
  assignableUsers 
}: TaskModificationDialogProps) {
  const { toast } = useToast()
  
  // Mock current user - in a real app, this would come from auth context
  const currentUser = {
    name: "Current User",
    avatar: "/placeholder-avatar.png"
  }

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || "")
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [category, setCategory] = useState<TaskCategory>(task.category)
  const [assignedTo, setAssignedTo] = useState("")
  const [actualHours, setActualHours] = useState(task.actualHours?.toString() || "")
  const [statusChangeReason, setStatusChangeReason] = useState("")
  const [reassignmentReason, setReassignmentReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Find current assigned user
  const currentAssignedUser = assignableUsers.find(user => user.name === task.assignedTo || user.fullName === task.assignedTo)
  
  // Helper function to get user display name
  const getUserDisplayName = (assignedTo: string) => {
    const user = assignableUsers.find(user => user.name === assignedTo || user.fullName === assignedTo || user.id === assignedTo)
    return user?.fullName || user?.name || assignedTo
  }
  
  useEffect(() => {
    setAssignedTo(currentAssignedUser?.id || "")
  }, [currentAssignedUser])

  useEffect(() => {
    const hasFormChanges = 
      title !== task.title ||
      description !== (task.description || "") ||
      status !== task.status ||
      priority !== task.priority ||
      category !== task.category ||
      assignedTo !== (currentAssignedUser?.id || "") ||
      actualHours !== (task.actualHours?.toString() || "")
    
    setHasChanges(hasFormChanges)
  }, [title, description, status, priority, category, assignedTo, actualHours, task, currentAssignedUser])

  const getAvailableStatuses = () => {
    return STATUS_WORKFLOW[task.status] || []
  }

  // Enhanced activity entry creation with better metadata
  const createActivityEntry = (
    type: TaskActivity['type'], 
    description: string, 
    oldValue?: string, 
    newValue?: string,
    metadata?: Record<string, any>
  ): TaskActivity => ({
    id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    description,
    user: currentUser?.name || "Unknown User",
    userAvatar: currentUser?.avatar || "",
    timestamp: new Date().toISOString(),
    oldValue,
    newValue,
    ...metadata
  })

  // Enhanced change tracking with detailed metadata
  const trackFieldChange = (
    fieldName: string,
    oldVal: any,
    newVal: any,
    activityHistory: TaskActivity[],
    changes: string[]
  ) => {
    if (oldVal !== newVal) {
      const changeDescription = getChangeDescription(fieldName, oldVal, newVal)
      const entry = createActivityEntry(
        getActivityType(fieldName),
        changeDescription,
        String(oldVal || ""),
        String(newVal || ""),
        {
          fieldName,
          changeType: "field_update",
          sessionId: `session_${Date.now()}`,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
        }
      )
      activityHistory.push(entry)
      changes.push(getChangeDisplayText(fieldName, oldVal, newVal))
    }
  }

  // Helper function to get appropriate activity type
  const getActivityType = (fieldName: string): TaskActivity['type'] => {
    switch (fieldName) {
      case 'status': return 'status_changed'
      case 'assignedTo': return 'assigned'
      default: return 'updated'
    }
  }

  // Helper function to get detailed change description
  const getChangeDescription = (fieldName: string, oldVal: any, newVal: any): string => {
    const timestamp = new Date().toLocaleString()
    
    switch (fieldName) {
      case 'title':
        return `Title updated from "${oldVal}" to "${newVal}" at ${timestamp}`
      case 'description':
        return `Description ${oldVal ? 'updated' : 'added'} at ${timestamp}`
      case 'status':
        return `Status changed from "${oldVal}" to "${newVal}" at ${timestamp}${statusChangeReason ? ` - Reason: ${statusChangeReason}` : ''}`
      case 'priority':
        return `Priority level changed from "${oldVal}" to "${newVal}" at ${timestamp}`
      case 'category':
        return `Category changed from "${oldVal}" to "${newVal}" at ${timestamp}`
      case 'assignedTo':
        return `Task reassigned from "${oldVal}" to "${newVal}" at ${timestamp}${reassignmentReason ? ` - Reason: ${reassignmentReason}` : ''}`
      case 'actualHours':
        return `Actual hours logged: ${newVal}h (previously: ${oldVal || 0}h) at ${timestamp}`
      case 'dueDate':
        return `Due date changed from "${oldVal}" to "${newVal}" at ${timestamp}`
      default:
        return `${fieldName} updated from "${oldVal}" to "${newVal}" at ${timestamp}`
    }
  }

  // Helper function to get user-friendly change display text
  const getChangeDisplayText = (fieldName: string, oldVal: any, newVal: any): string => {
    switch (fieldName) {
      case 'title':
        return `Title: "${oldVal}" → "${newVal}"`
      case 'description':
        return oldVal ? 'Description updated' : 'Description added'
      case 'status':
        return `Status: ${oldVal} → ${newVal}`
      case 'priority':
        return `Priority: ${oldVal} → ${newVal}`
      case 'category':
        return `Category: ${oldVal} → ${newVal}`
      case 'assignedTo':
        return `Assigned to: ${oldVal} → ${newVal}`
      case 'actualHours':
        return `Actual hours: ${oldVal || 0}h → ${newVal}h`
      case 'dueDate':
        return `Due date: ${oldVal} → ${newVal}`
      default:
        return `${fieldName}: ${oldVal} → ${newVal}`
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSaveError(null)
    
    try {
      const newAssignedUser = assignableUsers.find(user => user.id === assignedTo)
      const activityHistory = [...(task.activityHistory || [])]
      
      // Track changes for activity history with enhanced logging
      const changes: string[] = []
      
      // Use enhanced change tracking for all fields
      trackFieldChange('title', task.title, title.trim(), activityHistory, changes)
      trackFieldChange('description', task.description || "", description.trim(), activityHistory, changes)
      trackFieldChange('status', task.status, status, activityHistory, changes)
      trackFieldChange('priority', task.priority, priority, activityHistory, changes)
      trackFieldChange('category', task.category, category, activityHistory, changes)
      
      // Handle assignment change with user name resolution
      if (newAssignedUser && newAssignedUser.name !== task.assignedTo) {
        trackFieldChange('assignedTo', task.assignedTo, newAssignedUser.name, activityHistory, changes)
      }
      
      // Handle actual hours change
      if (actualHours !== (task.actualHours?.toString() || "") && actualHours) {
        trackFieldChange('actualHours', task.actualHours?.toString() || "0", actualHours, activityHistory, changes)
      }

      // Add a comprehensive update summary entry
      if (changes.length > 0) {
        const summaryEntry = createActivityEntry(
          "updated",
          `Task updated with ${changes.length} change${changes.length > 1 ? 's' : ''}: ${changes.join(', ')}`,
          undefined,
          undefined,
          {
            changeCount: changes.length,
            changesSummary: changes,
            updateType: "bulk_update",
            sessionId: `session_${Date.now()}`
          }
        )
        activityHistory.push(summaryEntry)
      }

      const updatedTask: Task = {
        ...task,
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        category,
        assignedTo: newAssignedUser?.name || task.assignedTo,
        assignedToAvatar: newAssignedUser?.avatar || task.assignedToAvatar,
        actualHours: actualHours ? Number(actualHours) : undefined,
        updatedAt: new Date().toISOString(),
        completedAt: status === "Done" || status === "Completed" ? new Date().toISOString() : undefined,
        activityHistory
      }
      
      // Update task in Firebase with enhanced error handling
      const { updateTaskAction } = await import('@/app/actions')
      const result = await updateTaskAction(task.id, updatedTask)
      
      if (result.success) {
        // Update local state
        await onTaskUpdate(updatedTask)
        
        // Show success notification with change summary
        toast({
          title: "Task Updated Successfully",
          description: changes.length > 0 
            ? `Updated: ${changes.slice(0, 2).join(", ")}${changes.length > 2 ? ` and ${changes.length - 2} more changes` : ""}`
            : "Task has been updated with your changes",
          duration: 5000,
        })
        
        // Close dialog
        onOpenChange(false)
      } else {
        // Handle Firebase error but still update local state for better UX
        setSaveError(result.error || "Failed to save changes to server")
        await onTaskUpdate(updatedTask)
        
        toast({
          title: "Partial Update",
          description: "Changes saved locally but may not sync to server. Please try again.",
          variant: "destructive",
          duration: 7000,
        })
      }
    } catch (error) {
      console.error('Error updating task:', error)
      setSaveError(error instanceof Error ? error.message : "An unexpected error occurred")
      
      toast({
        title: "Update Failed",
        description: "Failed to update task. Please check your connection and try again.",
        variant: "destructive",
        duration: 7000,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const StatusIcon = STATUS_CONFIG[status]?.icon || Clock

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Modify Task
          </DialogTitle>
          <DialogDescription>
            Update task details, change status, or reassign to team members.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Current Status Display */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <StatusIcon className={cn("h-5 w-5", STATUS_CONFIG[task.status]?.color)} />
                <span className="font-medium">Current Status:</span>
                <Badge variant="outline" className={STATUS_CONFIG[task.status]?.bgColor}>
                  {task.status}
                </Badge>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                <StatusIcon className={cn("h-5 w-5", STATUS_CONFIG[status]?.color)} />
                <Badge variant="outline" className={STATUS_CONFIG[status]?.bgColor}>
                  {status}
                </Badge>
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Task Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter task title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task description"
                  className="min-h-[100px]"
                />
              </div>
            </div>

            <Separator />

            {/* Status Management */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status Transition</Label>
                <Select value={status} onValueChange={(value: TaskStatus) => setStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Current status */}
                    <SelectItem value={task.status}>
                      <div className="flex items-center gap-2">
                        <StatusIcon className={cn("h-4 w-4", STATUS_CONFIG[task.status]?.color)} />
                        {task.status} (Current)
                      </div>
                    </SelectItem>
                    
                    {/* Available transitions */}
                    {getAvailableStatuses().map((availableStatus) => {
                      const StatusIcon = STATUS_CONFIG[availableStatus]?.icon || Clock
                      return (
                        <SelectItem key={availableStatus} value={availableStatus}>
                          <div className="flex items-center gap-2">
                            <StatusIcon className={cn("h-4 w-4", STATUS_CONFIG[availableStatus]?.color)} />
                            {availableStatus}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {status !== task.status && (
                <div className="space-y-2">
                  <Label htmlFor="statusReason">Reason for Status Change</Label>
                  <Textarea
                    id="statusReason"
                    value={statusChangeReason}
                    onChange={(e) => setStatusChangeReason(e.target.value)}
                    placeholder="Explain why you're changing the status..."
                    className="min-h-[60px]"
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Priority and Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(value: TaskPriority) => setPriority(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", option.color)} />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(value: TaskCategory) => setCategory(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Assignment */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reassign Task</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback>
                              <User className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                          <span>{user.fullName || user.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {user.department}
                          </Badge>
                          {(user.name === task.assignedTo || user.fullName === task.assignedTo) && (
                            <Badge variant="secondary" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {assignedTo !== (currentAssignedUser?.id || "") && (
                <div className="space-y-2">
                  <Label htmlFor="reassignReason">Reason for Reassignment</Label>
                  <Textarea
                    id="reassignReason"
                    value={reassignmentReason}
                    onChange={(e) => setReassignmentReason(e.target.value)}
                    placeholder="Explain why you're reassigning this task..."
                    className="min-h-[60px]"
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Time Tracking */}
            <div className="space-y-2">
              <Label htmlFor="actualHours">Actual Hours Worked</Label>
              <Input
                id="actualHours"
                type="number"
                value={actualHours}
                onChange={(e) => setActualHours(e.target.value)}
                placeholder="0"
                min="0"
                step="0.5"
              />
              {task.estimatedHours && (
                <p className="text-xs text-muted-foreground">
                  Estimated: {task.estimatedHours}h
                  {actualHours && Number(actualHours) > 0 && (
                    <span className={cn(
                      "ml-2",
                      Number(actualHours) > task.estimatedHours ? "text-red-500" : "text-green-500"
                    )}>
                      ({Number(actualHours) > task.estimatedHours ? "+" : ""}{(Number(actualHours) - task.estimatedHours).toFixed(1)}h)
                    </span>
                  )}
                </p>
              )}
            </div>

            {/* Task Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <p><strong>Created:</strong> {format(new Date(task.createdAt), "PPp")}</p>
                <p><strong>Created by:</strong> {task.createdBy}</p>
              </div>
              <div>
                <p><strong>Last updated:</strong> {format(new Date(task.updatedAt), "PPp")}</p>
                <p><strong>Due date:</strong> {format(new Date(task.dueDate), "PPP")}</p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col gap-2">
          {saveError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              <span>{saveError}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSaveError(null)}
                className="ml-auto h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!hasChanges || isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Task"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}