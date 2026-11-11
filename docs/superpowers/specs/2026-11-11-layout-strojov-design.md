# Layout strojov – obsadenosť zmeny (návrh)

Dátum: 2026-11-11 · Stav: návrh na schválenie

## 1. Zámer a prečo

Majster zmeny potrebuje rýchlo zaznamenať, ktoré frézy v hale bežia na externej a ktoré na internej zakázke a kto na nich robí. Supervisor z toho dostáva report obsadenosti za zmenu. Dnes existuje len statický pôdorys v Exceli (`Layout MPS.xlsx`). Aplikácia ho nahrádza interaktívnou verziou na tablete, počíta obsadenosť a pomer ext/int a drží históriu uzavretých zmien.

## 2. Ciele

- Pôdorys fréz podľa hárku **„frezy“** z `Layout MPS.xlsx` (35 strojov), dotykovo ovládateľný na tablete.
- Označenie stroja: **modrá = externá zakázka**, **červená = interná**, bez farby = voľný.
- Priradenie ľudí k stroju zo zoznamu: najprv ľudia zmeny majstra, potom sekcia **„Iné zmeny (nadčas)“**.
- Výpočet **obsadenosti** a **pomeru ext/int** zobrazený priebežne.
- **Uzavretie zmeny** → záznam do histórie; prezeranie histórie.
- **Report ako Excel tabuľka**, odoslaný cez systémové „Zdieľať“ (e‑mail, Teams…).
- **Správa ľudí** (pridať, upraviť, zmeniť zmenu, deaktivovať) a import dodaného zoznamu.
- **Správa strojov** (pridať, premenovať, presunúť/zmeniť veľkosť na pôdoryse, vyradiť z prevádzky, odstrániť).

## 3. Mimo rozsahu (zatiaľ)

- Sústruhy (doplnia sa neskôr ako ďalšia hala/záložka – dátový model to musí umožniť).
- Synchronizácia medzi viacerými zariadeniami, server, prihlasovanie heslom.
- Automatické odosielanie reportu bez zásahu majstra.

## 4. Anti‑ciele (čo by bolo zlyhanie, aj keby to „fungovalo“)

- Strata dát pri bežnom používaní (zatvorenie aplikácie, reštart tabletu, výpadok Wi‑Fi).
- Úprava ľudí/strojov spätne prepíše históriu (história musí ostať taká, aká bola v čase uzavretia).
- Ovládanie, ktoré na tablete prstom nejde rýchlo – označenie stroja má byť na 1–2 ťuknutia.
- Majster omylom pracuje v cudzej zmene bez toho, aby to videl.

## 5. Obmedzenia

- Jeden zdieľaný tablet vo výrobe; každý majster spravuje len svoju zmenu.
- Musí fungovať **offline**; dáta zostávajú len v tablete.
- Platforma tabletu nie je určená → musí bežať na Androide (Chrome) aj iPade (Safari).
- Hosting: **GitHub Pages** pod účtom používateľa (kód je verejný, dáta nie). *(Moje rozhodnutie – používateľ nenamietal; ak je problém, alternatíva je súkromný hosting.)*

## 6. Zvažované prístupy

| Prístup | Výhody | Nevýhody |
|---|---|---|
| **1. PWA – webová aplikácia inštalovaná na plochu** ✅ zvolené | Android aj iPad, bez obchodu, aktualizácie automaticky, offline, najľahšie neskoršie doplnenie synchronizácie | Prehliadač môže dáta zmazať pri „vymazaní dát stránky“ → riešené zálohou |
| 2. Natívna app (React Native/Expo) | Spoľahlivejšie úložisko, natívne zdieľanie | Inštalácia cez APK/TestFlight, každá aktualizácia = nový build |
| 3. Flutter | Ako 2 | Ako 2, bez prínosu navyše |

Používateľ zvolil **prístup 1**.

## 7. Návrh

### 7.1 Technológie (moje rozhodnutia)

- Vite + React + TypeScript.
- IndexedDB cez **Dexie** (lokálna databáza); pri štarte `navigator.storage.persist()` (žiadosť o trvalé úložisko).
- PWA cez **vite-plugin-pwa** (service worker, manifest, offline).
- Excel export knižnicou na XLSX (napr. ExcelJS) – výber necháva na staviteľa.
- Zdieľanie súboru: **Web Share API** (`navigator.share({ files })`); ak nie je k dispozícii, súbor sa stiahne.
- Testy: Vitest (logika výpočtov, export, migrácie dát).
- Nasadenie: GitHub Actions → GitHub Pages.
- Rozhranie v slovenčine, primárne na šírku (landscape), použiteľné aj na výšku.

### 7.2 Dátový model

