# Layout strojov – plán implementácie

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offline PWA pre zdieľaný tablet, v ktorej majster zmeny označuje frézy (EXT modrá / INT červená), priraďuje ľudí, vidí obsadenosť, uzatvára zmenu do histórie a zdieľa Excel report.

**Architecture:** Čistá doménová logika (`src/domain`) bez závislostí na UI a DB, testovaná unit testami. Perzistencia v IndexedDB cez Dexie (`src/db`), export/záloha/import ako samostatné moduly. React UI s jednoduchým prepínaním obrazoviek v `App.tsx` (bez routera); stav číta z DB cez `useLiveQuery`.

**Tech Stack:** Node 26, Vite 8, React 19, TypeScript, Dexie 4 (+ `dexie-react-hooks`), ExcelJS 4.4, vite-plugin-pwa, Vitest 5 + `fake-indexeddb` + `@testing-library/react` + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-11-layout-strojov-design.md`

## Global Constraints

- UI text v slovenčine.
- Farby: EXT = modrá, INT = červená, voľný = sivá, mimo prevádzky = šrafovaná sivá.
- Funguje offline; žiadne sieťové volania okrem načítania samotnej aplikácie.
- Dotykové plochy min. 44 px; primárne landscape, použiteľné aj portrait.
- Beží v Chrome na Androide a v Safari na iPade.
- Úvodné stroje = 35 fréz z hárku „frezy“ (tabuľka v spec §7.6); úvodné zmeny A, B, C; ľudia prázdni.
- Obsadenosť počíta len stroje so `status: 'active'`; obsadený = typ EXT alebo INT; Ext/Int % sa počíta z obsadených; pri deliteli 0 je hodnota `null` a v UI „–“.
- História (`ShiftRecord`) je snapshot s textovými menami – žiadna neskoršia úprava ju nemení.
- Dátum záznamu = dátum `startedAt` (lokálny čas).
- Názov reportu: `Obsadenost_Frezy_<YYYY-MM-DD>_zmena-<názov zmeny>.xlsx`.
- Hosting GitHub Pages (base path = `/<názov-repa>/`). Vytvorenie GitHub repa a push **vyžaduje súhlas používateľa**.

## Review Focus

1. **Reload/zatvorenie uprostred zmeny** – po znovuotvorení musí byť draft presne taký, aký bol (test v Task 3: nová inštancia DB vidí draft).
2. **Import ľudí so špinavými dátami** (prázdne riadky, medzery, duplicitné mená, neznáma zmena) – prázdne preskočiť, orezať, duplicity v rámci zmeny preskočiť, neznáma zmena → chyba v riadku, nie pád (test v Task 6).
3. **Odstránenie stroja/človeka priradeného v draftoch iných zmien** – zmizne zo všetkých draftov, história ostane (test v Task 3).
4. **Zariadenie bez Web Share so súbormi** (desktop, starší prehliadač) – report sa stiahne namiesto zdieľania (test v Task 5).
5. **Nula obsadených / nula aktívnych strojov** – žiadne `NaN` v UI ani v Exceli, zobrazí sa „–“ (testy v Task 2 a Task 5).

---

## Súborová štruktúra

```
src/domain/types.ts         – všetky doménové typy
src/domain/cellRange.ts     – "G5:I7" → {x,y,w,h}
src/domain/seed.ts          – úvodné stroje a zmeny
src/domain/stats.ts         – výpočet obsadenosti
src/domain/record.ts        – zostavenie ShiftRecord (snapshot, nadčas, dátum)
src/db/db.ts                – Dexie schéma + seed pri prvom spustení
src/db/repo.ts              – operácie nad dátami (drafty, ľudia, stroje, zmeny, záznamy)
src/report/xlsx.ts          – Excel report a export histórie
src/report/share.ts         – zdieľanie / stiahnutie súboru
src/backup/backup.ts        – záloha a obnova celej DB (JSON)
src/import/peopleImport.ts  – import ľudí z CSV/XLSX
src/ui/…                    – React obrazovky (Task 7–9)
```

---

### Task 1: Kostra projektu, doménové typy, pozície strojov

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx` (zatiaľ len nadpis), `.gitignore`
- Create: `src/domain/types.ts`, `src/domain/cellRange.ts`, `src/domain/seed.ts`
- Test: `src/domain/cellRange.test.ts`, `src/domain/seed.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type OrderType = 'EXT' | 'INT';
  export type MachineStatus = 'active' | 'out_of_service';
  export interface Machine { id: string; hallId: string; name: string; x: number; y: number; w: number; h: number; status: MachineStatus }
  export interface Shift { id: string; name: string; order: number }
  export interface Person { id: string; name: string; shiftId: string; active: boolean }
  export interface Assignment { type: OrderType | null; personIds: string[] }
  export interface ShiftDraft { shiftId: string; foremanName: string; startedAt: string; assignments: Record<string, Assignment> }
  export interface Stats { total: number; occupied: number; ext: number; int: number; occupancyPct: number | null; extPct: number | null; intPct: number | null; peopleWithoutType: number }
  export interface RecordPerson { name: string; homeShiftName: string; overtime: boolean }
  export interface RecordRow { machineName: string; type: OrderType | null; outOfService: boolean; people: RecordPerson[] }
  export interface ShiftRecord { id: string; shiftId: string; shiftName: string; foremanName: string; date: string; startedAt: string; closedAt: string; stats: Stats; rows: RecordRow[]; layout: { name: string; x: number; y: number; w: number; h: number; type: OrderType | null; outOfService: boolean }[] }
  ```
  (`date` = `YYYY-MM-DD`; `startedAt`/`closedAt` = ISO; `layout` slúži na vykreslenie pôdorysu v detaile histórie.)
