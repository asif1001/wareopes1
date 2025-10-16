"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SerializableAuditLog, SerializableComment, SerializableUserProfile } from "@/lib/task-types";
import { formatDistanceToNow } from "date-fns";

type HistoryAndCommentsProps = {
    history?: SerializableAuditLog[];
    comments?: SerializableComment[];
    users: SerializableUserProfile[];
};

// Define a combined item type that includes the 'type' discriminator
type CombinedItem = (SerializableAuditLog & { type: 'history' }) | (SerializableComment & { type: 'comment' });

// This is a type guard function. It's a standard TypeScript pattern
// to help the compiler narrow down a union type.
function isComment(item: CombinedItem): item is SerializableComment & { type: 'comment' } {
    return item.type === 'comment';
}

function HistoryItem({ item, user }: { item: CombinedItem, user: SerializableUserProfile | null }) {
    // Based on the type, we can safely access properties.
    if (isComment(item)) {
        // TypeScript now knows `item` is a comment.
        return (
            <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatarUrl} />
                    <AvatarFallback>{user?.name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-sm">
                    <p>
                        <span className="font-semibold">{user?.name || 'Unknown User'}</span>
                        <span className="text-muted-foreground ml-2">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </span>
                    </p>
                    <div className="mt-1 p-2 rounded-md bg-muted">
                        <p className="whitespace-pre-wrap">{item.text}</p>
                    </div>
                </div>
            </div>
        );
    } else {
        // TypeScript knows `item` is a history log.
        return (
            <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatarUrl} />
                    <AvatarFallback>{user?.name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-sm">
                    <p>
                        <span className="font-semibold">{user?.name || 'Unknown User'}</span>
                        <span className="text-muted-foreground ml-2">
                            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                        </span>
                    </p>
                    <div className="mt-1">
                        <p>{item.action}</p>
                    </div>
                </div>
            </div>
        );
    }
}

export function HistoryAndComments({ history = [], comments = [], users }: HistoryAndCommentsProps) {
    const combined: CombinedItem[] = [
        ...history.map(item => ({ ...item, type: 'history' as const })),
        ...comments.map(item => ({ ...item, type: 'comment' as const }))
    ].sort((a, b) => {
        const dateA = new Date(isComment(a) ? a.createdAt : a.timestamp);
        const dateB = new Date(isComment(b) ? b.createdAt : b.timestamp);
        return dateB.getTime() - dateA.getTime();
    });

    if (combined.length === 0) {
        return <div className="text-center text-sm text-muted-foreground py-4">No activity yet.</div>;
    }

    return (
        <div className="space-y-6">
            {combined.map((item) => {
                // Use the type guard to safely access the correct user ID property.
                const userId = isComment(item) ? item.createdBy : item.userId;
                const user = users.find(u => u.id === userId);
                return <HistoryItem key={item.id} item={item} user={user || null} />;
            })}
        </div>
    );
}
