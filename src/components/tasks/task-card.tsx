"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SerializableTask, SerializableUserProfile } from "@/lib/task-types";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

type TaskCardProps = {
    task: SerializableTask;
    users: SerializableUserProfile[];
    onEdit: (task: SerializableTask) => void;
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

const getUserById = (users: SerializableUserProfile[], userId: string | null | undefined) => {
    if (!userId) return null;
    return users.find(u => u.id === userId) || null;
};

export function TaskCard({ task, users, onEdit }: TaskCardProps) {
    const assignee = getUserById(users, task.assigneeId);

    return (
        <Card onClick={() => onEdit(task)} className="mb-4 cursor-pointer hover:bg-muted/50">
            <CardHeader className="p-4">
                <CardTitle className="text-base">{task.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <Badge variant={getPriorityVariant(task.priority)} className="ml-auto mr-2">{task.priority}</Badge>
                    {assignee && (
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={assignee.avatarUrl} />
                            <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    )}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <CalendarIcon className={cn(
                            "h-3 w-3",
                            task.dueDate && new Date(task.dueDate) < new Date() && "text-destructive"
                        )} />
                        {task.dueDate ? (
                            <span className={cn(task.dueDate && new Date(task.dueDate) < new Date() && "text-destructive")}>
                                {format(new Date(task.dueDate), "MMM d")}
                            </span>
                        ) : (
                            <span>No due date</span>
                        )}
                    </div>
                    {assignee && (
                        <Avatar className="h-6 w-6">
                            <AvatarImage src={assignee.avatarUrl} />
                            <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
