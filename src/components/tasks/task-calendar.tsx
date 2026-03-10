"use client";

import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { SerializableTask, SerializableUserProfile, TaskStatus } from "@/lib/task-types";
import { EventClickArg } from "@fullcalendar/core";

type TaskCalendarProps = {
    tasks: SerializableTask[];
    users: SerializableUserProfile[];
    onEdit: (task: SerializableTask) => void;
};

export function TaskCalendar({ tasks, onEdit }: TaskCalendarProps) {
    const events = tasks.map(task => ({
        id: task.id,
        title: task.title,
        start: task.startDate ? new Date(task.startDate) : undefined,
        end: task.dueDate ? new Date(task.dueDate) : undefined,
        allDay: !task.startDate, // Assume all-day if no start date
        extendedProps: {
            ...task
        },
        backgroundColor: getStatusColor(task.status),
        borderColor: getStatusColor(task.status),
    }));

    const handleEventClick = (clickInfo: EventClickArg) => {
        onEdit(clickInfo.event.extendedProps.task);
    };

    return (
        <div className="h-[800px] calendar-container">
            <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                initialView="dayGridMonth"
                events={events}
                eventClick={handleEventClick}
                editable={true}
                selectable={true}
                selectMirror={true}
                dayMaxEvents={true}
            />
        </div>
    );
}

function getStatusColor(status: string) {
    switch (status) {
        case "Done": return "#10B981"; // Green
        case "In Progress": return "#3B82F6"; // Blue
        case "Blocked": return "#EF4444"; // Red
        case "Review": return "#F59E0B"; // Amber
        case "To Do": return "#6B7280"; // Gray
        default: return "#A1A1AA"; // Zinc
    }
}
