import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TrashIcon } from 'lucide-react';
import { SheetPage } from '@/components/ui/sheet-page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { askConfirm } from '@/components/ui/confirm';
import { api, devUser, testUser, type TestUser } from '@/data/api';
import { cn } from '@/lib/utils';

type Row = { id: string; kind: string; name: string; desc: string; roles: string };
type Preset = { kind: string; name: string; desc: string };

/** Владелец (admin) видит тестовых пользователей (st.isOwner прототипа). */
export const isOwner = () => devUser.get().roles.split(',').includes('admin');

/** tuBar прототипа: фиолетовая полоса сверху, пока открыт тестовый пользователь. */
export function TuBar() {
  const { t } = useTranslation();
  const tu = testUser.get();
  if (!tu) return null;
  return (
    <div className="sticky top-0 z-50 flex h-[30px] items-center justify-between gap-2 bg-[#7a3cff] px-3 text-[0.8rem] font-semibold text-white" data-testid="tu-bar">
      <span className="truncate">🧪 {tu.name}</span>
      <button type="button" onClick={() => testUser.switch(null)} className="flex-none whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[0.75rem] font-bold text-[#7a3cff]">
        {t('Вернуться к себе')}
      </button>
    </div>
  );
}

/** sh-tu прототипа (renderTu): я, список тестовых, создать по пресету, войти, удалить. */
export function TestUsersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const cur = testUser.get();
  const { data } = useQuery({
    queryKey: ['testusers'],
    enabled: open,
    // список ведет владелец: запрос без x-act-as
    queryFn: async () => {
      const keep = localStorage.getItem('fb_tu');
      localStorage.removeItem('fb_tu');
      try {
        return await api.call<{ items: Row[]; presets: Preset[] }>('GET', '/admin/testusers');
      } finally {
        if (keep) localStorage.setItem('fb_tu', keep);
      }
    },
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const asOwner = async <T,>(fn: () => Promise<T>) => {
    const keep = localStorage.getItem('fb_tu');
    localStorage.removeItem('fb_tu');
    try {
      return await fn();
    } finally {
      if (keep) localStorage.setItem('fb_tu', keep);
    }
  };
  const enter = (r: Row & { uid?: string }) => testUser.switch({ id: r.id, uid: r.uid ?? `${devUser.get().uid}~${r.id}`, roles: r.roles, name: r.name, kind: r.kind } as TestUser);
  const row = (key: string, name: string, sub: string, on: boolean, act: React.ReactNode) => (
    <Card key={key} className={cn('mb-2 flex-row items-center gap-2.5', on && 'outline outline-2 outline-brand-orange')} data-testid="tu-row">
      <div className="min-w-0 flex-1">
        <b>{name}</b>
        <div className="text-[0.8rem] text-muted-foreground">{sub}</div>
      </div>
      {act}
    </Card>
  );
  return (
    <SheetPage open={open} onOpenChange={(o) => !o && onClose()} title={t('Тестовые пользователи')}>
      <p className="mb-3 mt-0 text-[0.85rem] text-muted-foreground">{t('Видно только тебе. Данные тестовых пользователей хранятся отдельно, твой профиль, цели и записи они не трогают.')}</p>
      {row(
        'me',
        t('Я (основной профиль)'),
        t('Твои реальные данные'),
        !cur,
        !cur ? <span className="text-[0.8rem] font-bold text-brand-orange">{t('активен')}</span> : (
          <Button variant="secondary" className="h-11" onClick={() => testUser.switch(null)}>
            {t('Войти')}
          </Button>
        ),
      )}
      {(data?.items ?? []).map((u) =>
        row(
          u.id,
          u.name,
          t(u.desc),
          cur?.id === u.id,
          <>
            {cur?.id === u.id ? (
              <span className="text-[0.8rem] font-bold text-brand-orange">{t('активен')}</span>
            ) : (
              <Button variant="secondary" className="h-11" onClick={() => enter(u)}>
                {t('Войти')}
              </Button>
            )}
            <Button
              variant="secondary"
              size="icon"
              aria-label={t('Удалить')}
              onClick={async () => {
                if (!(await askConfirm(t('Удалить тестового пользователя?')))) return;
                await asOwner(() => api.call('DELETE', `/admin/testusers/${u.id}`)).catch(() => {});
                if (cur?.id === u.id) return testUser.switch(null);
                void qc.invalidateQueries({ queryKey: ['testusers'] });
              }}
            >
              <TrashIcon className="size-4" />
            </Button>
          </>,
        ),
      )}
      <h3 className="mb-2 mt-[18px] text-base">{t('Создать тестового')}</h3>
      {(data?.presets ?? []).map((p) => (
        <button
          key={p.kind}
          type="button"
          disabled={!!busy}
          data-testid={`tu-new-${p.kind}`}
          onClick={async () => {
            setBusy(p.kind);
            setErr('');
            try {
              const r = await asOwner(() => api.call<Row & { uid: string }>('POST', '/admin/testusers', { kind: p.kind }));
              enter(r);
            } catch (e) {
              setErr(`${t('Не получилось создать')}: ${(e as Error).message}`);
              setBusy(null);
            }
          }}
          className="mb-2 block w-full rounded-xl bg-card p-4 text-left disabled:opacity-60"
        >
          <b>
            ＋ {busy === p.kind ? `${t('Создаю')}…` : t(p.name)}
          </b>
          <div className="text-[0.8rem] text-muted-foreground">{t(p.desc)}</div>
        </button>
      ))}
      {err && (
        <div role="alert" className="text-sm text-brand-orange">
          {err}
        </div>
      )}
    </SheetPage>
  );
}
