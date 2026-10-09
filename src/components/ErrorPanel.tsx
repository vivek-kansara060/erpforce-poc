import { useEffect, useRef, useState } from 'react';
import { Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useSnackbar } from 'notistack';
import { useLocation } from 'react-router-dom';
import { Text } from './Text';
import { neutral } from '@/theme/color';

/**
 * Global error panel (8 Oct call): validation errors are listed in one panel at the side instead of a pop-up, and clicking one goes to the field.
 * Forms keep raising `toast(msg, 'error')`; useToast turns it into the erp:form-error event. Every field in error carries data-field-error
 * (FieldShell and FieldError), so the panel just collects them from the page. With no field in error the message is shown as a normal toast.
 */
interface Item { el: Element; label: string; msg: string }

const collect = (): Item[] => Array.from(document.querySelectorAll('[data-field-error]')).map((el) => ({ el, label: el.getAttribute('data-field-error') ?? '', msg: el.getAttribute('data-field-msg') ?? '' }));
const signature = (items: Item[]) => items.map((i) => `${i.label}|${i.msg}`).join('~');

export function ErrorPanelHost() {
  const { enqueueSnackbar } = useSnackbar();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const lastSig = useRef('');

  const refresh = () => {
    const next = collect();
    const sig = signature(next);
    if (sig !== lastSig.current) {
      lastSig.current = sig;
      setItems(next);
      window.dispatchEvent(new CustomEvent('erp:errors-changed'));
      if (!next.length) setOpen(false);
    }
  };

  useEffect(() => {
    const onError = (e: Event) => {
      const msg = String((e as CustomEvent).detail ?? '');
      // two frames, so the form has rendered the errors that were just set
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const next = collect();
        if (!next.length) { enqueueSnackbar(msg, { variant: 'error' }); return; }
        lastSig.current = signature(next);
        setMessage(msg);
        setItems(next);
        setOpen(true);
        window.dispatchEvent(new CustomEvent('erp:errors-changed'));
      }));
    };
    window.addEventListener('erp:form-error', onError);
    return () => window.removeEventListener('erp:form-error', onError);
  }, [enqueueSnackbar]);

  useEffect(() => {
    let frame = 0;
    const mo = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(refresh); });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-field-error'] });
    return () => { mo.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => { setOpen(false); lastSig.current = ''; setItems([]); }, [pathname]);

  const go = (el: Element) => {
    window.dispatchEvent(new CustomEvent('erp:reveal-field', { detail: el }));
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el.querySelector('input, textarea, [role="combobox"], button') as HTMLElement | null)?.focus({ preventScroll: true });
      const box = el as HTMLElement;
      const prev = box.style.outline;
      box.style.outline = '2px solid #C64D4D';
      setTimeout(() => { box.style.outline = prev; }, 1200);
    }, 80);
  };

  if (!open || !items.length) return null;
  return (
    <Box role="alert" sx={{ position: 'fixed', top: 140, right: 16, width: 360, maxHeight: 'calc(100vh - 164px)', zIndex: 1400, bgcolor: '#fff', border: `1px solid ${neutral[200]}`, borderRadius: '8px', boxShadow: '0px 4px 16px rgba(0,0,0,0.14)', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, p: 1.5, borderBottom: `1px solid ${neutral[200]}` }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Text type="s3" weight="medium">Fix {items.length} field{items.length === 1 ? '' : 's'} to save</Text>
          <Text type="s5" color="theme.secondary.700">{message}</Text>
        </Box>
        <IconButton size="small" aria-label="Close" onClick={() => setOpen(false)}><CloseIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ overflowY: 'auto' }}>
        {items.map((it, i) => (
          <Box key={`${it.label}-${i}`} onClick={() => go(it.el)} sx={{ px: 1.5, py: 1, cursor: 'pointer', '&:hover': { bgcolor: neutral[100] } }}>
            <Text type="s4" weight="medium">{it.label}</Text>
            <Text type="s5" color="#C64D4D">{it.msg}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
