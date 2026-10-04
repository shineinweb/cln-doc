import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  FormGroup,
  MenuItem,
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
import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { ApiError, apiGet, apiSend } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { PageHeader } from '../components/PageHeader';
import {
  DeleteRecord,
  filterAndSortRows,
  ListSearch,
  Pager,
  PAGE_SIZE,
  RowActions,
  SectionToolbar,
  SortableHeader,
  TablePanel,
  useListQuery,
} from '../records/RecordControls';
import { workbench } from '../theme';
import { UserActivityDashboard } from './UserActivityDashboard';

const MANAGER_ONLY = 'You need the access.manage permission to change users, roles, and permissions.';

export function AccessPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'users' | 'roles' | 'permissions'>('users');
  const access = useQuery({
    queryKey: ['access'],
    queryFn: () => apiGet('/access', accessDirectorySchema),
  });
  const canManage = Boolean(user?.isOrgAdmin || user?.permissions.includes('access.manage'));

  return (
    <Box>
      <PageHeader
        kicker="Users"
        title="Users, roles, and permissions"
        lede="Watch sign-in and access activity, then add or change the people who can sign in, the roles they hold, and the permissions those roles grant."
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
  const [adding, setAdding] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  return (
    <Box>
      <UserActivityDashboard directory={directory} />
      <SectionToolbar
        title="Users"
        action={
          canManage && !adding ? (
            <Button
              variant="contained"
              data-testid="add-user"
              onClick={() => {
                setAddedMessage(null);
                setAdding(true);
              }}
            >
              Add user
            </Button>
          ) : null
        }
      />
      {canManage && adding ? (
        <AddUserForm
          directory={directory}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAddedMessage('User added.');
            setAdding(false);
          }}
        />
      ) : null}
      {addedMessage ? (
        <Alert sx={{ mb: 1.5 }} data-testid="user-added">
          {addedMessage}
        </Alert>
      ) : null}
      <UserTable directory={directory} canManage={canManage} />
      <Box sx={{ mt: 3 }}>
        <SectionToolbar title="Audit logs" />
        <Typography sx={{ mb: 1.5, color: 'text.secondary' }}>
          Sign-ins and every signed-in action across Serenity modules.
        </Typography>
        <AuditTable directory={directory} />
      </Box>
    </Box>
  );
}

function AddUserForm({
  directory,
  onClose,
  onAdded,
}: {
  directory: AccessDirectory;
  onClose: () => void;
  onAdded: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: AccessUserInput) => apiSend('/access/users', accessUserSchema, body),
    onSuccess: async () => {
      setError(null);
      onAdded();
      await queryClient.invalidateQueries({ queryKey: ['access'] });
    },
    onError: (caught) => {
      setError(caught instanceof ApiError ? caught.message : 'The user could not be saved.');
    },
  });
  const initial = blankUser(directory);
  return (
    <AccessFormShell title="Add user" testId="add-user-form">
      <UserFields
        directory={directory}
        initial={initial}
        passwordRequired
        pending={save.isPending}
        submitLabel="Add user"
        submitTestId="user-save"
        onSubmit={(body) => save.mutate(body)}
        onCancel={onClose}
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
    </AccessFormShell>
  );
}

