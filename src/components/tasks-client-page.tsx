"use client";

import { useState } from "react";
import { ListFilter, PlusCircle, LayoutGrid, List, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardHeader } from "@/components/dashboard-header";
import { SerializableTask, SerializableUserProfile } from "@/lib/task-types";
import { TaskTable } from "./tasks/task-table";
import { TaskKanban } from "./tasks/task-kanban";
import { TaskCalendar } from "./tasks/task-calendar";
import { TaskModal } from "./tasks/task-modal";
import { TaskFilterBar } from "./tasks/task-filter-bar";

type TasksClientPageProps = {
    initialTasks: SerializableTask[];
    users: SerializableUserProfile[];
    currentUserId: string;
};

type View = "table" | "kanban" | "calendar";

export function TasksClientPage({ initialTasks, users, currentUserId }: TasksClientPageProps) {
    const [tasks, setTasks] = useState<SerializableTask[]>(initialTasks);
    const [filteredTasks, setFilteredTasks] = useState<SerializableTask[]>(initialTasks);
    const [view, setView] = useState<View>("table");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<SerializableTask | null>(null);

    const openModal = (task: SerializableTask | null = null) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedTask(null);
    };

    const refreshTasks = async () => {
        try {
            const response = await fetch('/api/tasks');
            if (response.ok) {
                const updatedTasks = await response.json();
                setTasks(updatedTasks);
            }
        } catch (error) {
            console.error('Failed to refresh tasks:', error);
        }
    };

    const myTasks = filteredTasks.filter(task => task.assigneeId === currentUserId || task.reporterId === currentUserId);

    return (
        <div className="flex flex-col h-full">
            <DashboardHeader title="Tasks">
                <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" className="h-8 gap-1" onClick={() => openModal()} data-testid="add-task">
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                            Add Task
                        </span>
                    </Button>
                </div>
            </DashboardHeader>
            <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
                <Tabs defaultValue="all">
                    <div className="flex items-center">
                        <TabsList>
                            <TabsTrigger value="all">All Tasks</TabsTrigger>
                            <TabsTrigger value="my-tasks">My Tasks</TabsTrigger>
                        </TabsList>
                        <div className="ml-auto flex items-center gap-2">
                            {/* Filter bar replaces dropdown menu */}
                            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
                                <Button variant={view === 'table' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setView('table')} data-testid="view-table">
                                    <List className="h-4 w-4" />
                                </Button>
                                <Button variant={view === 'kanban' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setView('kanban')} data-testid="view-kanban">
                                    <LayoutGrid className="h-4 w-4" />
                                </Button>
                                <Button variant={view === 'calendar' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setView('calendar')} data-testid="view-calendar">
                                    <Calendar className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3">
                        <TaskFilterBar tasks={tasks} users={users} onFilteredTasksChange={setFilteredTasks} />
                    </div>

                    <TabsContent value="all" className="mt-4">
                        {view === 'table' && <TaskTable tasks={filteredTasks} users={users} onEdit={openModal} onDelete={async (task) => { await fetch(`/api/tasks`, { method: 'DELETE', body: JSON.stringify({ id: task.id }) }); refreshTasks(); }} />}
                        {view === 'kanban' && <TaskKanban tasks={filteredTasks} users={users} onEdit={openModal} />}
                        {view === 'calendar' && <TaskCalendar tasks={filteredTasks} users={users} onEdit={openModal} />}
                    </TabsContent>
                    <TabsContent value="my-tasks" className="mt-4">
                        {view === 'table' && <TaskTable tasks={myTasks} users={users} onEdit={openModal} onDelete={async (task) => { await fetch(`/api/tasks`, { method: 'DELETE', body: JSON.stringify({ id: task.id }) }); refreshTasks(); }} />}
                        {view === 'kanban' && <TaskKanban tasks={myTasks} users={users} onEdit={openModal} />}
                        {view === 'calendar' && <TaskCalendar tasks={myTasks} users={users} onEdit={openModal} />}
                    </TabsContent>
                </Tabs>
            </main>
            <TaskModal isOpen={isModalOpen} onClose={closeModal} task={selectedTask} users={users} currentUserId={currentUserId} onTaskSaved={refreshTasks} />
        </div>
    );
}