- Produces: `parseCellRange(range: string): { col: number; row: number; w: number; h: number }` (A=1, AA=27, riadky 1-based).
- Produces: `seedMachines(hallId: string): Machine[]` – 35 strojov, pozície normalizované tak, že min. x = 0 a min. y = 0; `seedShifts(): Shift[]` – A, B, C s `order` 0,1,2; `HALL_FREZY = 'frezy'`.

- [ ] **Step 1:** `git init`, scaffold Vite React-TS, nainštalovať `dexie dexie-react-hooks exceljs` a dev `vitest jsdom fake-indexeddb @testing-library/react @testing-library/jest-dom vite-plugin-pwa`; nastaviť `vitest` s `environment: 'jsdom'` a `setupFiles` s `fake-indexeddb/auto`. Ak vite-plugin-pwa neuvádza podporu Vite 8 v peerDependencies, použiť najnovšiu Vite, ktorú podporuje, a zapísať to do commit správy.
- [ ] **Step 2: Failing testy**
  ```ts
  test('parseCellRange', () => {
    expect(parseCellRange('G5:I7')).toEqual({ col: 7, row: 5, w: 3, h: 3 });
    expect(parseCellRange('AE5:AF6')).toEqual({ col: 31, row: 5, w: 2, h: 2 });
    expect(parseCellRange('S5')).toEqual({ col: 19, row: 5, w: 1, h: 1 });
  });
  test('seedMachines', () => {
    const m = seedMachines('frezy');
    expect(m).toHaveLength(35);
    expect(new Set(m.map(x => x.name)).size).toBe(35);
    expect(m.find(x => x.name === 'SHW')).toMatchObject({ x: 0, y: 11, w: 5, h: 7 });   // A16:E22, min row 5
    expect(m.find(x => x.name === 'HERMLE C60')).toMatchObject({ x: 6, y: 0, w: 3, h: 3 });
    expect(m.find(x => x.name === 'EDEL')).toBeDefined();               // orezaná medzera
    expect(m.every(x => x.status === 'active' && x.hallId === 'frezy')).toBe(true);
  });
  ```
- [ ] **Step 3:** `npx vitest run src/domain` → FAIL (moduly neexistujú).
- [ ] **Step 4:** Implementovať. `seed.ts` obsahuje dvojice `[name, range]` presne podľa tabuľky v spec §7.6 (názov `DMU 80P HI-DYN` s jednou medzerou, `EDEL` bez medzery). ID strojov stabilné: `m-<index>`.
- [ ] **Step 5:** `npx vitest run src/domain` → PASS; `npm run build` → bez chýb.
- [ ] **Step 6:** Commit `feat: scaffold, domain types, seed machines`.

---

### Task 2: Výpočet obsadenosti

**Files:** Create `src/domain/stats.ts`; Test `src/domain/stats.test.ts`

