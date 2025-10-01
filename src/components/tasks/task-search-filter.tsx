"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { 
  Search, 
  Filter, 
  X, 
  Calendar as CalendarIcon,
  User,
  Tag,
  Clock,
  AlertCircle
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import type { Task, TaskStatus, TaskPriority, TaskCategory } from "@/lib/types"

interface TaskSearchFilterProps {
  tasks: Task[]
  onFilteredTasksChange: (filteredTasks: Task[]) => void
  availableUsers?: string[]
  availableTags?: string[]
}

interface FilterState {
  searchQuery: string
  statuses: TaskStatus[]
  priorities: TaskPriority[]
  categories: TaskCategory[]
  assignees: string[]
  tags: string[]
  dueDateFrom?: Date
  dueDateTo?: Date
  createdDateFrom?: Date
  createdDateTo?: Date
  isOverdue: boolean
  hasAttachments: boolean
  hasComments: boolean
}

const DEFAULT_FILTER_STATE: FilterState = {
  searchQuery: "",
  statuses: [],
  priorities: [],
  categories: [],
  assignees: [],
  tags: [],
  isOverdue: false,
  hasAttachments: false,
  hasComments: false,
}

const STATUS_OPTIONS: TaskStatus[] = [
  "Not Started", "To Do", "In Progress", "Completed", "Done", "Blocked", "On Hold"
]

const PRIORITY_OPTIONS: TaskPriority[] = ["Critical", "High", "Medium", "Low"]

const CATEGORY_OPTIONS: TaskCategory[] = [
  "General", "Inventory", "Shipping", "Quality Control", 
  "Maintenance", "Documentation", "Training"
]

