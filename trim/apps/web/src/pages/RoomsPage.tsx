import { Alert, Box, Button, Card, CardActionArea, CardContent, Chip, MenuItem, Skeleton, TextField, Typography } from '@mui/material';
import { ROOM_TYPES, roomSchema } from '@trim/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ApiError, apiSend } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { useSites } from '../layout/SiteProvider';
import { ROOM_TYPE_LABELS, roomTypeLabel } from '../theme';

export function RoomsPage() {
  const { site, loading, error } = useSites();

  return (
    <Box>
      <PageHeader
        kicker="Center"
        title="Rooms"
        lede="Open a room to see its current crop, cycle day, and operating history."
      />
      {loading ? <Skeleton variant="rounded" height={180} /> : null}
      {error ? <Alert severity="error">{error.message}</Alert> : null}
      {!loading && !site ? <Alert severity="info">Choose a facility you can open.</Alert> : null}
      {site ? (
        <Box sx={{ display: 'grid', gap: 1.5 }}>
          <AddRoomForm siteId={site.id} />
          {site.rooms.map((room) => (
            <Card key={room.id}>
              <CardActionArea component={RouterLink} to={`/rooms/${room.id}`}>
                <CardContent sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h3" sx={{ fontSize: 24 }}>
                      {room.name}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary' }}>
                      {room.currentCycle
                        ? `${room.currentCycle.cultivar} · ${room.currentCycle.plantCount} plants`
                        : 'No active crop'}
                    </Typography>
                  </Box>
                  <Chip label={roomTypeLabel(room.roomType)} />
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function AddRoomForm({ siteId }: { siteId: string }) {
  const queryClient = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: { name: string; roomType: string }) => apiSend(`/sites/${siteId}/rooms`, roomSchema, body),
    onSuccess: async () => {
      setFormError(null);
      setMessage('Room added.');
      setFormKey((key) => key + 1);
      await queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
    onError: (caught) => {
      setMessage(null);
      setFormError(caught instanceof ApiError ? caught.message : 'The room could not be saved.');
    },
  });

  return (
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
          <Button type="submit" variant="contained" data-testid="add-room" disabled={save.isPending} sx={{ justifySelf: 'start' }}>
            Add room
          </Button>
        </Box>
        {message ? (
          <Alert sx={{ mt: 2 }} data-testid="room-added">
            {message}
          </Alert>
        ) : null}
        {formError ? (
          <Alert sx={{ mt: 2 }} severity="error">
            {formError}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
