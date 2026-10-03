import { Alert, Box, Button, Card, CardContent, Chip, MenuItem, Skeleton, TextField, Typography } from '@mui/material';
import { ROOM_TYPES, recordRemovedSchema, roomSchema, type Room, type Site } from '@trim/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ApiError, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { PagedList, RecordActions, SaveChanges } from '../records/RecordControls';
import { useSites } from '../layout/SiteProvider';
import { RoomGlyph } from '../components/Graphics';
import { ROOM_TYPE_LABELS, roomTypeColor, roomTypeLabel } from '../theme';

export function RoomsPage() {
  const { site, loading, error } = useSites();

  return (
    <Box>
      <PageHeader
        kicker={site?.code ?? 'Center'}
        title="Rooms"
        lede={site ? roomsLede(site) : 'Open a room to see its zones, readings, and operating history.'}
      />
      {loading ? <Skeleton variant="rounded" height={180} /> : null}
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {!loading && !site ? <Alert severity="info">Choose a facility you can open.</Alert> : null}
      {site ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <AddRoomForm siteId={site.id} />
          <PagedList
            items={site.rooms}
            empty="No rooms are recorded for this facility."
            testId="room-list"
            render={(room) => <RoomRow key={room.id} siteId={site.id} room={room} />}
          />
        </Box>
      ) : null}
    </Box>
  );
}

function roomsLede(site: Site): string {
  const address = [site.addressLine1, site.city, site.region, site.postalCode].filter(Boolean).join(', ');
  const place = address ? `${site.name}. ${address}.` : `${site.name}.`;
  return `${place} Open a room to see its zones, readings, and operating history.`;
}

function RoomRow({ siteId, room }: { siteId: string; room: Room }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: { name: string; roomType: string }) =>
      apiSend(`/sites/${siteId}/rooms/${room.id}`, roomSchema, body, 'PATCH'),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The room could not be saved.'),
  });
  const remove = useMutation({
    mutationFn: () => apiSend(`/sites/${siteId}/rooms/${room.id}`, recordRemovedSchema, undefined, 'DELETE'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : 'The room could not be deleted.'),
  });
  return (
    <Card sx={{ borderLeft: `6px solid ${roomTypeColor(room.roomType)}` }}>
      <CardContent>
        <RecordActions
          summary={
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 0 }}>
              <RoomGlyph color={roomTypeColor(room.roomType)} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h3" sx={{ fontSize: { xs: 22, sm: 24 } }} data-testid="room-row-name">
                  <RouterLink to={`/rooms/${room.id}`}>{room.name}</RouterLink>
                </Typography>
                <Typography sx={{ color: 'text.secondary' }}>
                  {room.currentCycle ? `${room.currentCycle.cultivar} · ${room.currentCycle.plantCount} plants` : 'No active crop'}
                </Typography>
              </Box>
            </Box>
          }
          detail={
            <Box>
              <Chip
                label={roomTypeLabel(room.roomType)}
                sx={{ mr: 1, bgcolor: roomTypeColor(room.roomType), color: room.roomType === 'dry' ? '#173128' : '#fff' }}
              />
              <Button component={RouterLink} to={`/rooms/${room.id}`} data-testid="open-room">
                Open room
              </Button>
              {room.zones.length > 0 ? (
                <Typography sx={{ mt: 1 }}>{room.zones.map((zone) => zone.name).join(', ')}</Typography>
              ) : (
                <Typography sx={{ mt: 1 }}>No zones yet.</Typography>
              )}
            </Box>
          }
          editor={
            <Box
              component="form"
              sx={{ display: 'grid', gap: 1, maxWidth: 420 }}
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                save.mutate({ name: String(form.get('name') ?? ''), roomType: String(form.get('roomType') ?? '') });
              }}
            >
              <TextField label="Name" name="name" defaultValue={room.name} required inputProps={{ 'data-testid': 'edit-room-name' }} />
              <TextField select label="Type" name="roomType" defaultValue={room.roomType}>
                {ROOM_TYPES.map((roomType) => (
                  <MenuItem key={roomType} value={roomType}>
                    {ROOM_TYPE_LABELS[roomType]}
                  </MenuItem>
                ))}
              </TextField>
              <SaveChanges pending={save.isPending} />
            </Box>
          }
          onDelete={() => remove.mutate()}
        />
        {error ? <Alert severity="error">{error}</Alert> : null}
      </CardContent>
    </Card>
  );
}

function AddRoomForm({ siteId }: { siteId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: { name: string; roomType: string }) => apiSend(`/sites/${siteId}/rooms`, roomSchema, body),
    onSuccess: async () => {
      setFormError(null);
      setMessage('Room added.');
      setOpen(false);
      setFormKey((key) => key + 1);
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: (caught) => {
      setMessage(null);
      setFormError(caught instanceof ApiError ? caught.message : 'The room could not be saved.');
    },
  });

  return (
    <Box>
      {open ? (
        <Card>
          <CardContent>
            <Typography variant="h3" sx={{ fontSize: 22, mb: 1.5 }}>
              Add a room
            </Typography>
            <Box
              key={formKey}
              component="form"
              sx={{ display: 'grid', gap: 1.5, maxWidth: 420 }}
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                save.mutate({
                  name: String(form.get('name') ?? ''),
                  roomType: String(form.get('roomType') ?? ''),
                });
              }}
            >
              <TextField label="Name" name="name" required inputProps={{ 'data-testid': 'room-name' }} />
              <TextField select label="Type" name="roomType" defaultValue="flower" inputProps={{ 'data-testid': 'room-type' }}>
                {ROOM_TYPES.map((roomType) => (
                  <MenuItem key={roomType} value={roomType}>
                    {ROOM_TYPE_LABELS[roomType]}
                  </MenuItem>
                ))}
              </TextField>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button type="submit" variant="contained" data-testid="add-room" disabled={save.isPending}>
                  Add room
                </Button>
                <Button type="button" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </Box>
            </Box>
            {formError ? (
              <Alert sx={{ mt: 2 }} severity="error">
                {formError}
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Button variant="contained" data-testid="add-room" onClick={() => setOpen(true)}>
          Add room
        </Button>
      )}
      {message ? (
        <Alert sx={{ mt: 2 }} data-testid="room-added">
          {message}
        </Alert>
      ) : null}
    </Box>
  );
}
