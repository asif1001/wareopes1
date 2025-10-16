import { makeSerializable } from "@/lib/serialization";
import { TasksClientPage } from "@/components/tasks-client-page";
import { SerializableTask, SerializableUserProfile } from "@/lib/task-types";
import { getUsers as getUsersFromFirestore } from "@/lib/firebase/firestore";

async function getTasks(): Promise<SerializableTask[]> {
    // Use Admin SDK on the server so server components can read without
    // being blocked by Firestore security rules. Avoid importing client
    // Firestore at module top-level to prevent the client SDK from being
    // initialized during server rendering which can trigger permission
    // errors or bundling of server-only code.
    if (typeof window === 'undefined') {
        const { getAdminDb } = await import('@/lib/firebase/admin');
        const adb = await getAdminDb();
        const snap = await adb.collection('tasks').get();
        return snap.docs.map((d: any) => makeSerializable({ id: d.id, ...(d.data ? d.data() : d) } as any));
    }

    // Client-side fallback: dynamically import client Firestore only when running in browser
    const [{ collection, getDocs }, { db }] = await Promise.all([
        import('firebase/firestore'),
        import('@/lib/firebase/firebase')
    ] as any);
    const tasksCol = collection(db, 'tasks');
    const taskSnapshot = await getDocs(tasksCol);
    return taskSnapshot.docs.map((doc: any) => makeSerializable({ ...doc.data(), id: doc.id }));
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
    const tasks = await getTasks();
    const users = await getUsers();
    // This is a placeholder for the actual current user ID from an auth provider
    const currentUserId = "user1"; 

    return <TasksClientPage initialTasks={tasks} users={users} currentUserId={currentUserId} />;
}
