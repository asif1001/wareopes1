"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ACTION_HELP, ACTION_LABELS, MODULES, PERMISSION_ACTIONS, type ModuleDef, type ModuleKey, type PermissionAction } from "@/lib/permissions/registry";
import type { PermissionMap } from "@/lib/permissions/resolve";
import {
  setRolePermissionsAction,
  setUserPermissionsAction,
  type AccessRoleRow,
  type AccessUserRow,
} from "@/app/dashboard/settings/access-actions";
import type { AccessAuditEntry } from "@/lib/permissions/audit";

type Props = {
  roles: AccessRoleRow[];
  users: AccessUserRow[];
  audit: (AccessAuditEntry & { id: string })[];
  currentUserId: string;
};

const sameMap = (a: PermissionMap, b: PermissionMap) =>
  MODULES.every((m) => {
    const x = a[m.key];
    const y = b[m.key];
    if (x === undefined || y === undefined) return x === y;
    return x.length === y.length && x.every((v) => y.includes(v));
  });

function ordered(actions: Iterable<PermissionAction>) {
  const set = new Set(actions);
  return PERMISSION_ACTIONS.filter((a) => set.has(a));
}

function levelLabel(module: ModuleDef, actions: PermissionAction[] | undefined) {
  if (!actions?.length) return "No access";
  if (module.actions.every((a) => actions.includes(a))) return "Full";
  if (actions.length === 1 && actions[0] === "view") return "View only";
  return actions.map((a) => ACTION_LABELS[a]).join(", ");
}

function ModuleCell({ module }: { module: ModuleDef }) {
  return (
    <div className="min-w-[180px]">
      <div className="flex items-center gap-2 font-medium">
        {module.label}
        {module.isNew && <Badge variant="secondary">New</Badge>}
      </div>
      <div className="text-xs text-muted-foreground">{module.description}</div>
    </div>
  );
}

function ActionHeaders() {
  return (
    <>
      {PERMISSION_ACTIONS.map((a) => (
        <TableHead key={a} className="text-center" title={ACTION_HELP[a]}>
          {ACTION_LABELS[a]}
        </TableHead>
      ))}
    </>
  );
}

function ActionCells({
  module,
  value,
  disabled,
  onToggle,
}: {
  module: ModuleDef;
  value: PermissionAction[] | undefined;
  disabled?: boolean;
  onToggle: (action: PermissionAction, on: boolean) => void;
}) {
  return (
    <>
      {PERMISSION_ACTIONS.map((a) => (
        <TableCell key={a} className="text-center">
          {module.actions.includes(a) ? (
            <Checkbox
              checked={!!value?.includes(a)}
              disabled={disabled}
              aria-label={`${module.label} ${ACTION_LABELS[a]}`}
              onCheckedChange={(on) => onToggle(a, on === true)}
            />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      ))}
    </>
  );
}

/** Toggling an action on also grants View; removing View removes everything. */
function toggle(module: ModuleDef, current: PermissionAction[] | undefined, action: PermissionAction, on: boolean) {
  const set = new Set(current ?? []);
  if (on) {
    set.add(action);
    if (module.actions.includes("view")) set.add("view");
  } else if (action === "view") {
    set.clear();
  } else {
    set.delete(action);
  }
  return ordered(set);
}

function Shortcuts({ module, disabled, onSet }: { module: ModuleDef; disabled?: boolean; onSet: (actions: PermissionAction[]) => void }) {
  return (
    <div className="flex gap-1">
      <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onSet([])}>
        None
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onSet(["view"])}>
        View
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => onSet([...module.actions])}>
        Full
      </Button>
    </div>
  );
}

