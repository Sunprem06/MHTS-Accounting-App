import { useEffect, useState } from 'react';
import { ArrowLeft, Shield } from 'lucide-react';
import type { PermissionSummary, RoleWithPermissionsSummary } from '../../../shared/ipc';

interface Props {
  onBack: () => void;
}

function groupByModule(permissions: PermissionSummary[]): Map<string, PermissionSummary[]> {
  const groups = new Map<string, PermissionSummary[]>();
  for (const permission of permissions) {
    const module = permission.code.split('.')[0];
    const list = groups.get(module) ?? [];
    list.push(permission);
    groups.set(module, list);
  }
  return groups;
}

function PermissionChecklist({
  permissions,
  selected,
  onChange,
  disabled,
}: {
  permissions: PermissionSummary[];
  selected: Set<string>;
  onChange: (code: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  const groups = groupByModule(permissions);
  return (
    <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10 }}>
      {Array.from(groups.entries()).map(([module, perms]) => (
        <div key={module} style={{ marginBottom: 10 }}>
          <strong style={{ fontSize: 13 }}>{module}</strong>
          <div>
            {perms.map((permission) => (
              <label key={permission.code} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, padding: '2px 0' }}>
                <input type="checkbox" checked={selected.has(permission.code)} disabled={disabled} onChange={(e) => onChange(permission.code, e.target.checked)} />
                <span>
                  {permission.code} — {permission.description}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ManageRolesScreen({ onBack }: Props) {
  const [permissions, setPermissions] = useState<PermissionSummary[]>([]);
  const [roles, setRoles] = useState<RoleWithPermissionsSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const [permsResult, rolesResult] = await Promise.all([window.mhts.listAllPermissions(), window.mhts.listRolesWithPermissions()]);
    if (permsResult.ok && permsResult.data) {
      setPermissions(permsResult.data);
    }
    if (rolesResult.ok && rolesResult.data) {
      setRoles(rolesResult.data);
    } else {
      setError(rolesResult.error ?? 'Failed to load roles');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const result = await window.mhts.createRole({ name: newRoleName, permissionCodes: Array.from(newRolePermissions) });
    setCreating(false);
    if (result.ok) {
      setNewRoleName('');
      setNewRolePermissions(new Set());
      await refresh();
    } else {
      setError(result.error ?? 'Failed to create role');
    }
  }

  function startEditing(role: RoleWithPermissionsSummary) {
    setEditingRoleId(role.id);
    setEditingPermissions(new Set(role.permissionCodes));
  }

  async function handleSaveEdit() {
    if (!editingRoleId) return;
    setError(null);
    setSaving(true);
    const result = await window.mhts.updateRolePermissions({ roleId: editingRoleId, permissionCodes: Array.from(editingPermissions) });
    setSaving(false);
    if (result.ok) {
      setEditingRoleId(null);
      await refresh();
    } else {
      setError(result.error ?? 'Failed to save role permissions');
    }
  }

  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <div className="page-header">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>
          <Shield size={18} style={{ color: 'var(--accent)' }} /> Manage roles
        </h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      {roles === null ? (
        <div className="card">
          <p className="empty-state">Loading…</p>
        </div>
      ) : (
        roles.map((role) => (
          <div key={role.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>{role.name}</strong>
              {role.isSystemRole && <span className="badge badge-muted">Built-in, not editable</span>}
            </div>
            {editingRoleId === role.id ? (
              <>
                <div style={{ marginTop: 10 }}>
                  <PermissionChecklist
                    permissions={permissions}
                    selected={editingPermissions}
                    onChange={(code, checked) =>
                      setEditingPermissions((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(code);
                        else next.delete(code);
                        return next;
                      })
                    }
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-primary" onClick={handleSaveEdit} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setEditingRoleId(null)} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{role.permissionCodes.length > 0 ? role.permissionCodes.join(', ') : 'No permissions'}</p>
                {!role.isSystemRole && (
                  <button type="button" onClick={() => startEditing(role)}>
                    Edit permissions
                  </button>
                )}
              </>
            )}
          </div>
        ))
      )}

      <form onSubmit={handleCreateRole} className="card">
        <h2>New role</h2>
        <label className="field" style={{ maxWidth: 320 }}>
          Name
          <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} required />
        </label>
        <PermissionChecklist
          permissions={permissions}
          selected={newRolePermissions}
          onChange={(code, checked) =>
            setNewRolePermissions((prev) => {
              const next = new Set(prev);
              if (checked) next.add(code);
              else next.delete(code);
              return next;
            })
          }
        />
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create role'}
          </button>
        </div>
      </form>
    </div>
  );
}
