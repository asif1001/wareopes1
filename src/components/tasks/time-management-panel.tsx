"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Filter,
  Bell,
  CalendarDays,
  Timer,
  Target,
  User as UserIcon,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react"
import { format, isToday, isTomorrow, isThisWeek, addDays, differenceInDays, differenceInHours } from "date-fns"
import { cn } from "@/lib/utils"
import type { Task, TaskPriority, User } from "@/lib/types"

interface TimeManagementPanelProps {
  tasks: Task[]
  onTaskSelect?: (task: Task) => void
  assignableUsers?: User[]
}

type ViewFilter = "all" | "today" | "tomorrow" | "week" | "overdue"
type SortOption = "dueDate" | "priority" | "created" | "updated"

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  "Critical": 4,
  "High": 3,
  "Medium": 2,
  "Low": 1
}

const PRIORITY_COLORS = {
  "Critical": "bg-red-500",
  "High": "bg-orange-500", 
  "Medium": "bg-yellow-500",
  "Low": "bg-green-500"
}

export function TimeManagementPanel({ tasks, onTaskSelect, assignableUsers = [] }: TimeManagementPanelProps) {
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all")
  const [sortBy, setSortBy] = useState<SortOption>("dueDate")

  // Helper function to get user display name
  const getUserDisplayName = (assignedTo: string) => {
    const user = assignableUsers.find(user => user.name === assignedTo || user.fullName === assignedTo || user.id === assignedTo)
    return user?.fullName || user?.name || assignedTo
  }
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const now = new Date()

  // Filter tasks based on selected view
  const getFilteredTasks = () => {
    let filtered = tasks.filter(task => 
      task.status !== "Done" && task.status !== "Completed"
    )

    switch (viewFilter) {
      case "today":
        filtered = filtered.filter(task => isToday(new Date(task.dueDate)))
        break
      case "tomorrow":
        filtered = filtered.filter(task => isTomorrow(new Date(task.dueDate)))
        break
      case "week":
        filtered = filtered.filter(task => isThisWeek(new Date(task.dueDate)))
        break
      case "overdue":
        filtered = filtered.filter(task => new Date(task.dueDate) < now)
        break
    }

    return filtered
  }

  // Sort tasks
  const getSortedTasks = (tasksToSort: Task[]) => {
    return [...tasksToSort].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case "dueDate":
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          break
        case "priority":
          comparison = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]
          break
        case "created":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case "updated":
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
      }

      return sortDirection === "desc" ? -comparison : comparison
    })
  }

  const filteredTasks = getFilteredTasks()
  const sortedTasks = getSortedTasks(filteredTasks)

  // Calculate statistics
  const todayTasks = tasks.filter(task => 
    isToday(new Date(task.dueDate)) && task.status !== "Done" && task.status !== "Completed"
  )
  const overdueTasks = tasks.filter(task => 
    new Date(task.dueDate) < now && task.status !== "Done" && task.status !== "Completed"
  )
  const upcomingTasks = tasks.filter(task => 
    new Date(task.dueDate) > now && new Date(task.dueDate) <= addDays(now, 7) && 
    task.status !== "Done" && task.status !== "Completed"
  )

  const getTaskUrgency = (task: Task) => {
    const dueDate = new Date(task.dueDate)
    const hoursUntilDue = differenceInHours(dueDate, now)
    
    if (hoursUntilDue < 0) return "overdue"
    if (hoursUntilDue <= 24) return "urgent"
    if (hoursUntilDue <= 72) return "soon"
    return "normal"
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "overdue": return "text-red-600 bg-red-50"
      case "urgent": return "text-orange-600 bg-orange-50"
      case "soon": return "text-yellow-600 bg-yellow-50"
      default: return "text-gray-600 bg-gray-50"
    }
  }

  const getTimeUntilDue = (dueDate: string) => {
    const due = new Date(dueDate)
    const diffDays = differenceInDays(due, now)
    const diffHours = differenceInHours(due, now)

    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`
    if (diffDays === 0) {
      if (diffHours < 0) return `${Math.abs(diffHours)} hours overdue`
      if (diffHours === 0) return "Due now"
      return `${diffHours} hours left`
    }
    if (diffDays === 1) return "Due tomorrow"
    return `${diffDays} days left`
  }

  const TaskCard = ({ task }: { task: Task }) => {
    const urgency = getTaskUrgency(task)
    const timeLeft = getTimeUntilDue(task.dueDate)
    
    return (
      <Card 
        className={cn(
          "cursor-pointer transition-all hover:shadow-md border-l-4",
          urgency === "overdue" && "border-l-red-500",
          urgency === "urgent" && "border-l-orange-500", 
          urgency === "soon" && "border-l-yellow-500",
          urgency === "normal" && "border-l-blue-500"
        )}
        onClick={() => onTaskSelect?.(task)}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate">{task.title}</h4>
                <p className="text-sm text-muted-foreground truncate">
                  {task.description}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <div className={cn("w-2 h-2 rounded-full", PRIORITY_COLORS[task.priority])} />
                <Badge variant="outline" className="text-xs">
                  {task.priority}
                </Badge>
              </div>
            </div>

            {/* Time and Status */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className={cn(
                  "font-medium",
                  urgency === "overdue" && "text-red-600",
                  urgency === "urgent" && "text-orange-600",
                  urgency === "soon" && "text-yellow-600"
                )}>
                  {timeLeft}
                </span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {task.status}
              </Badge>
            </div>

            {/* Assignee and Progress */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={task.assignedToAvatar} alt={getUserDisplayName(task.assignedTo)} />
                <AvatarFallback>
                  <UserIcon className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">{getUserDisplayName(task.assignedTo)}</span>
              </div>
              
              {task.estimatedHours && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  {task.actualHours || 0}h / {task.estimatedHours}h
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {task.estimatedHours && (
              <Progress 
                value={((task.actualHours || 0) / task.estimatedHours) * 100} 
                className="h-2"
              />
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Due Today</p>
                <p className="text-2xl font-bold">{todayTasks.length}</p>
              </div>
              <CalendarDays className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{overdueTasks.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">{upcomingTasks.length}</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming">Upcoming Tasks</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {/* Filters and Sorting */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              <Select value={viewFilter} onValueChange={(value: ViewFilter) => setViewFilter(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="today">Due Today</SelectItem>
                  <SelectItem value="tomorrow">Due Tomorrow</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dueDate">Due Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
              >
                {sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              {sortedTasks.length} tasks
            </div>
          </div>

          {/* Task List */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {sortedTasks.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="font-medium mb-2">All caught up!</h3>
                    <p className="text-muted-foreground">
                      {viewFilter === "all" 
                        ? "No pending tasks found." 
                        : `No tasks ${viewFilter === "overdue" ? "overdue" : `due ${viewFilter}`}.`
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                sortedTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Calendar Integration
              </CardTitle>
              <CardDescription>
                View tasks in calendar format with due dates and deadlines
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Calendar view will be implemented with a date picker component</p>
                <p className="text-sm">Integration with external calendars coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reminders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Reminder Settings
              </CardTitle>
              <CardDescription>
                Configure notifications and escalation rules for tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">24 Hour Reminder</h4>
                    <p className="text-sm text-muted-foreground">Get notified 1 day before due date</p>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">48 Hour Reminder</h4>
                    <p className="text-sm text-muted-foreground">Get notified 2 days before due date</p>
                  </div>
                  <Badge variant="outline">Inactive</Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Overdue Escalation</h4>
                    <p className="text-sm text-muted-foreground">Notify manager when tasks are overdue</p>
                  </div>
                  <Badge variant="secondary">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}