function RolesTab({ roles }: { roles: AccessRoleRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const editable = roles.filter((r) => !r.isAdmin);
  const [roleId, setRoleId] = useState(editable[0]?.id ?? roles[0]?.id ?? "");
  const role = roles.find((r) => r.id === roleId);
  const [draft, setDraft] = useState<PermissionMap>(role?.permissions ?? {});

  useEffect(() => {
    setDraft(role?.permissions ?? {});
  }, [role]);

  if (!roles.length) return <p className="text-sm text-muted-foreground">No roles yet. Create one in the Roles tab.</p>;
  const dirty = !!role && !sameMap(draft, role.permissions);

  const save = () =>
    start(async () => {
      const res = await setRolePermissionsAction(roleId, draft as Record<string, PermissionAction[]>);
      if (res.success) {
        toast({ title: "Role permissions saved", description: `${role?.name}: applies to ${role?.userCount ?? 0} user(s) immediately.` });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Not saved", description: res.error });
      }
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Role</div>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({r.userCount} user{r.userCount === 1 ? "" : "s"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!role?.isAdmin && (
          <div className="flex gap-2">
            <Button onClick={save} disabled={!dirty || pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save role
            </Button>
            <Button variant="outline" onClick={() => setDraft(role?.permissions ?? {})} disabled={!dirty || pending}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Discard
            </Button>
          </div>
        )}
      </div>

      {role?.isAdmin ? (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Admin has full access</AlertTitle>
          <AlertDescription>The Admin role can use every page and action, including new ones. It cannot be restricted.</AlertDescription>
        </Alert>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <ActionHeaders />
                <TableHead>Quick set</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULES.map((m) => (
                <TableRow key={m.key}>
                  <TableCell>
                    <ModuleCell module={m} />
                  </TableCell>
                  <ActionCells
                    module={m}
                    value={draft[m.key]}
                    disabled={pending}
                    onToggle={(a, on) => setDraft((d) => ({ ...d, [m.key]: toggle(m, d[m.key], a, on) }))}
                  />
                  <TableCell>
                    <Shortcuts module={m} disabled={pending} onSet={(actions) => setDraft((d) => ({ ...d, [m.key]: actions }))} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function UsersTab({ users, roles, currentUserId }: { users: AccessUserRow[]; roles: AccessRoleRow[]; currentUserId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState(users.find((u) => !u.isAdmin && u.id !== currentUserId)?.id ?? users[0]?.id ?? "");
  const user = users.find((u) => u.id === userId);
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.name, r.permissions])), [roles]);
  const rolePerms = (user && roleMap.get(user.role)) || {};

  const initial = useMemo<PermissionMap>(() => user?.overrides ?? {}, [user]);
  const [draft, setDraft] = useState<PermissionMap>(initial);
  useEffect(() => setDraft(initial), [initial]);

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    return !q || u.name.toLowerCase().includes(q) || u.employeeNo.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const locked = !user || user.isAdmin || user.id === currentUserId;
  const dirty = !!user && (user.legacy || !sameMap(draft, initial));

  const save = () =>
    start(async () => {
      if (!user) return;
      const res = await setUserPermissionsAction(user.id, draft as Record<string, PermissionAction[]>);
      if (res.success) {
        toast({ title: "Permissions saved", description: `${user.name} gets the new access on their next page load.` });
        router.refresh();
      } else {
        toast({ variant: "destructive", title: "Not saved", description: res.error });
      }
    });

  const setCustom = (key: ModuleKey, custom: boolean) =>
    setDraft((d) => {
      const next = { ...d };
      if (custom) next[key] = [...(rolePerms[key] ?? [])];
      else delete next[key];
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Find user</div>
          <Input placeholder="Name, employee no. or role" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">User</div>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-80">
              <SelectValue placeholder="Choose a user" />
            </SelectTrigger>
            <SelectContent>
              {filtered.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} {u.employeeNo ? `(${u.employeeNo})` : ""} — {u.role || "no role"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!locked && (
          <div className="flex gap-2">
            <Button onClick={save} disabled={!dirty || pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save user
            </Button>
            <Button variant="outline" onClick={() => setDraft(initial)} disabled={!dirty || pending}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Discard
            </Button>
            <Button variant="outline" onClick={() => setDraft({})} disabled={pending || !Object.keys(draft).length}>
              Use role for everything
            </Button>
          </div>
        )}
      </div>

      {user?.isAdmin && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Admin has full access</AlertTitle>
          <AlertDescription>To restrict this person, first change their role in the User tab.</AlertDescription>
        </Alert>
      )}
      {user && !user.isAdmin && user.id === currentUserId && (
        <Alert>
          <AlertTitle>This is your own account</AlertTitle>
          <AlertDescription>You cannot change your own permissions. Another admin has to do it.</AlertDescription>
        </Alert>
      )}
      {user && user.legacy && !user.isAdmin && (
        <Alert>
          <AlertTitle>Older permission record</AlertTitle>
          <AlertDescription>
            This user&apos;s permissions were saved before Access control and replace the role completely, so every module shows as Custom.
            Switch modules back to &quot;Role&quot; where the role should apply, then save.
          </AlertDescription>
        </Alert>
      )}

      {user && !user.isAdmin && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Access from</TableHead>
                <ActionHeaders />
                <TableHead>Effective access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODULES.map((m) => {
                const custom = draft[m.key];
                const isCustom = custom !== undefined;
                const effective = isCustom ? custom : rolePerms[m.key];
                return (
                  <TableRow key={m.key}>
                    <TableCell>
                      <ModuleCell module={m} />
                    </TableCell>
                    <TableCell>
                      <Select value={isCustom ? "custom" : "role"} onValueChange={(v) => setCustom(m.key, v === "custom")} disabled={locked || pending}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="role">Role ({user.role || "none"})</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <ActionCells
                      module={m}
                      value={effective}
                      disabled={locked || pending || !isCustom}
                      onToggle={(a, on) => setDraft((d) => ({ ...d, [m.key]: toggle(m, d[m.key], a, on) }))}
                    />
                    <TableCell>
                      <Badge variant={effective?.length ? (isCustom ? "default" : "secondary") : "outline"}>{levelLabel(m, effective)}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

const AUDIT_LABELS: Record<AccessAuditEntry["action"], string> = {
  ROLE_CREATED: "Role created",
  ROLE_DELETED: "Role deleted",
  ROLE_PERMISSIONS_CHANGED: "Role permissions changed",
  USER_PERMISSIONS_CHANGED: "User permissions changed",
  USER_ROLE_CHANGED: "User role changed",
  USER_CREATED: "User created",
  USER_DELETED: "User deleted",
  MIGRATION: "Migration",
};

function flatten(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    const map = (v.overrides ?? v) as Record<string, unknown>;
    const out: string[] = [];
    for (const [k, actions] of Object.entries(map)) {
      if (!Array.isArray(actions)) return null;
      if (!actions.length) out.push(`${k}:none`);
      for (const a of actions) out.push(`${k}:${a}`);
    }
    return out;
  }
  return null;
}

function describeChange(entry: AccessAuditEntry) {
  const before = flatten(entry.before);
  const after = flatten(entry.after);
  if (before && after) {
    const added = after.filter((x) => !before.includes(x));
    const removed = before.filter((x) => !after.includes(x));
    if (!added.length && !removed.length) return "No change";
    return [added.length ? `+ ${added.join(", ")}` : "", removed.length ? `− ${removed.join(", ")}` : ""].filter(Boolean).join("  ");
  }
  const show = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v));
  return `${show(entry.before)} → ${show(entry.after)}`;
}

function AuditTab({ audit }: { audit: (AccessAuditEntry & { id: string })[] }) {
  if (!audit.length) return <p className="text-sm text-muted-foreground">No access changes recorded yet.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>By</TableHead>
            <TableHead>What</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {audit.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap">{new Date(e.at).toLocaleString()}</TableCell>
              <TableCell>{e.byName}</TableCell>
              <TableCell>{AUDIT_LABELS[e.action] ?? e.action}</TableCell>
              <TableCell>
                {e.targetName} <span className="text-xs text-muted-foreground">({e.targetType})</span>
              </TableCell>
              <TableCell className="max-w-[480px] break-words font-mono text-xs">{describeChange(e)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AccessControlPanel({ roles, users, audit, currentUserId }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Access control</CardTitle>
        <CardDescription>
          Each user gets their role&apos;s access. Set a module to Custom on a user to override just that module. New modules start with no
          access until you grant them. Only admins can see this tab; every change is logged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="roles">
          <TabsList>
            <TabsTrigger value="roles">Role permissions</TabsTrigger>
            <TabsTrigger value="users">User permissions</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          </TabsList>
          <TabsContent value="roles" className="pt-4">
            <RolesTab roles={roles} />
          </TabsContent>
          <TabsContent value="users" className="pt-4">
            <UsersTab users={users} roles={roles} currentUserId={currentUserId} />
          </TabsContent>
          <TabsContent value="audit" className="pt-4">
            <AuditTab audit={audit} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
