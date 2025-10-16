import { makeSerializable } from "@/lib/serialization";
import { TasksClientPage } from "@/components/tasks-client-page";
import { SerializableTask, SerializableUserProfile } from "@/lib/task-types";
import { getUsers as getUsersFromFirestore } from "@/lib/firebase/firestore";
import { cookies } from 'next/headers';

async function getTasksForUser(userId: string): Promise<SerializableTask[]> {
    // Server-side: use Admin SDK and restrict to reporterId or assigneeId matching userId
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    const [reporterSnap, assigneeSnap] = await Promise.all([
        adb.collection('tasks').where('reporterId', '==', userId).get(),
        adb.collection('tasks').where('assigneeId', '==', userId).get(),
    ]);
    const seen = new Set<string>();
    const tasks: SerializableTask[] = [] as any;
    for (const d of reporterSnap.docs) {
        if (!seen.has(d.id)) {
            seen.add(d.id);
            const raw = d.data ? d.data() : {};
            const { id: _discard, ...dataNoId } = raw as any;
            tasks.push(makeSerializable({ id: d.id, ...dataNoId } as any));
        }
    }
    for (const d of assigneeSnap.docs) {
        if (!seen.has(d.id)) {
            seen.add(d.id);
            const raw = d.data ? d.data() : {};
            const { id: _discard, ...dataNoId } = raw as any;
            tasks.push(makeSerializable({ id: d.id, ...dataNoId } as any));
        }
    }
    return tasks;
}

async function getUsers(): Promise<SerializableUserProfile[]> {
    const users = await getUsersFromFirestore();
    return users.map(user => makeSerializable({
        id: user.id,
        name: user.fullName,
        avatarUrl: 'https://github.com/shadcn.png' // Default avatar
    }));
}

export default async function TasksPage() {
    const session = (await cookies()).get('session');
    const currentUserId = session?.value || '';
    const tasks = currentUserId ? await getTasksForUser(currentUserId) : [];
    const users = await getUsers();

    return <TasksClientPage initialTasks={tasks} users={users} currentUserId={currentUserId} />;
}
