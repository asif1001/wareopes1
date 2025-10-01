import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/types";

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

const getStatusVariant = (status: TaskStatus) => {
  switch (status) {
    case 'Completed':
    case 'Done':
      return 'default';
    case 'In Progress':
      return 'secondary';
    case 'Blocked':
      return 'destructive';
    case 'To Do':
    case 'Not Started':
      return 'outline';
    case 'On Hold':
      return 'secondary';
    default:
      return 'default';
  }
};

const getStatusColor = (status: TaskStatus) => {
  switch (status) {
    case 'Completed':
    case 'Done':
      return 'text-green-700 bg-green-100 border-green-200';
    case 'In Progress':
      return 'text-blue-700 bg-blue-100 border-blue-200';
    case 'Blocked':
      return 'text-red-700 bg-red-100 border-red-200';
    case 'To Do':
    case 'Not Started':
      return 'text-gray-700 bg-gray-100 border-gray-200';
    case 'On Hold':
      return 'text-yellow-700 bg-yellow-100 border-yellow-200';
    default:
      return 'text-gray-700 bg-gray-100 border-gray-200';
  }
};

export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  return (
    <Badge 
      variant={getStatusVariant(status)} 
      className={cn(getStatusColor(status), className)}
    >
      {status}
    </Badge>
  );
}