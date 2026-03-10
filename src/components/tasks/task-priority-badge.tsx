import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
type AnyPriority = string;

interface TaskPriorityBadgeProps {
  priority: AnyPriority;
  className?: string;
}

const getPriorityVariant = (priority: AnyPriority) => {
  switch (priority) {
    case 'Urgent':
    case 'Critical':
      return 'destructive';
    case 'High':
      return 'destructive';
    case 'Medium':
      return 'secondary';
    case 'Low':
      return 'outline';
    case 'No Priority':
    default:
      return 'default';
  }
};

const getPriorityColor = (priority: AnyPriority) => {
  switch (priority) {
    case 'Urgent':
    case 'Critical':
      return 'text-red-800 bg-red-200 border-red-300';
    case 'High':
      return 'text-red-700 bg-red-100 border-red-200';
    case 'Medium':
      return 'text-yellow-700 bg-yellow-100 border-yellow-200';
    case 'Low':
      return 'text-green-700 bg-green-100 border-green-200';
    case 'No Priority':
    default:
      return 'text-gray-700 bg-gray-100 border-gray-200';
  }
};

const getPriorityIcon = (priority: AnyPriority) => {
  return (
    <div className={cn(
      "w-2 h-2 rounded-full mr-1",
      (priority === 'Urgent' || priority === 'Critical') && "bg-red-600",
      priority === 'High' && "bg-red-400",
      priority === 'Medium' && "bg-yellow-400",
      priority === 'Low' && "bg-green-400"
    )} />
  );
};

export function TaskPriorityBadge({ priority, className }: TaskPriorityBadgeProps) {
  return (
    <Badge 
      variant={getPriorityVariant(priority)} 
      className={cn("flex items-center", getPriorityColor(priority), className)}
    >
      {getPriorityIcon(priority)}
      {priority}
    </Badge>
  );
}