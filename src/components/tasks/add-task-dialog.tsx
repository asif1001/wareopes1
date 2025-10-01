"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarIcon, PlusCircle, Upload, X, User } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { TaskPriority, TaskCategory } from "@/lib/types";

interface AddTaskDialogProps {
  onAddTask: (task: {
    title: string;
    description: string;
    priority: TaskPriority;
    category: TaskCategory;
    assignedTo: string;
    dueDate: Date;
    attachments: File[];
    tags: string[];
    estimatedHours?: number;
    reminderEnabled: boolean;
    reminderInterval?: number;
  }) => void;
  availableUsers?: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
}

const priorities: TaskPriority[] = ['Critical', 'High', 'Medium', 'Low'];
const categories: TaskCategory[] = [
  'General',
  'Inventory', 
  'Shipping',
  'Quality Control',
  'Maintenance',
  'Documentation',
  'Training'
];

const defaultUsers = [
  { id: '1', name: 'Alice Johnson', avatar: 'https://picsum.photos/seed/avatar1/40/40' },
  { id: '2', name: 'Bob Smith', avatar: 'https://picsum.photos/seed/avatar2/40/40' },
  { id: '3', name: 'Carol Davis', avatar: 'https://picsum.photos/seed/avatar3/40/40' },
  { id: '4', name: 'David Wilson', avatar: 'https://picsum.photos/seed/avatar4/40/40' },
];

export function AddTaskDialog({ onAddTask, availableUsers = defaultUsers }: AddTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Medium");
  const [category, setCategory] = useState<TaskCategory>("General");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [attachments, setAttachments] = useState<File[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [estimatedHours, setEstimatedHours] = useState<number>();
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderInterval, setReminderInterval] = useState<number>(24);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      return validTypes.includes(file.type) && file.size <= maxSize;
    });
    setAttachments(prev => [...prev, ...validFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags(prev => [...prev, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = () => {
    if (!title.trim() || !assignedTo || !dueDate) return;

    onAddTask({
      title: title.trim(),
      description: description.trim(),
      priority,
      category,
      assignedTo,
      dueDate,
      attachments,
      tags,
      estimatedHours,
      reminderEnabled,
      reminderInterval: reminderEnabled ? reminderInterval : undefined,
    });

    // Reset form
    setTitle("");
    setDescription("");
    setPriority("Medium");
    setCategory("General");
    setAssignedTo("");
    setDueDate(undefined);
    setAttachments([]);
    setTags([]);
    setTagInput("");
    setEstimatedHours(undefined);
    setReminderEnabled(false);
    setReminderInterval(24);
    setOpen(false);
  };

  const selectedUser = availableUsers.find(user => user.id === assignedTo);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1 hidden">
          <PlusCircle className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            Add Task
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task with all necessary details and assignments.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              className="w-full"
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task in detail..."
              className="min-h-[100px]"
            />
          </div>

          {/* Priority and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Priority *</Label>
              <Select value={priority} onValueChange={(value: TaskPriority) => setPriority(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          p === 'Critical' && "bg-red-600",
                          p === 'High' && "bg-red-400",
                          p === 'Medium' && "bg-yellow-400",
                          p === 'Low' && "bg-green-400"
                        )} />
                        {p}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Category *</Label>
              <Select value={category} onValueChange={(value: TaskCategory) => setCategory(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assigned To */}
          <div className="grid gap-2">
            <Label>Assign To *</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user...">
                  {selectedUser && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={selectedUser.avatar} alt={selectedUser.name} />
                        <AvatarFallback>
                          <User className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                      <span>{selectedUser.name}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>
                          <User className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="grid gap-2">
            <Label>Due Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Estimated Hours */}
          <div className="grid gap-2">
            <Label htmlFor="estimatedHours">Estimated Hours</Label>
            <Input
              id="estimatedHours"
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours || ""}
              onChange={(e) => setEstimatedHours(e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="Enter estimated hours..."
            />
          </div>

          {/* Tags */}
          <div className="grid gap-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button type="button" onClick={addTag} variant="outline" size="sm">
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* File Attachments */}
          <div className="grid gap-2">
            <Label>Attachments</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                multiple
                onChange={handleFileUpload}
                accept=".jpg,.jpeg,.png,.gif,.pdf,.txt,.doc,.docx"
                className="hidden"
                id="file-upload"
              />
              <Label
                htmlFor="file-upload"
                className="flex items-center gap-2 px-3 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer text-sm"
              >
                <Upload className="h-4 w-4" />
                Upload Files
              </Label>
              <span className="text-sm text-muted-foreground">
                Max 10MB per file. Supported: Images, PDF, DOC, TXT
              </span>
            </div>
            {attachments.length > 0 && (
              <div className="space-y-2 mt-2">
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reminder Settings */}
          <div className="grid gap-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="reminder"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="reminder">Enable reminders</Label>
            </div>
            {reminderEnabled && (
              <div className="grid gap-2 ml-6">
                <Label htmlFor="reminderInterval">Reminder interval (hours)</Label>
                <Input
                  id="reminderInterval"
                  type="number"
                  min="1"
                  value={reminderInterval}
                  onChange={(e) => setReminderInterval(parseInt(e.target.value) || 24)}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleSubmit}
            disabled={!title.trim() || !assignedTo || !dueDate}
          >
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}