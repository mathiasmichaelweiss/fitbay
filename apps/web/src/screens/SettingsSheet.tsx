import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SheetPage } from '@/components/ui/sheet-page';
import { useState } from 'react';
import { SingleToggle } from '@/components/ui/toggle-group';
import { isOwner, TestUsersSheet } from './TestUsers';

/** «Настройки» прототипа: язык и «Пройти знакомство заново». «Мои данные и согласия» и тестовые пользователи в A6.1 и 4.9. */
export function SettingsSheet({ open, onClose, onOnboarding }: { open: boolean; onClose: () => void; onOnboarding: () => void }) {
  const { t, i18n } = useTranslation();
  const [tu, setTu] = useState(false);
  return (
    <SheetPage open={open} onOpenChange={(o) => !o && onClose()} title={t('Настройки')}>
      {isOwner() && (
        <Button variant="secondary" className="mb-2.5 h-[52px] w-full" onClick={() => setTu(true)}>
          {t('🧪 Тестовые пользователи')}
        </Button>
      )}
      <TestUsersSheet open={tu} onClose={() => setTu(false)} />
      <div className="mb-2.5 rounded-xl bg-card p-4">
        <div className="mb-1.5 text-[0.8rem] text-muted-foreground">{t('Язык')}</div>
        <SingleToggle aria-label={t('Язык')} value={i18n.language === 'de' ? 'de' : 'ru'} onChange={(k) => void i18n.changeLanguage(k)} options={[{ value: 'ru', label: 'Русский' }, { value: 'de', label: 'Deutsch' }]} />
      </div>
      <Button variant="secondary" className="w-full" onClick={() => (onClose(), onOnboarding())}>
        {t('Пройти знакомство заново')}
      </Button>
      {/* только в разработке: витрина компонентов (в шапке прототипа ровно 4 кнопки) */}
      {import.meta.env.DEV && (
        <Button variant="secondary" className="mt-2.5 w-full" asChild>
          <a href="/ui">UI kit</a>
        </Button>
      )}
    </SheetPage>
  );
}
