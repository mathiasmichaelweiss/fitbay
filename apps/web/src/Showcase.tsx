import { useState } from 'react';
import { Button, Card, Chip, Field, Seg, Sheet, Tile } from './ui';

export function Showcase() {
  const [day, setDay] = useState<'train' | 'rest'>('train');
  const [tags, setTags] = useState<string[]>(['легко']);
  const [open, setOpen] = useState(false);
  const toggle = (t: string) => setTags((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  return (
    <main className="page">
      <h1 style={{ margin: 0 }}>Витрина компонентов</h1>

      <Card title="Плитки (tile)">
        <div className="tiles">
          <Tile label="Калории" value="1 420 / 2 100" tone="orange" />
          <Tile label="Белок" value="96 г" tone="teal" />
          <Tile label="Вес" value="78,4 кг" tone="yellow" />
          <Tile label="Самочувствие" value="Хорошо" onClick={() => setOpen(true)} />
        </div>
      </Card>

      <Card title="Переключатель (seg)">
        <Seg
          value={day}
          onChange={setDay}
          options={[
            { value: 'train', label: 'Тренировка' },
            { value: 'rest', label: 'Отдых' },
          ]}
        />
      </Card>

      <Card title="Метки (chip)">
        <div className="chips">
          {['боль', 'легко', 'тяжело', 'техника'].map((t) => (
            <Chip key={t} active={tags.includes(t)} onClick={() => toggle(t)}>
              {t}
            </Chip>
          ))}
        </div>
      </Card>

      <Card title="Поля и кнопки">
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Вес, г" inputMode="decimal" placeholder="250" />
          <Button block onClick={() => setOpen(true)}>
            Открыть шторку
          </Button>
          <Button block variant="ghost">
            Вторичная кнопка
          </Button>
        </div>
      </Card>

      <Sheet open={open} title="Шторка (sheet)" onClose={() => setOpen(false)}>
        <p style={{ color: 'var(--muted)' }}>Закрывается по фону, Esc или кнопке.</p>
        <Button block onClick={() => setOpen(false)}>
          Готово
        </Button>
      </Sheet>
    </main>
  );
}
