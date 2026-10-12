import fs from 'node:fs';
import path from 'node:path';
import { MemoryRepo, type Item } from './repo';

/** Локальная база для разработки: MemoryRepo, который сохраняется в JSON-файл после каждой записи. */
export class FileRepo extends MemoryRepo {
  constructor(private file: string) {
    super();
    try {
      const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as Item[];
      for (const r of rows) this.items.set(`${r.PK}\u0000${r.SK}`, r);
    } catch {
      /* файла ещё нет */
    }
  }
  private flush() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify([...this.items.values()], null, 1));
    fs.renameSync(tmp, this.file);
  }
  protected override afterWrite() {
    this.flush();
  }
  override async put(item: Item) {
    await super.put(item);
    this.flush();
  }
  override async delete(pk: string, sk: string) {
    await super.delete(pk, sk);
    this.flush();
  }
}
