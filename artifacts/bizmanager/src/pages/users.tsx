import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { UserCog, Plus, Pencil, Trash2, X, Check } from "lucide-react";

type UserRole = "inputter" | "approver" | "admin";

interface User {
  id: number;
  username: string;
  role: UserRole;
  createdAt: string;
}

const roleBadgeColors: Record<UserRole, string> = {
  admin: "bg-purple-100 text-purple-700",
  approver: "bg-blue-100 text-blue-700",
  inputter: "bg-green-100 text-green-700",
};

function getToken() {
  return localStorage.getItem("biz_auth_token");
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`/api${path}`, { ...opts, headers: { ...authHeaders(), ...(opts.headers as Record<string, string> ?? {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ username: "", password: "", role: "inputter" as UserRole });
  const [editData, setEditData] = useState({ role: "inputter" as UserRole, password: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/users");
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useState(() => { loadUsers(); });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch("/users", { method: "POST", body: JSON.stringify(formData) });
      setShowCreate(false);
      setFormData({ username: "", password: "", role: "inputter" });
      await loadUsers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: number) => {
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, string> = { role: editData.role };
      if (editData.password) body.password = editData.password;
      await apiFetch(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      setEditingId(null);
      await loadUsers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/users/${id}`, { method: "DELETE" });
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete user");
    }
  };

  if (currentUser?.role !== "admin") {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCog className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground">Manage user accounts and roles</p>
          </div>
        </div>
        <button
          onClick={() => { setShowCreate(true); setFormError(null); }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {showCreate && (
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-foreground">New User</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {formError && (
              <div className="sm:col-span-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{formError}</div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">Username</label>
              <input
                required
                minLength={2}
                value={formData.username}
                onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Password</label>
              <input
                required
                minLength={6}
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value as UserRole }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="inputter">Inputter</option>
                <option value="approver">Approver</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="sm:col-span-3 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                <Check className="h-4 w-4" />
                {saving ? "Creating..." : "Create User"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading users...</div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Username</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {u.username}
                    {u.id === currentUser?.userId && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === u.id ? (
                      <select
                        value={editData.role}
                        onChange={(e) => setEditData((p) => ({ ...p, role: e.target.value as UserRole }))}
                        className="rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="inputter">Inputter</option>
                        <option value="approver">Approver</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${roleBadgeColors[u.role]}`}>
                        {u.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {u.id === currentUser?.userId ? null : editingId === u.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <div className="space-y-1">
                          <input
                            type="password"
                            placeholder="New password (optional)"
                            value={editData.password}
                            onChange={(e) => setEditData((p) => ({ ...p, password: e.target.value }))}
                            className="rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring w-44"
                          />
                          {formError && <p className="text-xs text-destructive">{formError}</p>}
                        </div>
                        <button
                          onClick={() => handleUpdate(u.id)}
                          disabled={saving}
                          className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                        >
                          <Check className="h-3 w-3" />
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 rounded border border-input px-2 py-1 text-xs hover:bg-accent"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => { setEditingId(u.id); setEditData({ role: u.role, password: "" }); setFormError(null); }}
                          className="flex items-center gap-1 rounded border border-input px-2 py-1 text-xs hover:bg-accent transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(u.id, u.username)}
                          className="flex items-center gap-1 rounded border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p><span className="font-semibold text-green-700">Inputter</span> — can access Dashboard, POS, Items, Inventory, Customers, and Suppliers.</p>
        <p><span className="font-semibold text-blue-700">Approver</span> — all inputter access plus Invoices, Purchase Orders, and Reports.</p>
        <p><span className="font-semibold text-purple-700">Admin</span> — full access including User Management.</p>
      </div>
    </div>
  );
}