```
Hall        { id, name }                                  // zatiaľ jedna: "Frézy"
Machine     { id, hallId, name, x, y, w, h, status }      // x,y,w,h v bunkách mriežky; status: active | out_of_service
Shift       { id, name, order }                           // predvolené A, B, C – upraviteľné
Person      { id, name, shiftId, active }
ShiftDraft  { shiftId, foremanName, startedAt,
              assignments: { [machineId]: { type: 'EXT'|'INT'|null, personIds: string[] } } }
ShiftRecord { id, shiftId, shiftName, foremanName, date, startedAt, closedAt,
              stats: { total, occupied, ext, int, occupancyPct, extPct, intPct },
              rows: [{ machineName, type, people: [{ name, homeShiftName, overtime: bool }] }] }
```

- **ShiftRecord je odfotený snapshot** – obsahuje mená strojov a ľudí ako text, nie odkazy. Neskoršie premenovanie/odstránenie neovplyvní históriu.
- Každá zmena má vlastný rozpracovaný `ShiftDraft`; drafty zmien sa navzájom neovplyvňujú.
- Schéma DB má verziu a migrácie (Dexie versioning), aby sa dalo neskôr doplniť sústruhy či synchronizácia.

### 7.3 Výpočty

- **Celkom strojov** = stroje so stavom `active` (vyradené z prevádzky sa nepočítajú). *(Moje rozhodnutie.)*
- **Obsadené** = aktívne stroje s typom EXT alebo INT.
- **Obsadenosť %** = obsadené / celkom.
- **Ext %** = EXT / obsadené; **Int %** = INT / obsadené (pri 0 obsadených zobraziť „–“).
- Stroj s ľuďmi, ale bez farby, sa nepočíta ako obsadený; zobrazí sa upozornenie. *(Moje rozhodnutie.)*
- Jeden človek môže byť na viacerých strojoch naraz (obsluha viacerých CNC je bežná); na karte človeka sa ukáže počet strojov. *(Moje rozhodnutie.)*

### 7.4 Obrazovky a tok

**Štart – výber zmeny**
```
┌──────────────────────────────┐
│  Vyber svoju zmenu           │
│  [  A  ]  [  B  ]  [  C  ]   │
│  Meno majstra: [__________]  │  (predvyplní sa posledné meno danej zmeny)
│           [ Pokračovať ]     │
└──────────────────────────────┘
```
Po výbere je zmena viditeľná stále v hlavičke (veľký štítok „Zmena B · Novák“) s tlačidlom „Zmeniť zmenu“.

**Hlavná obrazovka – pôdorys**
```
┌ Zmena B · Novák ─── Obsadenosť 71 % · EXT 60 % / INT 40 % ── [História] [⚙] ┐
│ ┌──────┐ ┌────┐ ┌────┐ ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌───┐                           │
│ │C60   │ │C42/4│ │C42/1│ │..││..││..││..││..││..││CHI│   modrá = EXT           │
│ └──────┘ └────┘ └────┘ └──┘└──┘└──┘└──┘└──┘└──┘└───┘   červená = INT           │
│  ...                                                   sivá = voľný           │
│                                                        šrafovaná = mimo prev. │
│                                       [ Uzavrieť zmenu a vytvoriť report ]    │
└──────────────────────────────────────────────────────────────────────────────┘
```
- Stroje vykreslené na mriežke podľa pozícií z Excelu, celý pôdorys sa prispôsobí šírke obrazovky (zoom gestom voliteľný).
- Na dlaždici: názov stroja a iniciály/mená priradených ľudí.

**Ťuknutie na stroj → panel stroja**
```
HERMLE C42 / 1
[ EXT (modrá) ] [ INT (červená) ] [ Voľný ]
Ľudia:
  Moja zmena B:   ☑ Kováč  ☐ Horváth  ☐ Baláž ...
  Iné zmeny (nadčas) ▸  (rozbaliteľné, zoskupené podľa zmeny)
```
- Zmeny sa ukladajú okamžite (žiadne „Uložiť“).

**Uzavrieť zmenu**
- Súhrn (čísla + upozornenia, napr. „2 stroje majú ľudí bez farby“) → „Uzavrieť a zdieľať“.
- Vytvorí `ShiftRecord`, vygeneruje XLSX, otvorí „Zdieľať“.
- Draft zmeny sa potom **vynuluje** (ďalší deň začína s prázdnym pôdorysom). *(Moje rozhodnutie; alternatíva „začať od stavu minulej zmeny“ – pozri otvorené body.)*

**História**
- Zoznam uzavretých zmien (dátum, zmena, majster, obsadenosť, ext/int), filter podľa zmeny a dátumu.
- Detail záznamu (pôdorys vo farbách daného dňa + tabuľka), opätovné zdieľanie reportu.
- Export viacerých záznamov do jedného XLSX (riadok na záznam) – na porovnávanie v čase.

**Nastavenia (⚙)**
- **Ľudia:** zoznam, pridať/upraviť/deaktivovať, zmena zmeny; **import** z Excelu/CSV (stĺpce: meno, zmena).
- **Stroje:** režim úprav pôdorysu – ťuknutím vybrať stroj, presúvať po mriežke, meniť veľkosť, premenovať, prepnúť „mimo prevádzky“, odstrániť, pridať nový.
- **Zmeny:** názvy a počet zmien.
- **Záloha:** export celej databázy do JSON súboru a obnova zo súboru; pripomienka zálohy raz týždenne. *(Moje rozhodnutie – chráni pred stratou dát v prehliadači.)*

