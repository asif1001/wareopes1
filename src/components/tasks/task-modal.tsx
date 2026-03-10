"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { SerializableTask, SerializableUserProfile, TaskPriority, TaskStatus } from "@/lib/task-types";
import { CalendarIcon, PlusCircle, Trash2, Upload, X, Download, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { HistoryAndComments } from "./task-history";
import { TaskCommentForm } from "./task-comment-form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

type TaskModalProps = {
    isOpen: boolean;
    onClose: () => void;
    task: SerializableTask | null;
    users: SerializableUserProfile[];
    currentUserId: string;
    onTaskSaved?: () => void;
};

const taskStatusEnum: [TaskStatus, ...TaskStatus[]] = ["Backlog", "To Do", "In Progress", "Blocked", "On Hold", "Review", "Done"];
const taskPriorityEnum: [TaskPriority, ...TaskPriority[]] = ["No Priority", "Low", "Medium", "High", "Urgent"];

function SubmitButton({ pending }: { pending: boolean }) {
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save Task"}
        </Button>
    );
}

export function TaskModal({ isOpen, onClose, task, users, currentUserId, onTaskSaved }: TaskModalProps) {
    const [actionState, setActionState] = useState<{ success: boolean, error: string | null }>({ success: false, error: null });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    // Form state
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        status: "To Do" as TaskStatus,
        priority: "No Priority" as TaskPriority,
        assigneeId: "",
        startDate: "",
        dueDate: "",
        labels: [] as string[],
        subtasks: [] as { title: string; isComplete: boolean }[],
    });

    // Attachments state
    const [attachments, setAttachments] = useState<File[]>([]);
    const [existingAttachments, setExistingAttachments] = useState<any[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Comments state for live updates within the modal
    const [comments, setComments] = useState<any[]>([]);

    // Date picker states
    const [startDateOpen, setStartDateOpen] = useState(false);
    const [dueDateOpen, setDueDateOpen] = useState(false);

    // Subtasks state
    const [subtasks, setSubtasks] = useState<{ title: string; isComplete: boolean }[]>([]);

    useEffect(() => {
        if (isOpen) {
            setActionState({ success: false, error: null });

            if (task) {
                setFormData({
                    title: task.title,
                    description: task.description || "",
                    status: task.status,
                    priority: task.priority,
                    assigneeId: task.assigneeId || "",
                    startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : "",
                    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : "",
                    labels: task.labels || [],
                    subtasks: task.subtasks?.map(s => ({ title: s.title, isComplete: s.isComplete })) || [],
                });
                setSubtasks(task.subtasks?.map(s => ({ title: s.title, isComplete: s.isComplete })) || []);
                // Normalize attachments to a consistent shape for display in the modal
                const normalizedAttachments = (task.attachments || []).map((att: any) => ({
                    ...att,
                    fileName: att?.fileName ?? att?.name ?? att?.filename ?? "Untitled",
                    fileUrl: att?.fileUrl ?? att?.url ?? att?.href ?? att?.downloadUrl ?? "",
                    fileType: att?.fileType ?? att?.type ?? "",
                    size: att?.size ?? 0,
                    uploadedAt: att?.uploadedAt ?? att?.uploaded_at ?? null,
                    uploadedBy: att?.uploadedBy ?? att?.uploaded_by ?? "Unknown",
                }));
                setExistingAttachments(normalizedAttachments);
                setAttachments([]); // Always reset new attachments when opening modal
                setComments(task.comments || []);
            } else {
                // Set default start date to today for new tasks
                const today = new Date().toISOString().split('T')[0];
                setFormData({
                    title: "",
                    description: "",
                    status: "To Do",
                    priority: "No Priority",
                    assigneeId: "",
                    startDate: today,
                    dueDate: "",
                    labels: [],
                    subtasks: [],
                });
                setSubtasks([]);
                setAttachments([]);
                setExistingAttachments([]);
                setComments([]);
            }
        }
    }, [isOpen, task]);

    const addSubtask = () => {
        setSubtasks([...subtasks, { title: "", isComplete: false }]);
    };

    const removeSubtask = (index: number) => {
        setSubtasks(subtasks.filter((_, i) => i !== index));
    };

    const updateSubtask = (index: number, field: string, value: any) => {
        const newSubtasks = [...subtasks];
        newSubtasks[index] = { ...newSubtasks[index], [field]: value };
        setSubtasks(newSubtasks);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setAttachments(prev => [...prev, ...files]);
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const removeExistingAttachment = (index: number) => {
        setExistingAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        console.log('Form data being sent:', Object.fromEntries(formData.entries()));

        // Add attachments to form data
        attachments.forEach((file, index) => {
            formData.append(`attachments`, file);
        });

        // Add existing attachments to keep
        formData.append('existingAttachments', JSON.stringify(existingAttachments));

        setActionState({ success: false, error: null }); // Reset state
        setIsSubmitting(true);

        try {
            // Call the API route instead of server action
            const response = await fetch('/api/tasks', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            console.log('API response:', result);

            if (result.success) {
                setActionState({ success: true, error: null });
                onTaskSaved?.(); // Refresh the task list
                onClose();
                toast({ title: "Task saved successfully!" });
            } else {
                setActionState({ success: false, error: result.error });
            }
        } catch (error) {
            console.error('Error calling API:', error);
            setActionState({ success: false, error: 'An unexpected error occurred' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-7xl max-h-[90vh] flex flex-col p-0 bg-gradient-to-br from-slate-50 to-white overflow-hidden">
                <DialogHeader className="p-4 pb-3 bg-white border-b border-slate-200/60 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <PlusCircle className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-semibold text-slate-900">
                                {task ? "Edit Task" : "Create New Task"}
                            </DialogTitle>
                            <p className="text-xs text-slate-600 mt-0.5">
                                {task ? "Update task details" : "Add a new task"}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    {/* Hidden inputs for form data */}
                    <input type="hidden" name="id" value={task?.id || ""} />
                    <input type="hidden" name="title" value={formData.title} />
                    <input type="hidden" name="description" value={formData.description} />
                    <input type="hidden" name="status" value={formData.status} />
                    <input type="hidden" name="priority" value={formData.priority} />
                    <input type="hidden" name="assigneeId" value={formData.assigneeId} />
                    <input type="hidden" name="reporterId" value={task?.reporterId || currentUserId} />
                    <input type="hidden" name="startDate" value={formData.startDate} />
                    <input type="hidden" name="dueDate" value={formData.dueDate} />
                    <input type="hidden" name="subtasks" value={JSON.stringify(subtasks)} />

                    {actionState.error && (
                        <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex-shrink-0">
                            <div className="flex items-center gap-2 text-sm text-red-700">
                                <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center">
                                    <X className="w-3 h-3" />
                                </div>
                                {actionState.error}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Main Content Grid - 3 columns for optimal space usage */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Column 1: Basic Information */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-4 h-4 rounded bg-blue-100 flex items-center justify-center">
                                        <span className="text-xs font-bold text-blue-600">1</span>
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-900">Basic Info</h3>
                                </div>

                                {/* Title */}
                                <div className="space-y-1">
                                    <Label htmlFor="title" className="text-xs font-medium text-slate-700">
                                        Title <span className="text-red-500">*</span>
                                    </Label>
                                    <input
                                        id="title"
                                        name="title"
                                        placeholder="Task title..."
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                                        required
                                    />
                                </div>

                                {/* Description */}
                                <div className="space-y-1">
                                    <Label htmlFor="description" className="text-xs font-medium text-slate-700">
                                        Description
                                    </Label>
                                    <Textarea
                                        id="description"
                                        name="description"
                                        placeholder="Task description..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                                    />
                                </div>
                            </div>

                            {/* Column 2: Task Details */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-4 h-4 rounded bg-green-100 flex items-center justify-center">
                                        <span className="text-xs font-bold text-green-600">2</span>
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-900">Details</h3>
                                </div>

                                {/* Status & Priority in one row */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-medium text-slate-700">Status</Label>
                                        <Select value={formData.status} onValueChange={(value: TaskStatus) => setFormData({ ...formData, status: value })}>
                                            <SelectTrigger className="w-full h-8 text-xs border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {taskStatusEnum.map((status) => (
                                                    <SelectItem key={status} value={status} className="py-1 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${
                                                                status === 'Done' ? 'bg-green-500' :
                                                                status === 'In Progress' ? 'bg-blue-500' :
                                                                status === 'Blocked' ? 'bg-red-500' :
                                                                status === 'Review' ? 'bg-purple-500' :
                                                                'bg-gray-400'
                                                            }`} />
                                                            {status}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-xs font-medium text-slate-700">Priority</Label>
                                        <Select value={formData.priority} onValueChange={(value: TaskPriority) => setFormData({ ...formData, priority: value })}>
                                            <SelectTrigger className="w-full h-8 text-xs border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {taskPriorityEnum.map((priority) => (
                                                    <SelectItem key={priority} value={priority} className="py-1 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${
                                                                priority === 'Urgent' ? 'bg-red-500' :
                                                                priority === 'High' ? 'bg-orange-500' :
                                                                priority === 'Medium' ? 'bg-yellow-500' :
                                                                priority === 'Low' ? 'bg-blue-500' :
                                                                'bg-gray-400'
                                                            }`} />
                                                            {priority}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Assignee */}
                                <div className="space-y-1">
                                    <Label className="text-xs font-medium text-slate-700">Assignee</Label>
                                    <Select value={formData.assigneeId} onValueChange={(value) => setFormData({ ...formData, assigneeId: value })}>
                                        <SelectTrigger className="w-full h-8 text-xs border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                            <SelectValue placeholder="Select assignee" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="_unassigned" className="py-1 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
                                                        <span className="text-xs text-gray-500">?</span>
                                                    </div>
                                                    Unassigned
                                                </div>
                                            </SelectItem>
                                            {users.map((user) => (
                                                <SelectItem key={user.id} value={user.id} className="py-1 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                                                            <span className="text-xs font-medium text-blue-600">
                                                                {user.name.charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                        {user.name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Column 3: Dates and Subtasks */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-4 h-4 rounded bg-purple-100 flex items-center justify-center">
                                        <span className="text-xs font-bold text-purple-600">3</span>
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-900">Dates & Subtasks</h3>
                                </div>

                                {/* Dates in one row */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-medium text-slate-700">Start Date</Label>
                                        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full h-8 justify-start text-left font-normal text-xs border-slate-300 hover:bg-slate-50",
                                                        !formData.startDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-1 h-3 w-3" />
                                                    {formData.startDate ? format(new Date(formData.startDate), "MMM d") : <span>Start</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={formData.startDate ? new Date(formData.startDate) : undefined}
                                                    onSelect={(date) => {
                                                        setFormData({ ...formData, startDate: date ? date.toISOString().split('T')[0] : "" });
                                                        setStartDateOpen(false);
                                                    }}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-xs font-medium text-slate-700">Due Date</Label>
                                        <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full h-8 justify-start text-left font-normal text-xs border-slate-300 hover:bg-slate-50",
                                                        !formData.dueDate && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-1 h-3 w-3" />
                                                    {formData.dueDate ? format(new Date(formData.dueDate), "MMM d") : <span>Due</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={formData.dueDate ? new Date(formData.dueDate) : undefined}
                                                    onSelect={(date) => {
                                                        setFormData({ ...formData, dueDate: date ? date.toISOString().split('T')[0] : "" });
                                                        setDueDateOpen(false);
                                                    }}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                {/* Subtasks - compact list */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-slate-700">Subtasks</Label>
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                        {subtasks.map((subtask, index) => (
                                            <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200">
                                                <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                                                </div>
                                                <Input
                                                    placeholder="Subtask..."
                                                    value={subtask.title}
                                                    onChange={(e) => updateSubtask(index, 'title', e.target.value)}
                                                    className="flex-1 h-6 text-xs border-slate-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeSubtask(index)}
                                                    className="h-6 w-6 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addSubtask}
                                        className="w-full h-7 text-xs border-slate-300 hover:bg-slate-50 text-slate-700"
                                    >
                                        <PlusCircle className="h-3 w-3 mr-1" />
                                        Add Subtask
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Attachments Section - Full Width */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded bg-orange-100 flex items-center justify-center">
                                    <span className="text-xs font-bold text-orange-600">4</span>
                                </div>
                                <h3 className="text-sm font-semibold text-slate-900">Attachments</h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {/* Existing attachments */}
                                {existingAttachments.map((attachment, index) => (
                                    <div key={`existing-${index}`} className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-200">
                                        <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                                            <Upload className="h-3 w-3 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-900 truncate">{attachment.fileName}</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                Uploaded by {attachment.uploadedBy} on {attachment.uploadedAt ? format(new Date(attachment.uploadedAt), "PPp") : "Unknown"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-6 px-2 text-xs"
                                                onClick={() => {
                                                    const url = attachment.fileUrl;
                                                    if (!url || /example\.com/i.test(url)) {
                                                        toast({
                                                            title: "Invalid attachment link",
                                                            description: "This file has a placeholder URL. Please re-upload the attachment to preview.",
                                                        });
                                                        return;
                                                    }
                                                    window.open(url, "_blank", "noopener,noreferrer");
                                                }}
                                            >
                                                <ExternalLink className="h-3 w-3 mr-1" />
                                                Preview
                                            </Button>
                                            {attachment.fileUrl && !/example\.com/i.test(attachment.fileUrl) ? (
                                                <a
                                                    href={attachment.fileUrl}
                                                    download={attachment.fileName}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center h-6 px-2 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
                                                >
                                                    <Download className="h-3 w-3 mr-1" />
                                                    Download
                                                </a>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled
                                                    title="Invalid link. Re-upload to enable download."
                                                    className="h-6 px-2 text-xs text-slate-500"
                                                >
                                                    <Download className="h-3 w-3 mr-1" />
                                                    Download
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeExistingAttachment(index)}
                                                className="h-6 w-6 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}

                                {/* New attachments */}
                                {attachments.map((file, index) => (
                                    <div key={`new-${index}`} className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
                                        <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center flex-shrink-0">
                                            <Upload className="h-3 w-3 text-green-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-900 truncate">{file.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {(file.size / 1024 / 1024).toFixed(1)} MB
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeAttachment(index)}
                                            className="h-6 w-6 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            {/* File input - Button reliably opens file picker */}
                            <div className="flex justify-center">
                                <Input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="file-upload"
                                    accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.xls,.ppt,.pptx"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs border-slate-300 hover:bg-slate-50 text-slate-700"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="h-3 w-3 mr-1" />
                                    Add Files
                                </Button>
                            </div>
                        </div>

                        {/* Comments & Activity - Only for existing tasks */}
                        {task && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded bg-gray-100 flex items-center justify-center">
                                        <span className="text-xs font-bold text-gray-600">5</span>
                                    </div>
                                    <h3 className="text-sm font-semibold text-slate-900">Comments & Activity</h3>
                                </div>
                                {/* Comment input */}
                                <div className="border border-slate-200 rounded p-2 bg-white">
                                    <TaskCommentForm
                                        taskId={task.id}
                                        onCommentAdded={(c) => {
                                            setComments(prev => [...prev, c]);
                                            toast({ title: "Comment added" });
                                        }}
                                    />
                                </div>
                                {/* Combined history and comments */}
                                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded p-2 bg-slate-50/50">
                                    <HistoryAndComments
                                        history={task.history}
                                        comments={comments}
                                        users={users}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-4 pt-3 border-t border-slate-200 bg-white flex-shrink-0">
                        <div className="flex items-center justify-between w-full">
                            <div className="text-xs text-slate-500">
                                {attachments.length > 0 && (
                                    <span>{attachments.length} file{attachments.length !== 1 ? 's' : ''} ready</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={onClose}
                                    className="px-4 h-8 text-xs hover:bg-slate-100"
                                >
                                    Cancel
                                </Button>
                                <SubmitButton pending={isSubmitting} />
                            </div>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
