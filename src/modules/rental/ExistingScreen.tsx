import { useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { DataTable } from '@/components/DataTable';
import { Page, PageTitle } from '@/components/PageHeader';
import { Text } from '@/components/Text';

/**
 * An existing Rental screen that the Heavy Equipment requirement does not change. The sidebar entry stays exactly as in the existing ERP; the screen keeps its
 * existing columns and is not rebuilt in this POC.
 */
export function ExistingScreen({ title, columns, link, linkLabel, note }: { title: string; columns: string[]; link?: string; linkLabel?: string; note?: string }) {
  const nav = useNavigate();
  return (
    <Page>
      <PageTitle title={title} right={link ? <Button variant="outlined" onClick={() => nav(link)}>{linkLabel ?? 'Open'}</Button> : undefined} />
      <Text type="s4" color="theme.secondary.700" sx={{ mb: 1.5 }}>{note ?? 'Existing ERP screen. It is not changed by the Heavy Equipment requirement and is not rebuilt in this POC.'}</Text>
      <DataTable rows={[]} hideToolbar emptyText="Existing screen, unchanged" columns={columns.map((c) => ({ key: c, label: c }))} />
    </Page>
  );
}
