import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  accessDirectorySchema,
  accessPermissionSchema,
  accessRoleSchema,
  accessUserSchema,
  recordRemovedSchema,
  type AccessDirectory,
  type AccessPermission,
  type AccessPermissionInput,
  type AccessRole,
  type AccessRoleInput,
  type AccessUser,
  type AccessUserInput,
} from '@trim/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type InputHTMLAttributes } from 'react';
import { ApiError, apiGet, apiSend } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import { DeleteRecord, Pager, PAGE_SIZE } from '../records/RecordControls';

const MANAGER_ONLY = 'Only a manager can change users, roles, and permissions.';

export function AccessPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'users' | 'roles' | 'permissions'>('users');
  const access = useQuery({
    queryKey: ['access'],
    queryFn: () => apiGet('/access', accessDirectorySchema),
  });
  const canManage = Boolean(user?.isOrgAdmin);

  return (
    <Box>
      <PageHeader
        kicker="Access"
        title="Users, roles, and permissions"
        lede="Add and change the people who can sign in, the roles they hold, and the permissions those roles grant. The audit log records sign-ins and these changes."
      />
      <Tabs value={tab} onChange={(_event, value: 'users' | 'roles' | 'permissions') => setTab(value)} sx={{ mb: 2 }}>
        <Tab value="users" label="Users" data-testid="access-tab-users" />
        <Tab value="roles" label="Roles" data-testid="access-tab-roles" />
        <Tab value="permissions" label="Permissions" data-testid="access-tab-permissions" />
      </Tabs>
      {!canManage ? <Alert severity="info" sx={{ mb: 2 }}>{MANAGER_ONLY}</Alert> : null}
      {access.isPending ? <Typography>Loading access.</Typography> : null}
      {access.error ? <Alert severity="error">{access.error.message}</Alert> : null}
      {access.data && tab === 'users' ? <UsersTab directory={access.data} canManage={canManage} /> : null}
      {access.data && tab === 'roles' ? <RolesTab directory={access.data} canManage={canManage} /> : null}
      {access.data && tab === 'permissions' ? <PermissionsTab directory={access.data} canManage={canManage} /> : null}
    </Box>
  );
}

function UsersTab({ directory, canManage }: { directory: AccessDirectory; canManage: boolean }) {
  return (
    <Box>
      <Typography variant="h2" sx={{ fontSize: 28, mb: 1.5 }}>
        Users
      </Typography>
      {canManage ? <AddUserForm directory={directory} /> : null}
      <UserTable directory={directory} canManage={canManage} />
      <Typography variant="h2" sx={{ fontSize: 28, mt: 3, mb: 1.5 }}>
        Audit logs
      </Typography>
      <Typography sx={{ mb: 1, color: 'text.secondary' }}>
        Sign-ins and changes to users, roles, and permissions.
      </Typography>
      <AuditTable directory={directory} />
    </Box>
  );
}

function AddUserForm({ directory }: { directory: AccessDirectory }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: AccessUserInput) => apiSend('/access/users', accessUserSchema, body),
    onSuccess: async () => {
      setError(null);
      setMessage('User added.');
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['access'] });
    },
    onError: (caught) => {
      setMessage(null);
      setError(caught instanceof ApiError ? caught.message : 'The user could not be saved.');
    },
  });
  const initial = blankUser(directory);
  return (
    <Box sx={{ mb: 2 }}>
      {open ? (
        <Box sx={{ display: 'grid', gap: 1.5, maxWidth: 560, mb: 2 }}>
          <Typography variant="h3" sx={{ fontSize: 22 }}>
            Add user
          </Typography>
          <UserFields
            directory={directory}
            initial={initial}
            passwordRequired
            pending={save.isPending}
            submitLabel="Add user"
            submitTestId="user-save"
            onSubmit={(body) => save.mutate(body)}
            onCancel={() => setOpen(false)}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Box>
      ) : (
        <Button variant="contained" data-testid="add-user" onClick={() => { setMessage(null); setOpen(true); }}>
          Add user
        </Button>
      )}
      {message ? <Alert sx={{ mt: 2 }} data-testid="user-added">{message}</Alert> : null}
    </Box>
  );
}

