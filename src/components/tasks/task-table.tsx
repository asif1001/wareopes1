"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SerializableTask, SerializableUserProfile } from "@/lib/task-types";
import { cn } from "@/lib/utils";
import { format } from 'date-fns';

type TaskTableProps = {
    tasks: SerializableTask[];
    users: SerializableUserProfile[];
    onEdit: (task: SerializableTask) => void;
    onDelete: (task: SerializableTask) => void;
};

const getPriorityVariant = (priority: string) => {
    switch (priority) {
        case 'High':
        case 'Urgent':
            return 'destructive';
        case 'Medium':
            return 'secondary';
        case 'Low':
        case 'No Priority':
            return 'outline';
        default:
            return 'default';
    }
};

const getStatusVariant = (status: string) => {
    switch (status) {
        case 'Done':
            return 'default';
        case 'In Progress':
            return 'secondary';
        case 'Blocked':
            return 'destructive';
        case 'To Do':
        case 'Backlog':
        case 'On Hold':
        case 'Review':
            return 'outline';
        default:
            return 'default';
    }
};

const getUserById = (users: SerializableUserProfile[], userId: string | null | undefined) => {
    if (!userId) return null;
    return users.find(u => u.id === userId) || null;
};

export function TaskTable({ tasks, users, onEdit, onDelete }: TaskTableProps) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {tasks.map((task) => {
                    const assignee = getUserById(users, task.assigneeId);
                    return (
                        <TableRow key={task.id}>
                            <TableCell className="font-medium">{task.title}</TableCell>
                            <TableCell>
                                <Badge variant="outline">{task.status}</Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant={getPriorityVariant(task.priority)}>{task.priority}</Badge>
                            </TableCell>
                            <TableCell>
                                {assignee ? (
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={assignee.avatarUrl} />
                                            <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span>{assignee.name}</span>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">Unassigned</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : <span className="text-muted-foreground">N/A</span>}
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Toggle menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onSelect={() => onEdit(task)}>Edit</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => onDelete(task)}>Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
