"use client";

import { SerializableTask, SerializableUserProfile, TaskStatus } from "@/lib/task-types";
import { TaskCard } from "./task-card";

type TaskKanbanColumnProps = {
    status: TaskStatus;
    tasks: SerializableTask[];
    users: SerializableUserProfile[];
    onEdit: (task: SerializableTask) => void;
};

export function TaskKanbanColumn({ status, tasks, users, onEdit }: TaskKanbanColumnProps) {
    return (
    <div className="flex flex-col w-72 flex-shrink-0" role="region" aria-label={`Kanban Column: ${status}`}> 
            <h3 className="font-semibold text-lg mb-4 px-1" tabIndex={0}>{status} ({tasks.length})</h3>
            <div className="flex-1 bg-muted/50 rounded-lg p-2 overflow-y-auto">
                {tasks.map(task => (
                    <TaskCard key={task.id} task={task} users={users} onEdit={onEdit} />
                ))}
            </div>
        </div>
    );
}