**Interfaces:**
- Consumes: `Machine`, `Assignment`, `Stats` (Task 1)
- Produces: `computeStats(machines: Machine[], assignments: Record<string, Assignment>): Stats` – percentá ako celé čísla (`Math.round`), `null` pri deliteli 0; `peopleWithoutType` = počet aktívnych strojov s ľuďmi a `type === null`.

- [ ] **Step 1: Failing testy**
  - 4 aktívne + 1 mimo prevádzky; EXT na 2, INT na 1, mimo prevádzky má EXT → `{ total: 4, occupied: 3, ext: 2, int: 1, occupancyPct: 75, extPct: 67, intPct: 33 }`.
  - Žiadne priradenia → `occupancyPct: 0, extPct: null, intPct: null`.
  - Žiadne aktívne stroje → `occupancyPct: null`.
  - Stroj s `personIds: ['p1']`, `type: null` → `occupied` sa nezvýši, `peopleWithoutType: 1`.
  - Priradenie pre neexistujúce `machineId` sa ignoruje.
- [ ] **Step 2:** `npx vitest run src/domain/stats.test.ts` → FAIL.
- [ ] **Step 3:** Implementovať `computeStats`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat: occupancy stats`.

---

### Task 3: Databáza a repozitár

**Files:** Create `src/db/db.ts`, `src/db/repo.ts`; Test `src/db/repo.test.ts`

**Interfaces:**
- Consumes: typy a `seedMachines`, `seedShifts`, `HALL_FREZY` (Task 1)
- Produces (`db.ts`): `class AppDB extends Dexie` s tabuľkami `machines` (`id, hallId`), `shifts` (`id, order`), `people` (`id, shiftId`), `drafts` (`shiftId`), `records` (`id, shiftId, date`), `meta` (`key`); `version(1)`. `openDB(name = 'layout-strojov'): AppDB`; `ensureSeeded(db): Promise<void>` – naplní stroje a zmeny len ak `meta.seeded` chýba.
- Produces (`repo.ts`, všetky funkcie berú `db: AppDB` ako 1. parameter):
  - `getDraft(db, shiftId): Promise<ShiftDraft | undefined>`
  - `startDraft(db, shiftId, foremanName, now: Date): Promise<ShiftDraft>` – prázdne priradenia, `startedAt = now.toISOString()`; uloží `meta['lastForeman:'+shiftId] = foremanName`
  - `getLastForeman(db, shiftId): Promise<string | undefined>`
  - `setMachineType(db, shiftId, machineId, type: OrderType | null)`
  - `togglePerson(db, shiftId, machineId, personId)`
  - `copyFromLastRecord(db, shiftId): Promise<boolean>` – prevezme typy a ľudí z posledného záznamu **ktorejkoľvek** zmeny podľa názvov strojov a ID ľudí, ktorí stále existujú a sú aktívni (mapovanie mien → id); vráti `false`, ak záznam neexistuje
  - `upsertPerson(db, p: Omit<Person,'id'> & { id?: string }): Promise<string>`, `deletePerson(db, id)` – odstráni z `personIds` vo všetkých draftoch; `setPersonActive(db, id, active)` – pri `false` tiež odstráni z draftov
  - `upsertMachine(db, m: Omit<Machine,'id'> & { id?: string })`, `deleteMachine(db, id)` – odstráni kľúč zo všetkých draftov
  - `upsertShift(db, s)`, `deleteShift(db, id)` – zlyhá s chybou `'Zmena má priradených ľudí'`, ak má ľudí
  - `saveRecordAndReset(db, record: ShiftRecord)` – v jednej transakcii uloží záznam a zmaže draft zmeny
  - `listRecords(db, filter?: { shiftId?: string; from?: string; to?: string }): Promise<ShiftRecord[]>` – zoradené od najnovšieho

- [ ] **Step 1: Failing testy** (každý test s unikátnym názvom DB)
  - `ensureSeeded` dvakrát → 35 strojov, 3 zmeny (žiadne duplicity).
  - `startDraft` + `setMachineType` + `togglePerson`; **nová inštancia** `openDB` s rovnakým menom vráti rovnaký draft. *(Review Focus 1)*
  - `togglePerson` dvakrát → človek odstránený.
  - Drafty zmien A a B sú nezávislé.
  - `deleteMachine` odstráni stroj z draftov A aj B; existujúci záznam v `records` ostane nezmenený. *(Review Focus 3)*
  - `deletePerson` a `setPersonActive(false)` odstránia človeka z draftov. *(Review Focus 3)*
  - `deleteShift` so ľuďmi → reject s `'Zmena má priradených ľudí'`.
  - `saveRecordAndReset` → `getDraft` vráti `undefined`, `listRecords` vráti záznam.
  - `copyFromLastRecord` prevezme typ podľa názvu stroja, vynechá deaktivovaného človeka.
- [ ] **Step 2:** `npx vitest run src/db` → FAIL.
- [ ] **Step 3:** Implementovať. ID cez `crypto.randomUUID()`. Zápisy, ktoré menia viac draftov, v `db.transaction('rw', …)`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat: IndexedDB storage and repository`.

