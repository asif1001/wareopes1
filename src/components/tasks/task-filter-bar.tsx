"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ListFilter, Search, X } from "lucide-react";
import type { SerializableTask, SerializableUserProfile } from "@/lib/task-types";

export type TaskFilterBarProps = {
  tasks: SerializableTask[];
  users: SerializableUserProfile[];
  onFilteredTasksChange: (filtered: SerializableTask[]) => void;
};

const STATUS_OPTIONS: string[] = [
  "Backlog",
  "To Do",
  "In Progress",
  "Blocked",
  "On Hold",
  "Review",
  "Done",
];

const PRIORITY_OPTIONS: string[] = ["No Priority", "Low", "Medium", "High", "Urgent"];

export function TaskFilterBar({ tasks, users, onFilteredTasksChange }: TaskFilterBarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<string[]>([]); // user ids
  const [open, setOpen] = useState(false);

  const userIdToName = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(u => map.set(u.id, u.name));
    return map;
  }, [users]);

  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => { if (t.assigneeId) set.add(t.assigneeId); });
    return Array.from(set);
  }, [tasks]);

  useEffect(() => {
    const filtered = tasks.filter(t => {
      // Search across title, description, labels, assignee name, reporter name
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const assigneeName = t.assigneeId ? (userIdToName.get(t.assigneeId) || "") : "";
        const reporterName = t.reporterId ? (userIdToName.get(t.reporterId) || "") : "";
        const labels = Array.isArray(t.labels) ? t.labels : [];
        const matches =
          (t.title || "").toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          assigneeName.toLowerCase().includes(q) ||
          reporterName.toLowerCase().includes(q) ||
          labels.some(l => (l || "").toLowerCase().includes(q));
        if (!matches) return false;
      }

      if (statuses.length > 0 && !statuses.includes(t.status)) return false;
      if (priorities.length > 0 && !priorities.includes(t.priority)) return false;
      if (assignees.length > 0) {
        const id = t.assigneeId || "";
        if (!assignees.includes(id)) return false;
      }
      return true;
    });
    onFilteredTasksChange(filtered);
  }, [tasks, searchQuery, statuses, priorities, assignees, userIdToName, onFilteredTasksChange]);

  const toggleArrayValue = (value: string, list: string[], setList: (next: string[]) => void) => {
    const next = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
    setList(next);
  };

  const activeFilterCount = (searchQuery ? 1 : 0)
    + (statuses.length > 0 ? 1 : 0)
    + (priorities.length > 0 ? 1 : 0)
    + (assignees.length > 0 ? 1 : 0);

  const clearAll = () => {
    setSearchQuery("");
    setStatuses([]);
    setPriorities([]);
    setAssignees([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, description, labels, people…"
            className="pl-10"
          />
        </div>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <ListFilter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filters</h4>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAll}>Clear All</Button>
                )}
              </div>
              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map(s => (
                    <div key={s} className="flex items-center space-x-2">
                      <Checkbox id={`status-${s}`} checked={statuses.includes(s)} onCheckedChange={() => toggleArrayValue(s, statuses, setStatuses)} />
                      <Label htmlFor={`status-${s}`} className="text-xs">{s}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Priority</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITY_OPTIONS.map(p => (
                    <div key={p} className="flex items-center space-x-2">
                      <Checkbox id={`priority-${p}`} checked={priorities.includes(p)} onCheckedChange={() => toggleArrayValue(p, priorities, setPriorities)} />
                      <Label htmlFor={`priority-${p}`} className="text-xs">{p}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Assignee</Label>
                <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                  {uniqueAssignees.map(uid => (
                    <div key={uid} className="flex items-center space-x-2">
                      <Checkbox id={`assignee-${uid}`} checked={assignees.includes(uid)} onCheckedChange={() => toggleArrayValue(uid, assignees, setAssignees)} />
                      <Label htmlFor={`assignee-${uid}`} className="text-xs">{userIdToName.get(uid) || uid}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {searchQuery}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
            </Badge>
          )}
          {statuses.map(s => (
            <Badge key={s} variant="secondary" className="gap-1">
              Status: {s}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setStatuses(prev => prev.filter(x => x !== s))} />
            </Badge>
          ))}
          {priorities.map(p => (
            <Badge key={p} variant="secondary" className="gap-1">
              Priority: {p}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setPriorities(prev => prev.filter(x => x !== p))} />
            </Badge>
          ))}
          {assignees.map(uid => (
            <Badge key={uid} variant="secondary" className="gap-1">
              Assignee: {userIdToName.get(uid) || uid}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setAssignees(prev => prev.filter(x => x !== uid))} />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}