"use client";

import { SerializableTask, SerializableUserProfile, TaskStatus } from "@/lib/task-types";
import { TaskKanbanColumn } from "./task-kanban-column";

type TaskKanbanProps = {
    tasks: SerializableTask[];
    users: SerializableUserProfile[];
    onEdit: (task: SerializableTask) => void;
};

const kanbanColumns: TaskStatus[] = ["Backlog", "To Do", "In Progress", "Review", "Done"];

export function TaskKanban({ tasks, users, onEdit }: TaskKanbanProps) {
    const tasksByStatus = kanbanColumns.reduce((acc, status) => {
        acc[status] = tasks.filter(task => task.status === status);
        return acc;
    }, {} as Record<TaskStatus, SerializableTask[]>);

    return (
        <div className="flex gap-6 overflow-x-auto pb-4">
            {kanbanColumns.map(status => (
                <TaskKanbanColumn
                    key={status}
                    status={status}
                    tasks={tasksByStatus[status]}
                    users={users}
                    onEdit={onEdit}
                />
            ))}
        </div>
    );
}