---

### Task 4: Zostavenie záznamu zmeny

**Files:** Create `src/domain/record.ts`; Test `src/domain/record.test.ts`

**Interfaces:**
- Consumes: typy, `computeStats` (Task 2)
- Produces: `buildShiftRecord(input: { draft: ShiftDraft; shift: Shift; machines: Machine[]; people: Person[]; shifts: Shift[]; now: Date; id: string }): ShiftRecord`
  - `rows`: aktívne stroje v poradí podľa `y`, potom `x`; za nimi stroje mimo prevádzky s `outOfService: true`, `type: null`, bez ľudí.
  - `overtime = person.shiftId !== draft.shiftId`; `homeShiftName` z `shifts`.
  - `date` = lokálny dátum z `draft.startedAt` vo formáte `YYYY-MM-DD`.
  - Ľudia, ktorí už neexistujú, sa vynechajú.
  - `layout`: všetky stroje haly s `x,y,w,h`, `type` z draftu (mimo prevádzky `null`) a `outOfService`.

- [ ] **Step 1: Failing testy**
  - `layout` má 35 položiek a stroj s EXT v drafte má v `layout` `type: 'EXT'`.
  - Draft začatý `2026-11-10T22:00` (lokálne), `now` = `2026-11-11T06:00` → `date === '2026-11-10'`.
  - Človek zo zmeny A na stroji v drafte zmeny B → `overtime: true, homeShiftName: 'A'`.
  - Stroj mimo prevádzky je posledný v `rows` s `outOfService: true`.
  - `stats` sa rovná `computeStats(machines, draft.assignments)`.
  - Po zostavení zmena `people[0].name` nezmení `record.rows` (snapshot – kópie reťazcov).
- [ ] **Step 2:** → FAIL. **Step 3:** Implementovať. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat: shift record snapshot`.

---

### Task 5: Excel report, export histórie, zdieľanie

**Files:** Create `src/report/xlsx.ts`, `src/report/share.ts`; Test `src/report/xlsx.test.ts`, `src/report/share.test.ts`

**Interfaces:**
- Consumes: `ShiftRecord` (Task 1)
- Produces:
  - `reportFileName(r: ShiftRecord): string` → `Obsadenost_Frezy_2026-11-11_zmena-B.xlsx`
  - `buildReportXlsx(r: ShiftRecord): Promise<Blob>` – hárok „Report“, rozloženie podľa spec §7.5; hlavička riadky 1–4, tabuľka od riadku 6 so stĺpcami `Stroj | Zakázka | Ľudia | Nadčas`; Zakázka = `EXT`/`INT`/`–`, pre mimo prevádzky `mimo prevádzky`; ľudia nadčasu ako `Meno (A)`; Nadčas = `áno` ak aspoň jeden; bunka Zakázka podfarbená modrou/červenou
  - `buildHistoryXlsx(records: ShiftRecord[]): Promise<Blob>` – hárok „História“, riadok na záznam: `Dátum | Zmena | Majster | Strojov | Obsadené | Obsadenosť % | EXT | INT | EXT % | INT %`
  - `formatPct(v: number | null): string` → `'75 %'` alebo `'–'`
  - `shareOrDownload(blob: Blob, fileName: string): Promise<'shared' | 'downloaded' | 'cancelled'>` – ak `navigator.canShare?.({ files: [file] })`, použije `navigator.share`; `AbortError` → `'cancelled'`; inak stiahne cez `<a download>`

- [ ] **Step 1: Failing testy** (Blob načítať späť cez `ExcelJS.Workbook().xlsx.load`)
  - Bunka A1 = `Report obsadenosti – Frézy`; riadok so štatistikami obsahuje `Obsadené: 3 (75 %)`.
  - Riadok stroja s nadčasom: C = `Horváth, Baláž (A)`, D = `áno`.
  - Záznam s `extPct: null` → v hlavičke `EXT: 0 (–)`; žiadna bunka neobsahuje `NaN`. *(Review Focus 5)*
  - `buildHistoryXlsx` s 2 záznamami → 3 riadky (hlavička + 2).
  - `reportFileName` presný formát.
  - `shareOrDownload`: bez `navigator.canShare` → `'downloaded'` a kliknutý `<a>` s `download === fileName` *(Review Focus 4)*; s mockom `share` → `'shared'`; `share` hodí `AbortError` → `'cancelled'`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementovať. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat: xlsx report, history export, share`.