function UserTable({ directory, canManage }: { directory: AccessDirectory; canManage: boolean }) {
  const [page, setPage] = useState(1);
  const list = useListQuery<'name' | 'email' | 'role' | 'facilities'>('name');
  const rows = filterAndSortRows(
    directory.users,
    list,
    (person, query) =>
      [person.name, person.email, person.roleName, facilityLabel(person)].join(' ').toLowerCase().includes(query),
    (person, key) => {
      if (key === 'email') return person.email;
      if (key === 'role') return person.roleName;
      if (key === 'facilities') return facilityLabel(person);
      return person.name;
    },
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return (
    <Box data-testid="user-table">
      {directory.users.length === 0 ? <Alert severity="info">No users are recorded.</Alert> : null}
      {directory.users.length > 0 ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <ListSearch
            value={list.query}
            onChange={(value) => {
              list.setQuery(value);
              setPage(1);
            }}
            placeholder="Search users"
            testId="user-search"
          />
          {rows.length === 0 ? <Alert severity="info">No users match that search.</Alert> : null}
          {rows.length > 0 ? (
            <TablePanel>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <SortableHeader
                      label="Name"
                      active={list.sortKey === 'name'}
                      direction={list.sortDirection}
                      onClick={() => list.toggleSort('name')}
                      testId="user-sort-name"
                    />
                    <SortableHeader
                      label="Email"
                      active={list.sortKey === 'email'}
                      direction={list.sortDirection}
                      onClick={() => list.toggleSort('email')}
                      testId="user-sort-email"
                    />
                    <SortableHeader
                      label="Role"
                      active={list.sortKey === 'role'}
                      direction={list.sortDirection}
                      onClick={() => list.toggleSort('role')}
                      testId="user-sort-role"
                    />
                    <SortableHeader
                      label="Facilities"
                      active={list.sortKey === 'facilities'}
                      direction={list.sortDirection}
                      onClick={() => list.toggleSort('facilities')}
                      testId="user-sort-facilities"
                    />
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {slice.map((person) => (
                    <UserRow key={person.id} person={person} directory={directory} canManage={canManage} />
                  ))}
                </TableBody>
              </Table>
            </TablePanel>
          ) : null}
          <Pager page={safePage} pageCount={pageCount} total={rows.length} onPage={setPage} />
        </Box>
      ) : null}
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
        <TableCell data-testid="user-row-name" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
          {person.name}
        </TableCell>
        <TableCell sx={{ color: 'text.secondary' }}>{person.email}</TableCell>
        <TableCell>{person.roleName}</TableCell>
        <TableCell>{facilityLabel(person)}</TableCell>
        <TableCell align="right">
          <RowActions>
            <Button size="small" data-testid="view-record" onClick={() => setMode(mode === 'view' ? 'closed' : 'view')}>
              View
            </Button>
            {canManage ? (
              <Button size="small" data-testid="edit-record" onClick={() => setMode(mode === 'edit' ? 'closed' : 'edit')}>
                Edit
              </Button>
            ) : null}
            {canManage ? <DeleteRecord keepsHistory={false} onConfirm={() => remove.mutate()} /> : null}
          </RowActions>
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
      sx={{ display: 'grid', gap: 2, maxWidth: 560 }}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ name, email, password, roleId, siteIds });
      }}
    >
      <TextField
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        fullWidth
        inputProps={{ 'data-testid': 'user-name' }}
      />
      <TextField
        label="Email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        fullWidth
        inputProps={{ 'data-testid': 'user-email' }}
      />
      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required={passwordRequired}
        fullWidth
        autoComplete="new-password"
        helperText={passwordRequired ? 'At least 8 characters.' : 'Leave blank to keep the current password.'}
        FormHelperTextProps={{ sx: { mx: 0, mt: 0.75 } }}
        inputProps={{ 'data-testid': 'user-password' }}
      />
      <TextField
        select
        label="Role"
        value={roleId}
        onChange={(event) => setRoleId(event.target.value)}
        required
        fullWidth
        inputProps={{ 'data-testid': 'user-role' }}
      >
        {directory.roles.map((item) => (
          <MenuItem key={item.id} value={item.id}>
            {item.name}
          </MenuItem>
        ))}
      </TextField>
      <Box
        sx={{
          border: `1px solid ${workbench.line}`,
          borderRadius: 2,
          bgcolor: workbench.mist,
          px: 1.5,
          py: 1.25,
        }}
      >
        <Typography sx={{ fontWeight: 700, mb: 0.25 }}>Facilities</Typography>
        <Typography sx={{ color: 'text.secondary', mb: 1, fontSize: 14 }}>
          {role?.opensEveryFacility
            ? 'This role opens every facility. Facility boxes are optional.'
            : 'Choose at least one facility.'}
        </Typography>
        <FormGroup sx={{ gap: 0.25 }}>
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
      <Box sx={{ display: 'flex', gap: 1, pt: 0.5 }}>
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
  const list = useListQuery<'when' | 'who' | 'action' | 'summary'>('when', 'desc');
  const rows = filterAndSortRows(
    directory.audit,
    list,
    (entry, query) =>
      [formatWhen(entry.at), entry.actorName, entry.action, entry.summary].join(' ').toLowerCase().includes(query),
    (entry, key) => {
      if (key === 'who') return entry.actorName;
      if (key === 'action') return entry.action;
      if (key === 'summary') return entry.summary;
      return new Date(entry.at).getTime();
    },
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return (
    <Box data-testid="audit-log">
      {directory.audit.length === 0 ? <Alert severity="info">No activity is recorded.</Alert> : null}
      {directory.audit.length > 0 ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <ListSearch
            value={list.query}
            onChange={(value) => {
              list.setQuery(value);
              setPage(1);
            }}
            placeholder="Search activity"
            testId="audit-search"
          />
          {rows.length === 0 ? <Alert severity="info">No activity matches that search.</Alert> : null}
          {rows.length > 0 ? (
            <TablePanel>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <SortableHeader
                      label="When"
                      active={list.sortKey === 'when'}
                      direction={list.sortDirection}
                      onClick={() => list.toggleSort('when')}
                      testId="audit-sort-when"
                    />
                    <SortableHeader
                      label="Who"
                      active={list.sortKey === 'who'}
                      direction={list.sortDirection}
                      onClick={() => list.toggleSort('who')}
                      testId="audit-sort-who"
                    />
                    <SortableHeader
                      label="Action"
                      active={list.sortKey === 'action'}
                      direction={list.sortDirection}
                      onClick={() => list.toggleSort('action')}
                      testId="audit-sort-action"
                    />
                    <SortableHeader
                      label="Summary"
                      active={list.sortKey === 'summary'}
                      direction={list.sortDirection}
                      onClick={() => list.toggleSort('summary')}
                      testId="audit-sort-summary"
                    />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {slice.map((entry) => (
                    <TableRow key={entry.id} data-testid="audit-row" hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatWhen(entry.at)}</TableCell>
                      <TableCell>{entry.actorName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{entry.action}</TableCell>
                      <TableCell>{entry.summary}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TablePanel>
          ) : null}
          <Pager page={safePage} pageCount={pageCount} total={rows.length} onPage={setPage} />
        </Box>
      ) : null}
    </Box>
  );
}

function RolesTab({ directory, canManage }: { directory: AccessDirectory; canManage: boolean }) {
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const list = useListQuery<'name' | 'description' | 'permissions'>('name');
  const rows = filterAndSortRows(
    directory.roles,
    list,
    (role, query) =>
      [role.name, role.description, role.permissionKeys.join(' ')].join(' ').toLowerCase().includes(query),
    (role, key) => {
      if (key === 'description') return role.description;
      if (key === 'permissions') return role.permissionKeys.join(', ');
      return role.name;
    },
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return (
    <Box data-testid="role-table">
      <SectionToolbar
        title="Roles"
        action={
          canManage && !adding ? (
            <Button
              variant="contained"
              data-testid="add-role"
              onClick={() => {
                setAddedMessage(null);
                setAdding(true);
              }}
            >
              Add role
            </Button>
          ) : null
        }
      />
      {canManage && adding ? (
        <AddRoleForm
          directory={directory}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAddedMessage('Role added.');
            setAdding(false);
          }}
        />
      ) : null}
      {addedMessage ? <Alert sx={{ mb: 1.5 }}>{addedMessage}</Alert> : null}
      {directory.roles.length === 0 ? <Alert severity="info">No roles are recorded.</Alert> : null}
      {directory.roles.length > 0 ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <ListSearch
            value={list.query}
            onChange={(value) => {
              list.setQuery(value);
              setPage(1);
            }}
            placeholder="Search roles"
            testId="role-search"
          />
          {rows.length === 0 ? <Alert severity="info">No roles match that search.</Alert> : null}
          {rows.length > 0 ? (
            <TablePanel>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <SortableHeader
                      label="Name"
                      active={list.sortKey === 'name'}
                      direction={list.sortDirection}
                      onClick={() => list.toggleSort('name')}
                      testId="role-sort-name"
                    />
                    <SortableHeader
                      label="Description"
                      active={list.sortKey === 'description'}
                      direction={list.sortDirection}
                      onClick={() => list.toggleSort('description')}
                      testId="role-sort-description"
                    />
                    <SortableHeader
                      label="Permissions"
                      active={list.sortKey === 'permissions'}
                      direction={list.sortDirection}
                      onClick={() => list.toggleSort('permissions')}
                      testId="role-sort-permissions"
                    />
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {slice.map((role) => (
                    <RoleRow key={role.id} role={role} directory={directory} canManage={canManage} />
                  ))}
                </TableBody>
              </Table>
            </TablePanel>
          ) : null}
          <Pager page={safePage} pageCount={pageCount} total={rows.length} onPage={setPage} />
        </Box>
      ) : null}
    </Box>
  );
}

