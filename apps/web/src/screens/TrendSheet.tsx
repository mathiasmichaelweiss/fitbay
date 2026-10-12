import { useTranslation } from 'react-i18next';
import { SheetPage } from '@/components/ui/sheet-page';
import { Progress } from './Progress';

/** Шторка sh-trend прототипа («Жир и тенденция»), открывается с плитки жира. Полный перенос графиков в A3.5. */
export function TrendSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <SheetPage open={open} onOpenChange={(o) => !o && onClose()} title={t('Жир и тенденция')}>
      <Progress />
    </SheetPage>
  );
}