---

### Task 6: Záloha/obnova a import ľudí

**Files:** Create `src/backup/backup.ts`, `src/import/peopleImport.ts`; Test `src/backup/backup.test.ts`, `src/import/peopleImport.test.ts`

**Interfaces:**
- Consumes: `AppDB`, `upsertPerson` (Task 3)
- Produces:
  - `exportBackup(db): Promise<Blob>` – JSON `{ app: 'layout-strojov', version: 1, exportedAt, tables: { machines, shifts, people, drafts, records, meta } }`; `backupFileName(now: Date)` → `zaloha-layout-strojov-YYYY-MM-DD.json`
  - `importBackup(db, file: Blob): Promise<void>` – overí `app` a `version`, inak chyba `'Neplatný súbor zálohy'`; nahradí všetky tabuľky v jednej transakcii; zapíše `meta.lastBackupAt`
  - `isBackupDue(lastBackupAt: string | undefined, now: Date): boolean` – `true` ak chýba alebo je staršia ako 7 dní
  - `parsePeopleFile(file: File): Promise<{ name: string; shiftName: string }[]>` – `.csv` (oddeľovač `;` alebo `,`, UTF-8 s/bez BOM) alebo `.xlsx` (prvý hárok); 1. riadok je hlavička so stĺpcami `meno` a `zmena` (bez ohľadu na veľkosť písmen a diakritiku)
  - `applyPeopleImport(db, rows): Promise<{ added: number; skipped: number; errors: { line: number; message: string }[] }>` – orezať medzery; prázdne meno preskočiť; duplicitné meno v rovnakej zmene (aj voči existujúcim) preskočiť; neznáma zmena → chyba `Neznáma zmena „X“` s číslom riadku