function AddRoleForm({
  directory,
  onClose,
  onAdded,
}: {
  directory: AccessDirectory;
  onClose: () => void;
  onAdded: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: AccessRoleInput) => apiSend('/access/roles', accessRoleSchema, body),
    onSuccess: async () => {
      setError(null);
      onAdded();
      await queryClient.invalidateQueries({ queryKey: ['access'] });
    },
    onError: (caught) => {
      setError(caught instanceof ApiError ? caught.message : 'The role could not be saved.');
    },
  });
  return (
    <AccessFormShell title="Add role" testId="add-role-form">
      <RoleFields
        directory={directory}
        initial={{ name: '', description: '', opensEveryFacility: false, permissionIds: [] }}
        pending={save.isPending}
        submitLabel="Add role"
        submitTestId="role-save"
        onSubmit={(body) => save.mutate(body)}
        onCancel={onClose}
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
    </AccessFormShell>
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
        <TableCell data-testid="role-row-name" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
          {role.name}
        </TableCell>
        <TableCell>{role.description}</TableCell>
        <TableCell sx={{ color: 'text.secondary', maxWidth: 360 }}>{role.permissionKeys.join(', ') || 'None'}</TableCell>
        <TableCell align="right">
          <RowActions>
            <Button size="small" data-testid="view-record" onClick={() => setMode(mode === 'view' ? 'closed' : 'view')}>
              View
            </Button>
            {canManage ? (
              <Button size="small" data-testid="edit-record" onClick={() => setMode(mode === 'edit' ? 'closed' : 'edit')}>
                Edit
              </Button>
            ) : null}
            {canManage ? <DeleteRecord keepsHistory={false} onConfirm={() => remove.mutate()} /> : null}
          </RowActions>
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
  const [adding, setAdding] = useState(false);
  const [addedMessage, setAddedMessage] = useState<string | null>(null);
  const list = useListQuery<'key' | 'description'>('key');
  const rows = filterAndSortRows(
    directory.permissions,
    list,
    (permission, query) => [permission.key, permission.description].join(' ').toLowerCase().includes(query),
    (permission, key) => (key === 'description' ? permission.description : permission.key),
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const slice = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return (
    <Box data-testid="permission-table">
      <SectionToolbar
        title="Permissions"
        action={
          canManage && !adding ? (
            <Button
              variant="contained"
              data-testid="add-permission"
              onClick={() => {
                setAddedMessage(null);
                setAdding(true);
              }}
            >
              Add permission
            </Button>
          ) : null
        }
      />
      {canManage && adding ? (
        <AddPermissionForm
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAddedMessage('Permission added.');
            setAdding(false);
          }}
        />
      ) : null}
      {addedMessage ? <Alert sx={{ mb: 1.5 }}>{addedMessage}</Alert> : null}
      {directory.permissions.length === 0 ? <Alert severity="info">No permissions are recorded.</Alert> : null}
      {directory.permissions.length > 0 ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <ListSearch
            value={list.query}
            onChange={(value) => {
              list.setQuery(value);
              setPage(1);
            }}
            placeholder="Search permissions"
            testId="permission-search"
          />
          {rows.length === 0 ? <Alert severity="info">No permissions match that search.</Alert> : null}
          {rows.length > 0 ? (
            <TablePanel>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <SortableHeader
                      label="Key"
                      active={list.sortKey === 'key'}
                      direction={list.sortDirection}
                      onClick={() => list.toggleSort('key')}
                      testId="permission-sort-key"
                    />
                    <SortableHeader
                      label="Description"
                      active={list.sortKey === 'description'}
                      direction={list.sortDirection}
                      onClick={() => list.toggleSort('description')}
                      testId="permission-sort-description"
                    />
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {slice.map((permission) => (
                    <PermissionRow key={permission.id} permission={permission} canManage={canManage} />
                  ))}
                </TableBody>
              </Table>
            </TablePanel>
          ) : null}
          <Pager page={safePage} pageCount={pageCount} total={rows.length} onPage={setPage} />
        </Box>
      ) : null}
    </Box>
  );
}

function AddPermissionForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: AccessPermissionInput) => apiSend('/access/permissions', accessPermissionSchema, body),
    onSuccess: async () => {
      setError(null);
      onAdded();
      await queryClient.invalidateQueries({ queryKey: ['access'] });
    },
    onError: (caught) => {
      setError(caught instanceof ApiError ? caught.message : 'The permission could not be saved.');
    },
  });
  return (
    <AccessFormShell title="Add permission" testId="add-permission-form">
      <PermissionFields
        initial={{ key: '', description: '' }}
        pending={save.isPending}
        submitLabel="Add permission"
        submitTestId="permission-save"
        onSubmit={(body) => save.mutate(body)}
        onCancel={onClose}
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
    </AccessFormShell>
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
        <TableCell data-testid="permission-row-key" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'nowrap' }}>
          {permission.key}
        </TableCell>
        <TableCell>{permission.description}</TableCell>
        <TableCell align="right">
          <RowActions>
            <Button size="small" data-testid="view-record" onClick={() => setMode(mode === 'view' ? 'closed' : 'view')}>
              View
            </Button>
            {canManage ? (
              <Button size="small" data-testid="edit-record" onClick={() => setMode(mode === 'edit' ? 'closed' : 'edit')}>
                Edit
              </Button>
            ) : null}
            {canManage ? <DeleteRecord keepsHistory={false} onConfirm={() => remove.mutate()} /> : null}
          </RowActions>
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

function AccessFormShell({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <Card
      data-testid={testId}
      sx={{
        mb: 2,
        maxWidth: 640,
        backgroundImage: 'none',
        bgcolor: workbench.paper,
        border: `1px solid ${workbench.line}`,
      }}
    >
      <CardContent sx={{ display: 'grid', gap: 2, p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        <Typography variant="h3" sx={{ fontSize: 22, m: 0 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
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