### 7.5 Report (XLSX)

Hárok „Report“:
```
Report obsadenosti – Frézy
Dátum: 11.11.2026   Zmena: B   Majster: Novák   Uzavreté: 22:05
Strojov: 35   Obsadené: 25 (71 %)   EXT: 15 (60 %)   INT: 10 (40 %)

Stroj            | Zakázka | Ľudia                 | Nadčas
HERMLE C60       | EXT     | Kováč                 |
HERMLE C42 / 4   | INT     | Horváth, Baláž (A)    | áno
DMU 125          | –       |                       |
...
```
Stroje mimo prevádzky sú uvedené na konci s označením „mimo prevádzky“. Názov súboru: `Obsadenost_Frezy_2026-11-11_zmena-B.xlsx`.

### 7.6 Úvodné dáta

- Stroje: z hárku „frezy“ (zlúčené bunky = poloha a veľkosť). Stĺpce A→1, B→2… , riadky ako v Exceli; pôdorys sa normalizuje tak, aby začínal od prvého použitého riadku/stĺpca.
- Ľudia: dodá používateľ; do vtedy prázdny zoznam (import v nastaveniach).
- Zmeny: A, B, C.

| Stroj | Bunky | Stroj | Bunky |
|---|---|---|---|
| HERMLE C60 | G5:I7 | DMC 1150 / 2 | AE9:AE10 |
| HERMLE C42 / 4 | K5:M6 | DMF 220 LINEAR | AC11:AC13 |
| HERMLE C42 / 1 | O5:Q6 | DMC 80 U | G12:I13 |
| DMU 80P HI-DYN | S5:S6 | HERMLE C32 / 1 | K12:K13 |
| DMU 80P DUO BLOCK / 1 | U5:U6 | HERMLE C32 / 2 | M12:M13 |
| DMU 60P DUO BLOCK | W5:W6 | HERMLE C32 / 3 | O12:O13 |
| HERMLE C40 U / 1 | Y5:Y6 | HERMLE C32 / 4 | Q12:Q13 |
| HERMLE C40 U / 2 | AA5:AA6 | HERMLE C32 / 5 | U12:U13 |
| DMC 1035 | AC5:AC6 | HERMLE C32 / 6 | W12:W13 |
| CHIRON 800 | AE5:AF6 | HERMLE C42 / 5 | Y12:Y13 |
| HERMLE C42 / 2 | K8:M9 | HERMLE C42 / 6 | AA12:AA13 |
| HERMLE C42 / 3 | O8:Q9 | DMC 1150 / 1 | AE12:AE13 |
| DMU 60P HIDYN | S8:S9 | SHW | A16:E22 |
| DMU 80P DUO BLOCK / 2 | U8:U9 | UNIPORT 4000 | AC16:AE18 |
| DMU 80P DUO BLOCK / 3 | W8:W9 | ZAYER | G17:K22 |
| HERMLE 1200 V | Y8:Z9 | DMF 360 | O17:P22 |
| DMC 65H | AC8:AC9 | EDEL | AC20:AE22 |
| DMU 125 | G9:I10 | | |

(Spolu 35 strojov. Názvy očistené od nadbytočných medzier.)

### 7.7 Hraničné prípady (moje rozhodnutia)

- **Dátum záznamu** = dátum začiatku zmeny (`startedAt`), aj keď nočná zmena končí po polnoci.
- **Neuzavretý draft** zostáva uložený; pri ďalšom otvorení zmeny sa ukáže „Rozpracované od 10.11. 22:00 – pokračovať / začať nanovo“.
- **Nadčas** = človek, ktorého domovská zmena ≠ zmena majstra; určuje sa automaticky.
- **Deaktivovaný/odstránený človek** zmizne z výberu a z rozpracovaných draftov; v histórii ostáva.
- **Odstránený stroj** zmizne z draftov; v histórii ostáva. Odstránenie vyžaduje potvrdenie; odporúča sa radšej „mimo prevádzky“.
- Ľudí, stroje a zmeny môže v nastaveniach upravovať ktorýkoľvek majster (bez hesla) – zdieľaný tablet, dôvera v rámci tímu.

## 8. Ponechané na staviteľa

- Konkrétna XLSX knižnica, štruktúra komponentov, štýlovanie (veľké dotykové plochy, min. 44 px).
- Presný vzhľad dlaždíc a panelu stroja v medziach náčrtov vyššie.
- Spôsob úprav pôdorysu (ťahanie vs. šípky/tlačidlá), pokiaľ je spoľahlivo ovládateľný prstom.

## 9. Otvorené body (nie blokujúce)

- Má nová zmena začínať prázdna, alebo od stavu minulej uzavretej zmeny (stroje často bežia na rovnakej zakázke viac dní)? Predvolené: prázdna + tlačidlo „Prevziať stav z poslednej zmeny“.
- Zoznam ľudí dodá používateľ.