- [ ] **Step 1: Failing testy**
  - Export → import do prázdnej DB → rovnaký obsah všetkých tabuliek.
  - Import JSON s `app: 'iné'` → reject `'Neplatný súbor zálohy'`; DB nezmenená.
  - `isBackupDue(undefined, now) === true`; 6 dní → `false`; 8 dní → `true`.
  - CSV `Meno;Zmena\n Kováč ;A\n;B\nKováč;A\nNovák;X\nHorváth;b` → `added: 2` (Kováč, Horváth – zmena bez ohľadu na veľkosť písmen), `skipped: 2`, `errors: [{ line: 5, message: 'Neznáma zmena „X“' }]`. *(Review Focus 2)*
  - XLSX s rovnakými dátami → rovnaký výsledok.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementovať. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat: backup/restore and people import`.

---

### Task 7: UI – výber zmeny, pôdorys, panel stroja

**Files:**
- Create: `src/ui/ShiftPicker.tsx`, `src/ui/Header.tsx`, `src/ui/LayoutView.tsx`, `src/ui/MachineTile.tsx`, `src/ui/MachinePanel.tsx`, `src/ui/PeoplePicker.tsx`, `src/ui/styles.css`, `src/ui/useDB.ts`
- Modify: `src/App.tsx`
- Test: `src/ui/PeoplePicker.test.tsx`, `src/ui/App.test.tsx`

**Interfaces:**
- Consumes: repo (Task 3), `computeStats` (Task 2), `formatPct` (Task 5)
- Produces: `useDB(): AppDB` (kontext, v testoch injektovateľná DB); `App` s obrazovkami `'picker' | 'layout' | 'history' | 'settings'` a stavom `currentShiftId`.
- `PeoplePicker` props: `{ people: Person[]; shifts: Shift[]; currentShiftId: string; selected: string[]; onToggle(id: string): void }` – sekcia „Moja zmena <X>“ (aktívni ľudia zmeny, abecedne), pod ňou zbalená sekcia „Iné zmeny (nadčas)“ zoskupená podľa zmien v poradí `order`; vybraný človek z inej zmeny je vždy viditeľný aj pri zbalenej sekcii.

**Správanie:**
- Štart: tlačidlá zmien; pole „Meno majstra“ predvyplnené `getLastForeman`; „Pokračovať“ je neaktívne pri prázdnom mene. Ak existuje draft: dialóg „Rozpracované od <d.M. HH:mm> – Pokračovať / Začať nanovo“; pri novom drafte tlačidlo „Prevziať stav z poslednej zmeny“ (`copyFromLastRecord`).
- Hlavička: veľký štítok „Zmena B · Novák“, „Zmeniť zmenu“, obsadenosť a EXT/INT cez `formatPct`, tlačidlá História a ⚙.
- Pôdorys: CSS grid podľa `x,y,w,h`, mierka podľa šírky okna; dlaždica = názov + mená ľudí; farby podľa Global Constraints; legenda.
- Panel stroja (bottom sheet): EXT / INT / Voľný + `PeoplePicker`; každá zmena okamžite cez repo. Stroj mimo prevádzky sa neotvorí na úpravu (len info).

- [ ] **Step 1: Failing testy**
  - `PeoplePicker`: ľudia vlastnej zmeny sú pred nadpisom „Iné zmeny (nadčas)“; neaktívni sa nezobrazia; vybraný človek z inej zmeny je viditeľný pri zbalenej sekcii.
  - `App` (fake DB, seed): výber „B“ + meno „Novák“ → hlavička obsahuje „Zmena B · Novák“ a 35 dlaždíc; ťuk na „HERMLE C60“ → „EXT“ → hlavička ukazuje `Obsadenosť 3 %` (1/35) a `EXT 100 %`.
- [ ] **Step 2:** `npx vitest run src/ui` → FAIL. **Step 3:** Implementovať. **Step 4:** → PASS.
- [ ] **Step 5:** `npm run dev`, v prehliadači v rozlíšení 1280×800 a 800×1280 overiť, že pôdorys sa zmestí bez vodorovného posúvania a dlaždice sú ťukateľné.
- [ ] **Step 6:** Commit `feat: shift picker, layout and machine panel`.

---

### Task 8: UI – uzavretie zmeny a história

**Files:** Create `src/ui/CloseShiftDialog.tsx`, `src/ui/HistoryView.tsx`, `src/ui/RecordDetail.tsx`; Test `src/ui/CloseShift.test.tsx`, `src/ui/History.test.tsx`

**Interfaces:**
- Consumes: `buildShiftRecord` (Task 4), `saveRecordAndReset`, `listRecords` (Task 3), `buildReportXlsx`, `buildHistoryXlsx`, `reportFileName`, `shareOrDownload` (Task 5)

**Správanie:**
- „Uzavrieť zmenu a vytvoriť report“ → dialóg so súhrnom a upozornením „N strojov má ľudí bez farby“ (ak `peopleWithoutType > 0`) → „Uzavrieť a zdieľať“: zostaví záznam, uloží (`saveRecordAndReset`), vygeneruje XLSX, zavolá `shareOrDownload`, vráti sa na výber zmeny. Záznam sa uloží aj keď zdieľanie zruší.
- História: zoznam (dátum, zmena, majster, obsadenosť, EXT/INT), filter zmena + dátum od/do, „Exportovať do Excelu“ (filtrované záznamy). Detail: pôdorys z `record.layout` vo farbách + tabuľka riadkov + „Zdieľať report“.

- [ ] **Step 1: Failing testy**
  - Uzavretie s jedným EXT strojom → v `records` 1 záznam so `stats.ext === 1`, draft zmeny zmazaný, zobrazí sa výber zmeny; `shareOrDownload` (mock) zavolaný s názvom `Obsadenost_Frezy_…_zmena-B.xlsx`.
  - Upozornenie „1 stroj má ľudí bez farby“ sa zobrazí v dialógu.
  - História s 2 záznamami zmien A a B, filter „A“ → 1 riadok.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementovať. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat: close shift and history`.

---

### Task 9: UI – nastavenia (ľudia, stroje, zmeny, záloha)

