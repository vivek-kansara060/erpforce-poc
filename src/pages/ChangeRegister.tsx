import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { DataTable, type Column } from '@/components/DataTable';
import { Page, PageTitle, FormHeader } from '@/components/PageHeader';
import { StatusChip } from '@/components/StatusChip';
import { Text } from '@/components/Text';
import { KpiCard, KpiRow } from '@/components/Widgets';
import { visibleModules as modules } from '@/modules';
import type { ChangeEntry } from '@/types';

type Row = ChangeEntry & { id: string };

/** POC-only review aid: the requirement-to-ERP mapping table (Existing / Existing with change / New / Removed) with links to each screen. */
export function ChangeRegister() {
  const nav = useNavigate();
  const rows: Row[] = useMemo(() => modules.flatMap((m) => m.changes.map((c, i) => ({ ...c, id: `${m.id}-${i}` }))), []);
  const [selMod, setSelMod] = useState('All');
  const shown = selMod === 'All' ? rows : rows.filter((r) => r.module === selMod);
  const count = (c: string) => rows.filter((r) => r.classification === c).length;
  const cols: Column<Row>[] = [
    { key: 'module', label: 'Module', width: 150 },
    { key: 'screen', label: 'Screen / Feature', width: 200, render: (r) => (r.path ? <Link to={r.path} style={{ color: '#2EB273', fontWeight: 500 }}>{r.screen}</Link> : r.screen) },
    { key: 'classification', label: 'Classification', width: 160, render: (r) => <StatusChip status={r.classification} tone={r.classification === 'NEW' ? 'green' : r.classification === 'EXISTING WITH CHANGE' ? 'amber' : r.classification === 'REMOVED' ? 'red' : 'grey'} /> },
    { key: 'existing', label: 'Existing ERP' },
    { key: 'change', label: 'Requirement change' },
    { key: 'ref', label: 'Requirement reference', width: 200 },
  ];
  return (
    <Box>
      <FormHeader crumbs={[{ label: 'Modules', to: '/' }, { label: 'Change Register' }]} />
      <Page>
        <PageTitle title="Change Register" subtitle="Every screen or feature that differs from the existing ERP, mapped to the requirement document."
          right={<Button variant="outlined" onClick={() => nav('/change-register/changelog')}>View detailed changelog</Button>} />
        <KpiRow>
          <KpiCard title="New" value={count('NEW')} tint="#E8F5F0" />
          <KpiCard title="Existing with change" value={count('EXISTING WITH CHANGE')} tint="#FFF3CC" />
          <KpiCard title="Removed" value={count('REMOVED')} tint="#FFEBEB" />
          <KpiCard title="Existing, unchanged" value={count('EXISTING')} />
        </KpiRow>
        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          {['All', ...modules.map((m) => m.label)].map((m) => (
            <Box key={m} onClick={() => setSelMod(m)} sx={{ cursor: 'pointer', px: 1.25, py: 0.4, borderRadius: '1.5rem', fontSize: 12, fontWeight: 500, bgcolor: selMod === m ? '#B6E9D6' : '#EEEFF1', color: selMod === m ? '#279769' : '#656669' }}>{m}</Box>
          ))}
        </Box>
        {rows.length === 0 && <Text type="s3">No entries yet.</Text>}
        <DataTable rows={shown} columns={cols} pageSize={15} filter={{ key: 'classification', options: ['NEW', 'EXISTING WITH CHANGE', 'EXISTING', 'REMOVED'] }} />
      </Page>
    </Box>
  );
}
