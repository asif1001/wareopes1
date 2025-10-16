"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  Clock, 
  User, 
  MessageSquare, 
  Activity, 
  Paperclip,
  Download,
  Edit,
  Save,
  X,
  Plus,
  History
} from "lucide-react";
import { format } from "date-fns";
import { TaskStatusBadge } from "./task-status-badge";
import { TaskPriorityBadge } from "./task-priority-badge";
import type { Task, TaskStatus, TaskPriority, TaskCategory } from "@/lib/types";

interface TaskDetailsDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask?: (taskId: string) => void;
  availableUsers?: Array<{
    id: string;
    name: string;
    avatar?: string;
    fullName?: string;
  }>;
}

const statuses: TaskStatus[] = ['Not Started', 'To Do', 'In Progress', 'Completed', 'Done', 'Blocked', 'On Hold'];
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

export function TaskDetailsDialog({ 
  task, 
  open, 
  onOpenChange, 
  onUpdateTask,
  onDeleteTask,
  availableUsers = defaultUsers 
}: TaskDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});
  const [newComment, setNewComment] = useState("");

  // Early return if task is null
  if (!task) return null;

  // Helper function to combine and sort comments and activity history chronologically
  const getCombinedHistory = () => {
    const history: Array<{
      id: string;
      type: 'comment' | 'activity';
      timestamp: string;
      user: string;
      userAvatar?: string;
      content?: string;
      description?: string;
      oldValue?: string;
      newValue?: string;
    }> = [];

    // Add comments to history
    if (task.comments) {
      task.comments.forEach(comment => {
        history.push({
          id: comment.id,
          type: 'comment',
          timestamp: comment.createdAt,
          user: comment.author,
          userAvatar: comment.authorAvatar,
          content: comment.content
        });
      });
    }

    // Add activity history
    if (task.activityHistory) {
      task.activityHistory.forEach(activity => {
        history.push({
          id: activity.id,
          type: 'activity',
          timestamp: activity.timestamp,
          user: activity.user,
          userAvatar: activity.userAvatar,
          description: activity.description,
          oldValue: activity.oldValue,
          newValue: activity.newValue
        });
      });
    }

    // Sort by timestamp (newest first)
    return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const handleEdit = () => {
    setEditedTask({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      category: task.category,
      assignedTo: task.assignedTo,
      dueDate: task.dueDate,
      estimatedHours: task.estimatedHours,
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    const currentTime = new Date().toISOString();
    const changes: string[] = [];
    const activityHistory = [...(task.activityHistory || [])];
    
    // Track changes for activity history
    if (editedTask.title && editedTask.title !== task.title) {
      changes.push(`title changed from "${task.title}" to "${editedTask.title}"`);
    }
    if (editedTask.description && editedTask.description !== task.description) {
      changes.push(`description updated`);
    }
    if (editedTask.status && editedTask.status !== task.status) {
      changes.push(`status changed from "${task.status}" to "${editedTask.status}"`);
    }
    if (editedTask.priority && editedTask.priority !== task.priority) {
      changes.push(`priority changed from "${task.priority}" to "${editedTask.priority}"`);
    }
    if (editedTask.category && editedTask.category !== task.category) {
      changes.push(`category changed from "${task.category}" to "${editedTask.category}"`);
    }
    
    // Add activity history entry if there are changes
    if (changes.length > 0) {
      activityHistory.push({
        id: `activity-${Math.random().toString(36).substr(2, 9)}`,
        type: "updated",
        description: `Task updated: ${changes.join(', ')}`,
        timestamp: currentTime,
        user: "Current User", // In real app, get from auth context
        userAvatar: "https://picsum.photos/seed/currentuser/40/40"
      });
    }
    
    onUpdateTask(task.id, {
      ...editedTask,
      updatedAt: currentTime,
      completedAt: editedTask.status === "Done" || editedTask.status === "Completed" ? currentTime : task.completedAt,
      activityHistory
    });
    setIsEditing(false);
    setEditedTask({});
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedTask({});
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    
    const currentTime = new Date().toISOString();
    const comment = {
      id: `comment-${Date.now()}`,
      content: newComment.trim(),
      author: "Current User", // In real app, get from auth context
      authorAvatar: "https://picsum.photos/seed/currentuser/40/40",
      createdAt: currentTime,
    };

    // Add activity history entry for the comment
    const activityHistory = [...(task.activityHistory || [])];
    activityHistory.push({
      id: `activity-${Math.random().toString(36).substr(2, 9)}`,
      type: "comment_added",
      description: "Added a comment",
      timestamp: currentTime,
      user: "Current User",
      userAvatar: "https://picsum.photos/seed/currentuser/40/40"
    });

    onUpdateTask(task.id, {
      comments: [...(task.comments || []), comment],
      updatedAt: currentTime,
      activityHistory
    });
    
    setNewComment("");
  };

  const assignedUser = availableUsers.find(user => user.id === task.assignedTo || user.name === task.assignedTo);
  
  // Helper function to get user display name
  const getUserDisplayName = (assignedTo: string) => {
    const user = availableUsers.find(user => user.name === assignedTo || user.fullName === assignedTo || user.id === assignedTo)
    return user?.fullName || assignedTo
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editedTask.title || ""}
                  onChange={(e) => setEditedTask(prev => ({ ...prev, title: e.target.value }))}
                  className="text-lg font-semibold"
                />
              ) : (
                <DialogTitle className="text-xl">{task.title}</DialogTitle>
              )}
              <DialogDescription className="mt-1">
                Task ID: {task.id} • Created {format(new Date(task.createdAt), "PPP")}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancel}>
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                    <X className="h-4 w-4 mr-1" />
                    Close
                  </Button>
                  {onDeleteTask && (
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
                          onDeleteTask(task.id);
                          onOpenChange(false);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1" />
              History ({(task.comments?.length || 0) + (task.activityHistory?.length || 0)})
            </TabsTrigger>
            <TabsTrigger value="attachments">
              Files ({task.attachments?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status and Priority */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Status & Priority</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Status</Label>
                    {isEditing ? (
                      <Select 
                        value={editedTask.status || task.status} 
                        onValueChange={(value: TaskStatus) => setEditedTask(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <TaskStatusBadge status={task.status} />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Priority</Label>
                    {isEditing ? (
                      <Select 
                        value={editedTask.priority || task.priority} 
                        onValueChange={(value: TaskPriority) => setEditedTask(prev => ({ ...prev, priority: value }))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {priorities.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {priority}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <TaskPriorityBadge priority={task.priority} />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Category</Label>
                    {isEditing ? (
                      <Select 
                        value={editedTask.category || task.category} 
                        onValueChange={(value: TaskCategory) => setEditedTask(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{task.category}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Assignment and Timing */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Assignment & Timing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Assigned To</Label>
                    {isEditing ? (
                      <Select 
                        value={editedTask.assignedTo || task.assignedTo} 
                        onValueChange={(value) => setEditedTask(prev => ({ ...prev, assignedTo: value }))}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUsers.map((user) => (
                            <SelectItem key={user.id} value={user.name}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
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
                    ) : (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={assignedUser?.avatar || task.assignedToAvatar} alt={getUserDisplayName(task.assignedTo)} />
                          <AvatarFallback>
                            <User className="h-3 w-3" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{getUserDisplayName(task.assignedTo)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Due Date</Label>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(task.dueDate), "PPP")}
                    </div>
                  </div>
                  {task.estimatedHours && (
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Estimated Hours</Label>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-4 w-4" />
                        {task.estimatedHours}h
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Description */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Description</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={editedTask.description || ""}
                    onChange={(e) => setEditedTask(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter task description..."
                    className="min-h-[100px]"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {task.description || "No description provided."}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            {getCombinedHistory().length > 0 ? (
              getCombinedHistory().map((item) => (
                <Card key={`${item.type}-${item.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={item.userAvatar} alt={item.user} />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {item.type === 'comment' ? (
                            <MessageSquare className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Activity className="h-4 w-4 text-green-500" />
                          )}
                          <span className="font-medium text-sm">{item.user}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.type === 'comment' ? 'Comment' : 'Activity'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(item.timestamp), "PPp")}
                          </span>
                        </div>
                        {item.type === 'comment' ? (
                          <p className="text-sm">{item.content}</p>
                        ) : (
                          <div>
                            <p className="text-sm">{item.description}</p>
                            {item.oldValue && item.newValue && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Changed from "{item.oldValue}" to "{item.newValue}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2" />
                <p>No history available yet.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="attachments" className="space-y-3">
            {task.attachments?.map((attachment) => (
              <Card key={attachment.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Paperclip className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(attachment.size / 1024 / 1024).toFixed(2)} MB • 
                          Uploaded by {attachment.uploadedBy} on {format(new Date(attachment.uploadedAt), "PPp")}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )) || (
              <div className="text-center py-8 text-muted-foreground">
                <Paperclip className="h-8 w-8 mx-auto mb-2" />
                <p>No attachments available.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}