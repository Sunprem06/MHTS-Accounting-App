import { useEffect, useState } from 'react';
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
    <div>
      {Array.from(groups.entries()).map(([module, perms]) => (
        <div key={module} style={{ marginBottom: 8 }}>
          <strong>{module}</strong>
          <div>
            {perms.map((permission) => (
              <label key={permission.code} style={{ display: 'block', fontSize: 13 }}>
                <input type="checkbox" checked={selected.has(permission.code)} disabled={disabled} onChange={(e) => onChange(permission.code, e.target.checked)} />{' '}
                {permission.code} — {permission.description}
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
    <div style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720 }}>
      <h1>Manage roles</h1>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {roles === null ? (
        <p>Loading…</p>
      ) : (
        <div style={{ marginBottom: 24 }}>
          {roles.map((role) => (
            <div key={role.id} style={{ padding: 12, marginBottom: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4 }}>
              <strong>{role.name}</strong> {role.isSystemRole && <em>(built-in, not editable)</em>}
              {editingRoleId === role.id ? (
                <>
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
                  <button type="button" onClick={handleSaveEdit} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>{' '}
                  <button type="button" onClick={() => setEditingRoleId(null)} disabled={saving}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13 }}>{role.permissionCodes.length > 0 ? role.permissionCodes.join(', ') : 'No permissions'}</p>
                  {!role.isSystemRole && (
                    <button type="button" onClick={() => startEditing(role)}>
                      Edit permissions
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleCreateRole}>
        <h2>New role</h2>
        <label>
          Name
          <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} required />
        </label>
        <div style={{ marginTop: 8 }}>
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
        </div>
        <button type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create role'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        <button type="button" onClick={onBack}>
          Back to dashboard
        </button>
      </p>
    </div>
  );
}