export function TaskSearchFilter({ 
  tasks, 
  onFilteredTasksChange, 
  availableUsers = [],
  availableTags = []
}: TaskSearchFilterProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER_STATE)
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // Extract unique values from tasks if not provided
  const uniqueUsers = availableUsers.length > 0 
    ? availableUsers 
    : Array.from(new Set(tasks.map(task => task.assignedTo)))
  
  const uniqueTags = availableTags.length > 0 
    ? availableTags 
    : Array.from(new Set(tasks.flatMap(task => task.tags || [])))

  // Apply filters whenever filters change
  useEffect(() => {
    const filteredTasks = applyFilters(tasks, filters)
    onFilteredTasksChange(filteredTasks)
  }, [tasks, filters, onFilteredTasksChange])

  const applyFilters = (tasksToFilter: Task[], filterState: FilterState): Task[] => {
    return tasksToFilter.filter(task => {
      // Search query filter
      if (filterState.searchQuery) {
        const query = filterState.searchQuery.toLowerCase()
        const matchesSearch = 
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.assignedTo.toLowerCase().includes(query) ||
          task.tags?.some(tag => tag.toLowerCase().includes(query))
        
        if (!matchesSearch) return false
      }

      // Status filter
      if (filterState.statuses.length > 0 && !filterState.statuses.includes(task.status)) {
        return false
      }

      // Priority filter
      if (filterState.priorities.length > 0 && !filterState.priorities.includes(task.priority)) {
        return false
      }

      // Category filter
      if (filterState.categories.length > 0 && !filterState.categories.includes(task.category)) {
        return false
      }

      // Assignee filter
      if (filterState.assignees.length > 0 && !filterState.assignees.includes(task.assignedTo)) {
        return false
      }

      // Tags filter
      if (filterState.tags.length > 0) {
        const taskTags = task.tags || []
        const hasMatchingTag = filterState.tags.some(tag => taskTags.includes(tag))
        if (!hasMatchingTag) return false
      }

      // Due date range filter
      if (filterState.dueDateFrom || filterState.dueDateTo) {
        const taskDueDate = new Date(task.dueDate)
        if (filterState.dueDateFrom && taskDueDate < filterState.dueDateFrom) return false
        if (filterState.dueDateTo && taskDueDate > filterState.dueDateTo) return false
      }

      // Created date range filter
      if (filterState.createdDateFrom || filterState.createdDateTo) {
        const taskCreatedDate = new Date(task.createdAt)
        if (filterState.createdDateFrom && taskCreatedDate < filterState.createdDateFrom) return false
        if (filterState.createdDateTo && taskCreatedDate > filterState.createdDateTo) return false
      }

      // Overdue filter
      if (filterState.isOverdue) {
        const isTaskOverdue = new Date(task.dueDate) < new Date() && 
          task.status !== "Done" && task.status !== "Completed"
        if (!isTaskOverdue) return false
      }

      // Has attachments filter
      if (filterState.hasAttachments && (!task.attachments || task.attachments.length === 0)) {
        return false
      }

      // Has comments filter
      if (filterState.hasComments && (!task.comments || task.comments.length === 0)) {
        return false
      }

      return true
    })
  }

  const updateFilter = <K extends keyof FilterState>(
    key: K, 
    value: FilterState[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const toggleArrayFilter = <K extends keyof FilterState>(
    key: K,
    value: string,
    currentArray: string[]
  ) => {
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value]
    
    updateFilter(key, newArray as FilterState[K])
  }

  const clearAllFilters = () => {
    setFilters(DEFAULT_FILTER_STATE)
  }

  const getActiveFilterCount = () => {
    let count = 0
    if (filters.searchQuery) count++
    if (filters.statuses.length > 0) count++
    if (filters.priorities.length > 0) count++
    if (filters.categories.length > 0) count++
    if (filters.assignees.length > 0) count++
    if (filters.tags.length > 0) count++
    if (filters.dueDateFrom || filters.dueDateTo) count++
    if (filters.createdDateFrom || filters.createdDateTo) count++
    if (filters.isOverdue) count++
    if (filters.hasAttachments) count++
    if (filters.hasComments) count++
    return count
  }

  const activeFilterCount = getActiveFilterCount()

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks by title, description, assignee, or tags..."
            value={filters.searchQuery}
            onChange={(e) => updateFilter("searchQuery", e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filters</h4>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    Clear All
                  </Button>
                )}
              </div>

              <Separator />

              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={filters.statuses.includes(status)}
                        onCheckedChange={() => 
                          toggleArrayFilter("statuses", status, filters.statuses)
                        }
                      />
                      <Label htmlFor={`status-${status}`} className="text-xs">
                        {status}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Priority Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Priority</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITY_OPTIONS.map((priority) => (
                    <div key={priority} className="flex items-center space-x-2">
                      <Checkbox
                        id={`priority-${priority}`}
                        checked={filters.priorities.includes(priority)}
                        onCheckedChange={() => 
                          toggleArrayFilter("priorities", priority, filters.priorities)
                        }
                      />
                      <Label htmlFor={`priority-${priority}`} className="text-xs">
                        {priority}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Category Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Category</Label>
                <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                  {CATEGORY_OPTIONS.map((category) => (
                    <div key={category} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category}`}
                        checked={filters.categories.includes(category)}
                        onCheckedChange={() => 
                          toggleArrayFilter("categories", category, filters.categories)
                        }
                      />
                      <Label htmlFor={`category-${category}`} className="text-xs">
                        {category}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Assignee Filter */}
              {uniqueUsers.length > 0 && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Assigned To</Label>
                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                      {uniqueUsers.map((user) => (
                        <div key={user} className="flex items-center space-x-2">
                          <Checkbox
                            id={`assignee-${user}`}
                            checked={filters.assignees.includes(user)}
                            onCheckedChange={() => 
                              toggleArrayFilter("assignees", user, filters.assignees)
                            }
                          />
                          <Label htmlFor={`assignee-${user}`} className="text-xs">
                            {user}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Tags Filter */}
              {uniqueTags.length > 0 && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tags</Label>
                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                      {uniqueTags.map((tag) => (
                        <div key={tag} className="flex items-center space-x-2">
                          <Checkbox
                            id={`tag-${tag}`}
                            checked={filters.tags.includes(tag)}
                            onCheckedChange={() => 
                              toggleArrayFilter("tags", tag, filters.tags)
                            }
                          />
                          <Label htmlFor={`tag-${tag}`} className="text-xs">
                            {tag}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Date Filters */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Due Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dueDateFrom ? format(filters.dueDateFrom, "PPP") : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dueDateFrom}
                        onSelect={(date) => updateFilter("dueDateFrom", date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dueDateTo ? format(filters.dueDateTo, "PPP") : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dueDateTo}
                        onSelect={(date) => updateFilter("dueDateTo", date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Separator />

              {/* Special Filters */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Special Filters</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="overdue"
                      checked={filters.isOverdue}
                      onCheckedChange={(checked) => updateFilter("isOverdue", !!checked)}
                    />
                    <Label htmlFor="overdue" className="text-xs flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Overdue tasks only
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="attachments"
                      checked={filters.hasAttachments}
                      onCheckedChange={(checked) => updateFilter("hasAttachments", !!checked)}
                    />
                    <Label htmlFor="attachments" className="text-xs">
                      Has attachments
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="comments"
                      checked={filters.hasComments}
                      onCheckedChange={(checked) => updateFilter("hasComments", !!checked)}
                    />
                    <Label htmlFor="comments" className="text-xs">
                      Has comments
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {filters.searchQuery}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter("searchQuery", "")}
              />
            </Badge>
          )}
          
          {filters.statuses.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              Status: {status}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleArrayFilter("statuses", status, filters.statuses)}
              />
            </Badge>
          ))}
          
          {filters.priorities.map((priority) => (
            <Badge key={priority} variant="secondary" className="gap-1">
              Priority: {priority}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleArrayFilter("priorities", priority, filters.priorities)}
              />
            </Badge>
          ))}
          
          {filters.categories.map((category) => (
            <Badge key={category} variant="secondary" className="gap-1">
              Category: {category}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleArrayFilter("categories", category, filters.categories)}
              />
            </Badge>
          ))}
          
          {filters.assignees.map((assignee) => (
            <Badge key={assignee} variant="secondary" className="gap-1">
              Assignee: {assignee}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleArrayFilter("assignees", assignee, filters.assignees)}
              />
            </Badge>
          ))}
          
          {filters.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              Tag: {tag}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => toggleArrayFilter("tags", tag, filters.tags)}
              />
            </Badge>
          ))}
          
          {(filters.dueDateFrom || filters.dueDateTo) && (
            <Badge variant="secondary" className="gap-1">
              Due: {filters.dueDateFrom ? format(filters.dueDateFrom, "PP") : "Any"} - {filters.dueDateTo ? format(filters.dueDateTo, "PP") : "Any"}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => {
                  updateFilter("dueDateFrom", undefined)
                  updateFilter("dueDateTo", undefined)
                }}
              />
            </Badge>
          )}
          
          {filters.isOverdue && (
            <Badge variant="secondary" className="gap-1">
              Overdue only
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter("isOverdue", false)}
              />
            </Badge>
          )}
          
          {filters.hasAttachments && (
            <Badge variant="secondary" className="gap-1">
              Has attachments
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter("hasAttachments", false)}
              />
            </Badge>
          )}
          
          {filters.hasComments && (
            <Badge variant="secondary" className="gap-1">
              Has comments
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter("hasComments", false)}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}