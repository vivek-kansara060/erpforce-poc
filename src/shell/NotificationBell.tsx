import { useState } from 'react';
import { Badge, Box, IconButton, Menu, Button } from '@mui/material';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { Link } from 'react-router-dom';
import { Text } from '@/components/Text';
import { useCollection } from '@/store/store';
import { notificationSeed, type AppNotification } from '@/mock-data/notifications';
import { neutral, primaryGreen } from '@/theme/color';

/** Header bell (existing NotificationMenu): unread badge, mark all read, deep links. */
export function NotificationBell() {
  const { rows, update } = useCollection<AppNotification>('notifications', notificationSeed);
  const [el, setEl] = useState<HTMLElement | null>(null);
  const unread = rows.filter((n) => !n.read).length;
  return (
    <>
      <IconButton onClick={(e) => setEl(e.currentTarget)}>
        <Badge badgeContent={unread} color="error" max={99}><NotificationsNoneIcon sx={{ color: neutral[800] }} /></Badge>
      </IconButton>
      <Menu anchorEl={el} open={!!el} onClose={() => setEl(null)} PaperProps={{ sx: { width: 400, maxHeight: 520 } }}>
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="s3" weight="medium">Notifications</Text>
          <Button size="small" variant="text" onClick={() => rows.forEach((n) => update(n.id, { read: true }))}>Mark all as read</Button>
        </Box>
        {rows.map((n) => (
          <Box key={n.id} component={n.link ? Link : 'div'} {...(n.link ? { to: n.link } : {})} onClick={() => { update(n.id, { read: true }); setEl(null); }}
            sx={{ display: 'block', px: 2, py: 1.25, borderTop: `1px solid ${neutral[200]}`, bgcolor: n.read ? '#fff' : primaryGreen[50], '&:hover': { bgcolor: neutral[100] } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <Text type="s4" weight="medium">{n.title}</Text>
              <Text type="s5" color="theme.secondary.600" sx={{ whiteSpace: 'nowrap' }}>{n.time}</Text>
            </Box>
            <Text type="s5" color="theme.secondary.800">{n.message}</Text>
            <Text type="s5" color="theme.secondary.600">{n.category}</Text>
          </Box>
        ))}
      </Menu>
    </>
  );
}
