"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  PlusCircle, 
  Calendar as CalendarIcon, 
  Upload, 
  X, 
  FileText, 
  Image, 
  File,
  AlertCircle,
  Clock,
  User
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import type { TaskPriority, TaskCategory, TaskAttachment } from "@/lib/types"

interface TaskCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskCreate: (task: any) => Promise<{ success: boolean; error?: string }>
  assignableUsers: Array<{
    id: string
    name: string
    fullName: string
    avatar?: string
  }>
}

const PRIORITY_OPTIONS: TaskPriority[] = ["Low", "Medium", "High", "Critical"]
const CATEGORY_OPTIONS: TaskCategory[] = ["General", "Inventory", "Shipping", "Quality Control", "Maintenance", "Documentation", "Training"]

const REMINDER_INTERVALS = [
  { value: 24, label: "24 hours before" },
  { value: 48, label: "48 hours before" },
  { value: 72, label: "72 hours before" },
  { value: 168, label: "1 week before" },
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

export function TaskCreationDialog({ open, onOpenChange, onTaskCreate, assignableUsers }: TaskCreationDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<TaskPriority>("Medium")
  const [category, setCategory] = useState<TaskCategory>("General")
  const [assignedTo, setAssignedTo] = useState("none")
  const [dueDate, setDueDate] = useState<Date>()
  const [estimatedHours, setEstimatedHours] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [currentTag, setCurrentTag] = useState("")
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderInterval, setReminderInterval] = useState(24)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!title.trim()) {
      newErrors.title = "Title is required"
    } else if (title.length > 100) {
      newErrors.title = "Title must be less than 100 characters"
    }
    
    if (!description.trim()) {
      newErrors.description = "Description is required"
    } else if (description.length > 2000) {
      newErrors.description = "Description must be less than 2000 characters"
    }
    
    if (!dueDate) {
      newErrors.dueDate = "Due date is required"
    } else if (dueDate < new Date()) {
      newErrors.dueDate = "Due date cannot be in the past"
    }
    
    if (estimatedHours && (isNaN(Number(estimatedHours)) || Number(estimatedHours) <= 0)) {
      newErrors.estimatedHours = "Estimated hours must be a positive number"
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return
    
    Array.from(files).forEach(file => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setErrors(prev => ({ ...prev, attachments: `File type ${file.type} is not allowed` }))
        return
      }
      
      if (file.size > MAX_FILE_SIZE) {
        setErrors(prev => ({ ...prev, attachments: `File ${file.name} is too large (max 10MB)` }))
        return
      }
      
      const attachment: TaskAttachment = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString(),
        uploadedBy: "current-user"
      }
      
      setAttachments(prev => [...prev, attachment])
    })
    
    // Clear the input
    event.target.value = ''
  }

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id))
  }

  const addTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags(prev => [...prev, currentTag.trim()])
      setCurrentTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove))
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    
    setIsSubmitting(true)
    setErrors({})
    
    try {
      const assignedUser = assignableUsers.find(user => user.id === assignedTo)
      
      const newTask = {
        title: title.trim(),
        description: description.trim(),
        priority,
        category,
        assignedTo: assignedUser ? assignedUser.name : "Unassigned",
        dueDate: dueDate!.toISOString(),
        estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
        tags: tags.length > 0 ? tags : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        reminderEnabled,
        reminderInterval: reminderEnabled ? reminderInterval : undefined,
        status: "To Do" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "current-user",
        comments: [],
        activityHistory: [{
          id: Math.random().toString(36).substr(2, 9),
          type: "created" as const,
          description: "Task created",
          timestamp: new Date().toISOString(),
          userId: "current-user",
          userName: "Current User"
        }]
      }

      const result = await onTaskCreate(newTask)
      
      if (result.success) {
        // Reset form
        setTitle("")
        setDescription("")
        setPriority("Medium")
        setCategory("General")
        setAssignedTo("none")
        setDueDate(undefined)
        setEstimatedHours("")
        setTags([])
        setCurrentTag("")
        setAttachments([])
        setReminderEnabled(false)
        setReminderInterval(24)
        setErrors({})
        onOpenChange(false)
      } else {
        setErrors({ submit: result.error || "Failed to create task. Please try again." })
      }
    } catch (error) {
      setErrors({ submit: "Failed to create task. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />
    if (type === 'application/pdf') return <FileText className="h-4 w-4" />
    return <File className="h-4 w-4" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1 hidden">
          <PlusCircle className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Add Task
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[95vh] w-[90vw]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create New Task</DialogTitle>
          <DialogDescription className="text-base">
            Fill in the details below to create a new task. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[75vh] pr-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">
                  Title *
                </Label>
                <Input
                  id="title"
                  placeholder="Enter task title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={cn(errors.title && "border-red-500")}
                />
                {errors.title && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.title}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description *
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe the task in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={cn("min-h-[120px] resize-none", errors.description && "border-red-500")}
                />
                {errors.description && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Priority</Label>
                <Select value={priority} onValueChange={(value: TaskPriority) => setPriority(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Category</Label>
                <Select value={category} onValueChange={(value: TaskCategory) => setCategory(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Assigned To */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Assign To</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className={cn(errors.assignedTo && "border-red-500")}>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {assignableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="text-xs">
                              {user.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span>{user.fullName}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.assignedTo && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.assignedTo}
                  </p>
                )}
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Due Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground",
                        errors.dueDate && "border-red-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.dueDate && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.dueDate}
                  </p>
                )}
              </div>

              {/* Estimated Hours */}
              <div className="space-y-2">
                <Label htmlFor="estimatedHours" className="text-sm font-medium">
                  Estimated Hours
                </Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  placeholder="0"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  className={cn(errors.estimatedHours && "border-red-500")}
                />
                {errors.estimatedHours && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.estimatedHours}
                  </p>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tags</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag..."
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* File Attachments */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">File Attachments</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Click to upload files
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      PDF, DOCX, JPG, PNG up to 10MB
                    </span>
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    multiple
                    accept=".pdf,.docx,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>
              {errors.attachments && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.attachments}
                </p>
              )}
            </div>

            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getFileIcon(attachment.type)}
                      <div>
                        <p className="text-sm font-medium">{attachment.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(attachment.size)}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(attachment.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator className="my-6" />

          {/* Reminder Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enable Reminder</Label>
                <p className="text-xs text-gray-500">Get notified before the due date</p>
              </div>
              <Switch
                checked={reminderEnabled}
                onCheckedChange={setReminderEnabled}
              />
            </div>

            {reminderEnabled && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Reminder Time</Label>
                <Select value={reminderInterval.toString()} onValueChange={(value) => setReminderInterval(Number(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REMINDER_INTERVALS.map((interval) => (
                      <SelectItem key={interval.value} value={interval.value.toString()}>
                        {interval.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>

        {errors.submit && (
          <p className="text-sm text-red-500 text-center flex items-center justify-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {errors.submit}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}