"use client";

import { SerializableTask, SerializableUserProfile } from "@/lib/task-types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TaskTableProps {
  tasks: SerializableTask[];
  users: SerializableUserProfile[];
  onEdit: (task: SerializableTask) => void;
  onDelete?: (task: SerializableTask) => Promise<void> | void;
}

// Color scale and sorting helpers
function getDueMeta(dueDate?: string | null) {
  if (!dueDate) {
    return { days: null as number | null, rowClass: "", textClass: "text-muted-foreground" };
  }
  const now = new Date();
  const todayUTC = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate);
  const dueUTC = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const msDiff = dueUTC.getTime() - todayUTC.getTime();
  const days = Math.round(msDiff / 86400000);

  let rowClass = "";
  let textClass = "";
  if (days < 0) {
    rowClass = "bg-red-50";
    textClass = "text-red-700";
  } else if (days === 0) {
    rowClass = "bg-orange-50";
    textClass = "text-orange-700";
  } else if (days <= 3) {
    rowClass = "bg-amber-50";
    textClass = "text-amber-700";
  } else if (days <= 7) {
    rowClass = "bg-yellow-50";
    textClass = "text-yellow-700";
  } else {
    rowClass = "bg-green-50";
    textClass = "text-green-700";
  }

  return { days, rowClass, textClass };
}

function compareByDueDate(a: SerializableTask, b: SerializableTask) {
  const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
  return aTime - bTime;
}

export function TaskTable({ tasks, users, onEdit, onDelete }: TaskTableProps) {
  const sortedTasks = [...tasks].sort(compareByDueDate);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Assignee</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedTasks.map((task) => {
          const dueMeta = getDueMeta(task.dueDate);
          const assignee = users.find(u => u.id === task.assigneeId);
          return (
            <TableRow key={task.id} className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", dueMeta.rowClass)}>
              <TableCell>{task.title}</TableCell>
              <TableCell>{assignee ? assignee.name : "Unassigned"}</TableCell>
              <TableCell><Badge variant="outline">{task.status}</Badge></TableCell>
              <TableCell><TaskPriorityBadge priority={task.priority as any} /></TableCell>
              <TableCell>
                {task.dueDate ? (
                  <span className={dueMeta.textClass}>{format(new Date(task.dueDate), "MMM d, yyyy")}</span>
                ) : (
                  <span className="text-muted-foreground">N/A</span>
                )}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button size="sm" variant="secondary" onClick={() => onEdit(task)}>Edit</Button>
                {onDelete && (
                  <Button size="sm" variant="destructive" onClick={() => onDelete(task)}>Delete</Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