function UserTable({ directory, canManage }: { directory: AccessDirectory; canManage: boolean }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(directory.users.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = directory.users.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return (
    <Box data-testid="user-table">
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Facilities</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {slice.map((person) => (
              <UserRow key={person.id} person={person} directory={directory} canManage={canManage} />
            ))}
          </TableBody>
        </Table>
      </Box>
      {directory.users.length === 0 ? <Alert severity="info">No users are recorded.</Alert> : null}
      <Pager page={safePage} pageCount={pageCount} total={directory.users.length} onPage={setPage} />
    </Box>
  );
}

function UserRow({
  person,
  directory,
  canManage,
}: {
  person: AccessUser;
  directory: AccessDirectory;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'closed' | 'view' | 'edit'>('closed');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: AccessUserInput) => apiSend(`/access/users/${person.id}`, accessUserSchema, body, 'PATCH'),
    onSuccess: async () => {
      setError(null);
      setMode('closed');
      await queryClient.invalidateQueries({ queryKey: ['access'] });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The user could not be saved.'),
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/access/users/${person.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['access'] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The user could not be deleted.'),
  });
  return (
    <>
      <TableRow data-testid="user-row" hover>
        <TableCell data-testid="user-row-name">{person.name}</TableCell>
        <TableCell>{person.email}</TableCell>
        <TableCell>{person.roleName}</TableCell>
        <TableCell>{facilityLabel(person)}</TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button size="small" data-testid="view-record" onClick={() => setMode(mode === 'view' ? 'closed' : 'view')}>
              View
            </Button>
            {canManage ? (
              <Button size="small" data-testid="edit-record" onClick={() => setMode(mode === 'edit' ? 'closed' : 'edit')}>
                Edit
              </Button>
            ) : null}
            {canManage ? <DeleteRecord keepsHistory={false} onConfirm={() => remove.mutate()} /> : null}
          </Box>
        </TableCell>
      </TableRow>
      {mode === 'view' ? (
        <TableRow>
          <TableCell colSpan={5}>
            <Typography>{person.email}</Typography>
            <Typography>Role: {person.roleName}</Typography>
            <Typography>Facilities: {facilityLabel(person)}</Typography>
          </TableCell>
        </TableRow>
      ) : null}
      {mode === 'edit' ? (
        <TableRow>
          <TableCell colSpan={5}>
            <UserFields
              directory={directory}
              initial={{
                name: person.name,
                email: person.email,
                password: '',
                roleId: person.roleId ?? directory.roles[0]?.id ?? '',
                siteIds: person.siteIds,
              }}
              pending={save.isPending}
              submitLabel="Save changes"
              submitTestId="save-changes"
              onSubmit={(body) => save.mutate(body)}
              onCancel={() => setMode('closed')}
            />
            {error ? <Alert sx={{ mt: 1 }} severity="error">{error}</Alert> : null}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function UserFields({
  directory,
  initial,
  passwordRequired = false,
  pending,
  submitLabel,
  submitTestId,
  onSubmit,
  onCancel,
}: {
  directory: AccessDirectory;
  initial: AccessUserInput;
  passwordRequired?: boolean;
  pending?: boolean;
  submitLabel: string;
  submitTestId: string;
  onSubmit: (body: AccessUserInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [password, setPassword] = useState(initial.password);
  const [roleId, setRoleId] = useState(initial.roleId);
  const [siteIds, setSiteIds] = useState(initial.siteIds);
  const role = directory.roles.find((item) => item.id === roleId);
  return (
    <Box
      component="form"
      sx={{ display: 'grid', gap: 1.5, maxWidth: 560 }}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ name, email, password, roleId, siteIds });
      }}
    >
      <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} required inputProps={{ 'data-testid': 'user-name' }} />
      <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required inputProps={{ 'data-testid': 'user-email' }} />
      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required={passwordRequired}
        autoComplete="new-password"
        helperText={passwordRequired ? 'At least 8 characters.' : 'Leave blank to keep the current password.'}
        inputProps={{ 'data-testid': 'user-password' }}
      />
      <TextField
        select
        label="Role"
        value={roleId}
        onChange={(event) => setRoleId(event.target.value)}
        required
        SelectProps={{ native: true, inputProps: { 'data-testid': 'user-role' } }}
      >
        {directory.roles.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </TextField>
      <Box>
        <Typography sx={{ fontWeight: 600 }}>Facilities</Typography>
        <Typography sx={{ color: 'text.secondary', mb: 0.5 }}>
          {role?.opensEveryFacility
            ? 'This role opens every facility. Facility boxes are optional.'
            : 'Choose at least one facility.'}
        </Typography>
        <FormGroup>
          {directory.sites.map((site) => (
            <FormControlLabel
              key={site.id}
              control={
                <Checkbox
                  checked={siteIds.includes(site.id)}
                  inputProps={{ 'data-testid': `user-site-${site.code}` } as InputHTMLAttributes<HTMLInputElement>}
                  onChange={(event) => {
                    setSiteIds((current) =>
                      event.target.checked ? [...current, site.id] : current.filter((id) => id !== site.id),
                    );
                  }}
                />
              }
              label={`${site.name} (${site.code})`}
            />
          ))}
        </FormGroup>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button type="submit" variant="contained" data-testid={submitTestId} disabled={pending}>
          {submitLabel}
        </Button>
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}

function AuditTable({ directory }: { directory: AccessDirectory }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(directory.audit.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = directory.audit.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return (
    <Box data-testid="audit-log">
      {directory.audit.length === 0 ? <Alert severity="info">No activity is recorded.</Alert> : null}
      {directory.audit.length > 0 ? (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Who</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Summary</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {slice.map((entry) => (
                <TableRow key={entry.id} data-testid="audit-row">
                  <TableCell>{formatWhen(entry.at)}</TableCell>
                  <TableCell>{entry.actorName}</TableCell>
                  <TableCell>{entry.action}</TableCell>
                  <TableCell>{entry.summary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : null}
      <Pager page={safePage} pageCount={pageCount} total={directory.audit.length} onPage={setPage} />
    </Box>
  );
}

function RolesTab({ directory, canManage }: { directory: AccessDirectory; canManage: boolean }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(directory.roles.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = directory.roles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return (
    <Box>
      <Typography variant="h2" sx={{ fontSize: 28, mb: 1.5 }}>
        Roles
      </Typography>
      {canManage ? <AddRoleForm directory={directory} /> : null}
      <Box data-testid="role-table" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {slice.map((role) => (
              <RoleRow key={role.id} role={role} directory={directory} canManage={canManage} />
            ))}
          </TableBody>
        </Table>
      </Box>
      {directory.roles.length === 0 ? <Alert severity="info">No roles are recorded.</Alert> : null}
      <Pager page={safePage} pageCount={pageCount} total={directory.roles.length} onPage={setPage} />
    </Box>
  );
}

function AddRoleForm({ directory }: { directory: AccessDirectory }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: AccessRoleInput) => apiSend('/access/roles', accessRoleSchema, body),
    onSuccess: async () => {
      setError(null);
      setMessage('Role added.');
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['access'] });
    },
    onError: (caught) => {
      setMessage(null);
      setError(caught instanceof ApiError ? caught.message : 'The role could not be saved.');
    },
  });
  return (
    <Box sx={{ mb: 2 }}>
      {open ? (
        <Box sx={{ display: 'grid', gap: 1.5, maxWidth: 560, mb: 2 }}>
          <Typography variant="h3" sx={{ fontSize: 22 }}>
            Add role
          </Typography>
          <RoleFields
            directory={directory}
            initial={{ name: '', description: '', opensEveryFacility: false, permissionIds: [] }}
            pending={save.isPending}
            submitLabel="Add role"
            submitTestId="role-save"
            onSubmit={(body) => save.mutate(body)}
            onCancel={() => setOpen(false)}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Box>
      ) : (
        <Button variant="contained" data-testid="add-role" onClick={() => { setMessage(null); setOpen(true); }}>
          Add role
        </Button>
      )}
      {message ? <Alert sx={{ mt: 2 }}>{message}</Alert> : null}
    </Box>
  );
}

function RoleRow({
  role,
  directory,
  canManage,
}: {
  role: AccessRole;
  directory: AccessDirectory;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'closed' | 'view' | 'edit'>('closed');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: AccessRoleInput) => apiSend(`/access/roles/${role.id}`, accessRoleSchema, body, 'PATCH'),
    onSuccess: async () => {
      setError(null);
      setMode('closed');
      await queryClient.invalidateQueries({ queryKey: ['access'] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The role could not be saved.'),
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/access/roles/${role.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['access'] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The role could not be deleted.'),
  });
  return (
    <>
      <TableRow data-testid="role-row" hover>
        <TableCell data-testid="role-row-name">{role.name}</TableCell>
        <TableCell>{role.description}</TableCell>
        <TableCell>{role.permissionKeys.join(', ') || 'None'}</TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button size="small" data-testid="view-record" onClick={() => setMode(mode === 'view' ? 'closed' : 'view')}>
              View
            </Button>
            {canManage ? (
              <Button size="small" data-testid="edit-record" onClick={() => setMode(mode === 'edit' ? 'closed' : 'edit')}>
                Edit
              </Button>
            ) : null}
            {canManage ? <DeleteRecord keepsHistory={false} onConfirm={() => remove.mutate()} /> : null}
          </Box>
        </TableCell>
      </TableRow>
      {mode === 'view' ? (
        <TableRow>
          <TableCell colSpan={4}>
            <Typography>{role.description}</Typography>
            <Typography>{role.opensEveryFacility ? 'Opens every facility.' : 'Opens only the facilities granted to the user.'}</Typography>
            <Typography>Permissions: {role.permissionKeys.join(', ') || 'None'}</Typography>
          </TableCell>
        </TableRow>
      ) : null}
      {mode === 'edit' ? (
        <TableRow>
          <TableCell colSpan={4}>
            <RoleFields
              directory={directory}
              initial={{
                name: role.name,
                description: role.description,
                opensEveryFacility: role.opensEveryFacility,
                permissionIds: role.permissionIds,
              }}
              pending={save.isPending}
              submitLabel="Save changes"
              submitTestId="save-changes"
              onSubmit={(body) => save.mutate(body)}
              onCancel={() => setMode('closed')}
            />
            {error ? <Alert sx={{ mt: 1 }} severity="error">{error}</Alert> : null}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function RoleFields({
  directory,
  initial,
  pending,
  submitLabel,
  submitTestId,
  onSubmit,
  onCancel,
}: {
  directory: AccessDirectory;
  initial: AccessRoleInput;
  pending?: boolean;
  submitLabel: string;
  submitTestId: string;
  onSubmit: (body: AccessRoleInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [opensEveryFacility, setOpensEveryFacility] = useState(initial.opensEveryFacility);
  const [permissionIds, setPermissionIds] = useState(initial.permissionIds);
  return (
    <Box
      component="form"
      sx={{ display: 'grid', gap: 1.5, maxWidth: 560 }}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ name, description, opensEveryFacility, permissionIds });
      }}
    >
      <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} required inputProps={{ 'data-testid': 'role-name' }} />
      <TextField
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        required
        inputProps={{ 'data-testid': 'role-description' }}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={opensEveryFacility}
            onChange={(event) => setOpensEveryFacility(event.target.checked)}
            inputProps={{ 'data-testid': 'role-org-wide' } as InputHTMLAttributes<HTMLInputElement>}
          />
        }
        label="Opens every facility"
      />
      <Box>
        <Typography sx={{ fontWeight: 600 }}>Permissions</Typography>
        <FormGroup>
          {directory.permissions.map((permission) => (
            <FormControlLabel
              key={permission.id}
              control={
                <Checkbox
                  checked={permissionIds.includes(permission.id)}
                  inputProps={{ 'data-testid': `role-permission-${permission.key.replace(/[^a-z0-9]+/gi, '-')}` } as InputHTMLAttributes<HTMLInputElement>}
                  onChange={(event) => {
                    setPermissionIds((current) =>
                      event.target.checked ? [...current, permission.id] : current.filter((id) => id !== permission.id),
                    );
                  }}
                />
              }
              label={`${permission.key} — ${permission.description}`}
            />
          ))}
        </FormGroup>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button type="submit" variant="contained" data-testid={submitTestId} disabled={pending}>
          {submitLabel}
        </Button>
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}

function PermissionsTab({ directory, canManage }: { directory: AccessDirectory; canManage: boolean }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(directory.permissions.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = directory.permissions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return (
    <Box>
      <Typography variant="h2" sx={{ fontSize: 28, mb: 1.5 }}>
        Permissions
      </Typography>
      {canManage ? <AddPermissionForm /> : null}
      <Box data-testid="permission-table" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Key</TableCell>
              <TableCell>Description</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {slice.map((permission) => (
              <PermissionRow key={permission.id} permission={permission} canManage={canManage} />
            ))}
          </TableBody>
        </Table>
      </Box>
      {directory.permissions.length === 0 ? <Alert severity="info">No permissions are recorded.</Alert> : null}
      <Pager page={safePage} pageCount={pageCount} total={directory.permissions.length} onPage={setPage} />
    </Box>
  );
}

function AddPermissionForm() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: AccessPermissionInput) => apiSend('/access/permissions', accessPermissionSchema, body),
    onSuccess: async () => {
      setError(null);
      setMessage('Permission added.');
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['access'] });
    },
    onError: (caught) => {
      setMessage(null);
      setError(caught instanceof ApiError ? caught.message : 'The permission could not be saved.');
    },
  });
  return (
    <Box sx={{ mb: 2 }}>
      {open ? (
        <Box sx={{ display: 'grid', gap: 1.5, maxWidth: 560, mb: 2 }}>
          <Typography variant="h3" sx={{ fontSize: 22 }}>
            Add permission
          </Typography>
          <PermissionFields
            initial={{ key: '', description: '' }}
            pending={save.isPending}
            submitLabel="Add permission"
            submitTestId="permission-save"
            onSubmit={(body) => save.mutate(body)}
            onCancel={() => setOpen(false)}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Box>
      ) : (
        <Button variant="contained" data-testid="add-permission" onClick={() => { setMessage(null); setOpen(true); }}>
          Add permission
        </Button>
      )}
      {message ? <Alert sx={{ mt: 2 }}>{message}</Alert> : null}
    </Box>
  );
}

function PermissionRow({ permission, canManage }: { permission: AccessPermission; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'closed' | 'view' | 'edit'>('closed');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: AccessPermissionInput) =>
      apiSend(`/access/permissions/${permission.id}`, accessPermissionSchema, body, 'PATCH'),
    onSuccess: async () => {
      setError(null);
      setMode('closed');
      await queryClient.invalidateQueries({ queryKey: ['access'] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The permission could not be saved.'),
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/access/permissions/${permission.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['access'] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The permission could not be deleted.'),
  });
  return (
    <>
      <TableRow data-testid="permission-row" hover>
        <TableCell data-testid="permission-row-key">{permission.key}</TableCell>
        <TableCell>{permission.description}</TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button size="small" data-testid="view-record" onClick={() => setMode(mode === 'view' ? 'closed' : 'view')}>
              View
            </Button>
            {canManage ? (
              <Button size="small" data-testid="edit-record" onClick={() => setMode(mode === 'edit' ? 'closed' : 'edit')}>
                Edit
              </Button>
            ) : null}
            {canManage ? <DeleteRecord keepsHistory={false} onConfirm={() => remove.mutate()} /> : null}
          </Box>
        </TableCell>
      </TableRow>
      {mode === 'view' ? (
        <TableRow>
          <TableCell colSpan={3}>
            <Typography>
              {permission.key} — {permission.description}
            </Typography>
          </TableCell>
        </TableRow>
      ) : null}
      {mode === 'edit' ? (
        <TableRow>
          <TableCell colSpan={3}>
            <PermissionFields
              initial={{ key: permission.key, description: permission.description }}
              pending={save.isPending}
              submitLabel="Save changes"
              submitTestId="save-changes"
              onSubmit={(body) => save.mutate(body)}
              onCancel={() => setMode('closed')}
            />
            {error ? <Alert sx={{ mt: 1 }} severity="error">{error}</Alert> : null}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function PermissionFields({
  initial,
  pending,
  submitLabel,
  submitTestId,
  onSubmit,
  onCancel,
}: {
  initial: AccessPermissionInput;
  pending?: boolean;
  submitLabel: string;
  submitTestId: string;
  onSubmit: (body: AccessPermissionInput) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState(initial.key);
  const [description, setDescription] = useState(initial.description);
  return (
    <Box
      component="form"
      sx={{ display: 'grid', gap: 1.5, maxWidth: 560 }}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ key, description });
      }}
    >
      <TextField
        label="Key"
        value={key}
        onChange={(event) => setKey(event.target.value)}
        required
        helperText="Use a key like notes.read."
        inputProps={{ 'data-testid': 'permission-key' }}
      />
      <TextField
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        required
        inputProps={{ 'data-testid': 'permission-description' }}
      />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button type="submit" variant="contained" data-testid={submitTestId} disabled={pending}>
          {submitLabel}
        </Button>
        <Button type="button" onClick={onCancel}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}

function blankUser(directory: AccessDirectory): AccessUserInput {
  const role = directory.roles.find((item) => !item.opensEveryFacility) ?? directory.roles[0];
  return { name: '', email: '', password: '', roleId: role?.id ?? '', siteIds: [] };
}

function facilityLabel(person: AccessUser): string {
  if (person.opensEveryFacility) {
    return 'Every facility';
  }
  return person.siteNames.join(', ') || 'None';
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}