**Files:** Create `src/ui/settings/SettingsView.tsx`, `PeopleSettings.tsx`, `MachineEditor.tsx`, `ShiftSettings.tsx`, `BackupSettings.tsx`; Test `src/ui/settings/MachineEditor.test.tsx`, `src/ui/settings/People.test.tsx`

**Interfaces:**
- Consumes: repo (Task 3), `exportBackup`, `importBackup`, `isBackupDue`, `backupFileName`, `parsePeopleFile`, `applyPeopleImport` (Task 6), `shareOrDownload` (Task 5)
- Produces: `moveMachine(m: Machine, dx: number, dy: number): Machine` a `resizeMachine(m: Machine, dw: number, dh: number): Machine` v `src/domain/layoutEdit.ts` – súradnice min. 0, rozmery min. 1.

**Správanie:**
- Ľudia: zoznam podľa zmien, pridať/upraviť (meno, zmena), aktívny/neaktívny, odstrániť s potvrdením; „Importovať zo súboru“ so súhrnom `Pridaných X, preskočených Y` a zoznamom chýb.
- Stroje: režim úprav pôdorysu – ťuk vyberie stroj; tlačidlá ←↑→↓ (posun o 1 bunku) a „širší/užší/vyšší/nižší“; ťahanie prstom voliteľné; premenovať, prepnúť „mimo prevádzky“, „Odstrániť“ (potvrdenie s textom „Radšej zvážte ‚mimo prevádzky‘ – odstránenie nevráti späť“), „Pridať stroj“ (umiestni na prvé voľné miesto pod existujúcimi).
- Zmeny: premenovať, pridať, odstrániť (chyba z repo zobraziť).
- Záloha: „Uložiť zálohu“ (`shareOrDownload` + `meta.lastBackupAt`), „Obnoviť zo zálohy“ s potvrdením; na hlavnej obrazovke banner „Odporúčame uložiť zálohu“, ak `isBackupDue`.

- [ ] **Step 1: Failing testy**
  - `moveMachine({x:0,…}, -1, 0).x === 0`; `resizeMachine({w:1,…}, -1, 0).w === 1`.
  - MachineEditor: vyber „DMC 1035“ → → → stroj v DB má `x` o 1 väčšie; premenovanie sa prejaví v DB.
  - People: pridanie „Kováč“ do zmeny A sa objaví v `PeoplePicker` zmeny A pod „Moja zmena A“.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementovať. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `feat: settings for people, machines, shifts, backup`.

---

### Task 10: PWA, trvalé úložisko, nasadenie

**Files:**
- Modify: `vite.config.ts` (VitePWA: `registerType: 'autoUpdate'`, manifest `name: 'Layout strojov'`, `short_name: 'Layout'`, `display: 'standalone'`, `orientation: 'any'`, ikony 192/512 + maskable; `base` z env `BASE_PATH`, predvolene `/`)
- Create: `public/icons/*.png`, `src/pwa.ts` (`requestPersistentStorage(): Promise<boolean>` volá `navigator.storage?.persist?.()`), `.github/workflows/deploy.yml`, `README.md` (inštalácia na tablet: Chrome → „Pridať na plochu“, Safari → Zdieľať → „Pridať na plochu“; záloha)
- Modify: `src/main.tsx` (volanie `ensureSeeded` a `requestPersistentStorage` pri štarte)

- [ ] **Step 1:** Test `src/pwa.test.ts`: bez `navigator.storage` → `false`, s mockom `persist` → `true`. → FAIL → implementovať → PASS.
- [ ] **Step 2:** `npm run build && npx vite preview`; v prehliadači overiť: manifest načítaný, service worker aktívny, po prepnutí DevTools na Offline a reloade aplikácia funguje a dáta ostali.
- [ ] **Step 3:** Workflow: na push do `main` → `npm ci`, `npx vitest run`, `npm run build` s `BASE_PATH=/<repo>/`, deploy cez `actions/deploy-pages`.
- [ ] **Step 4:** Commit `feat: PWA, persistent storage, GitHub Pages deploy`.
- [ ] **Step 5:** **Opýtať sa používateľa** na názov a viditeľnosť GitHub repa; až po súhlase `gh repo create`, push, zapnúť Pages (source: GitHub Actions) a overiť, že URL sa načíta.
