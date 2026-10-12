import { useState } from 'react';
import { InfoIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Field, FieldGroup } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { MacroBar, Ring } from '@/components/ui/ring';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tile, Tiles } from '@/components/ui/tile';
import { SingleToggle, ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ru } from 'date-fns/locale';

const COLORS = ['orange', 'yellow', 'teal', 'red', 'surface', 'surface-2', 'line', 'muted'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {children}
    </Card>
  );
}

export function Showcase() {
  const [day, setDay] = useState<'train' | 'rest'>('train');
  const [tags, setTags] = useState<string[]>(['легко']);
  const [drawer, setDrawer] = useState(false);
  const [date, setDate] = useState('');
  const [cal, setCal] = useState<Date | undefined>(new Date());
  const [act, setAct] = useState('mid');
  const [ok, setOk] = useState(true);

  return (
    <main className="mx-auto grid max-w-[480px] gap-4 px-4 py-6">
      <div className="flex items-center gap-2">
        <h1 className="m-0 flex-1 text-[28px] font-bold">Витрина компонентов</h1>
        <a href="/" className="text-brand-teal">← В приложение</a>
      </div>
      <p className="m-0 text-sm text-muted-foreground">
        Основа: shadcn/ui в <code>apps/web/src/components/ui</code>, токены в <code>src/tokens.css</code>. Все оверлеи кастомные: шторка, диалог, поповер, выпадающий список, календарь.
      </p>

      <Section title="Цвета">
        <div className="grid grid-cols-2 gap-2">
          {COLORS.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <span className="size-7 rounded-md border" style={{ background: `var(--${c})` }} />
              <code className="text-xs">--{c}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Button">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Tile, Ring, Progress">
        <Tiles>
          <Tile label="Калории" value="1 420" tone="orange" />
          <Tile label="Белок" value="96 г" tone="teal" />
        </Tiles>
        <div className="flex items-center gap-4">
          <Ring value={0.62} size={120} stroke={10}>
            <span className="text-xl font-bold">62%</span>
          </Ring>
          <div className="grid flex-1 gap-3">
            <MacroBar label="Белки" eaten={96} goal={144} color="teal" unit="г" />
            <MacroBar label="Жиры" eaten={80} goal={72} color="yellow" unit="г" />
          </div>
        </div>
        <Progress value={40} />
      </Section>

      <Section title="ToggleGroup: сегмент и чипы">
        <SingleToggle value={day} onChange={setDay} options={[{ value: 'train', label: 'Тренировка' }, { value: 'rest', label: 'Отдых' }]} />
        <ToggleGroup type="multiple" variant="chip" value={tags} onValueChange={setTags}>
          {['боль', 'легко', 'тяжело', 'техника'].map((t) => (
            <ToggleGroupItem key={t} value={t}>{t}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex flex-wrap gap-2">
          <Badge>Новое</Badge>
          <Badge variant="good">Сон 5</Badge>
          <Badge variant="warn">Стресс 3</Badge>
          <Badge variant="bad">Боль 4</Badge>
        </div>
      </Section>

      <Section title="Формы">
        <Field label="Вес, г" inputMode="decimal" placeholder="250" />
        <FieldGroup label="Активность (Select)">
          <Select value={act} onValueChange={setAct}>
            <SelectTrigger aria-label="Активность">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Сидячая</SelectItem>
              <SelectItem value="light">Лёгкая</SelectItem>
              <SelectItem value="mid">Средняя</SelectItem>
              <SelectItem value="high">Высокая</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="Дата (DatePicker)">
          <DatePicker title="Дата рождения" value={date} onChange={setDate} placeholder="Выберите дату" doneLabel="Готово" max={new Date().toISOString().slice(0, 10)} />
        </FieldGroup>
        <label htmlFor="sc-ok" className="flex min-h-11 items-center gap-3">
          <Checkbox id="sc-ok" checked={ok} onCheckedChange={(v) => setOk(v === true)} /> Чекбокс
        </label>
      </Section>

      <Section title="Calendar">
        <Calendar mode="single" locale={ru} weekStartsOn={1} captionLayout="dropdown" selected={cal} onSelect={setCal} startMonth={new Date(2020, 0)} endMonth={new Date(2030, 11)} />
      </Section>

      <Section title="Оверлеи">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDrawer(true)}>Открыть шторку</Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Диалог</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Удалить запись?</DialogTitle>
              <DialogDescription>Действие нельзя отменить.</DialogDescription>
              <Button variant="destructive">Удалить</Button>
            </DialogContent>
          </Dialog>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Подсказка">
                <InfoIcon className="size-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <p className="m-0 text-sm">Поповер для подсказок и «?»-справки.</p>
            </PopoverContent>
          </Popover>
        </div>
        <Separator />
        <CardDescription>Шторка закрывается свайпом вниз, по фону или Esc.</CardDescription>
      </Section>

      <Drawer open={drawer} onOpenChange={setDrawer}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Шторка (Drawer)</DrawerTitle>
            <DrawerDescription>Основной оверлей приложения на мобильном.</DrawerDescription>
          </DrawerHeader>
          <Button className="w-full" onClick={() => setDrawer(false)}>
            Готово
          </Button>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
