# Layout strojov

Webová aplikácia (PWA) pre zdieľaný tablet vo výrobe. Majster zmeny na pôdoryse fréz označuje stroje
(**modrá = externá zakázka**, **červená = interná**), priraďuje k nim ľudí, vidí obsadenosť a pomer EXT/INT,
uzatvára zmenu do histórie a posiela supervisorovi report v Exceli.

Dáta sú uložené **len v tablete** (IndexedDB) – aplikácia funguje aj bez internetu.

## Inštalácia na tablet

1. Otvorte adresu aplikácie v prehliadači tabletu.
2. **Android (Chrome):** menu ⋮ → **Pridať na plochu** / **Inštalovať aplikáciu**.
   **iPad (Safari):** tlačidlo Zdieľať → **Pridať na plochu**.
3. Spúšťajte aplikáciu z ikony na ploche. Odporúčané je držať tablet na šírku.

## Používanie

- **Štart:** vyberte zmenu a zadajte meno majstra. Ak má zmena rozpracovaný stav, môžete pokračovať alebo začať nanovo.
- **Pôdorys:** ťuknite na stroj → EXT / INT / Voľný a vyberte ľudí. Ľudia z iných zmien sú v sekcii „Iné zmeny (nadčas)“.
- **Uzavrieť zmenu:** uloží záznam do histórie, vytvorí Excel report a otvorí „Zdieľať“ (e‑mail, Teams…).
  Ak zariadenie zdieľanie súborov nepodporuje, report sa stiahne.
- **História:** prehľad uzavretých zmien, filter, detail s pôdorysom, export viacerých záznamov do Excelu.
- **Nastavenia (⚙):** ľudia (aj import z Excelu/CSV so stĺpcami `Meno` a `Zmena`), úprava pôdorysu strojov,
  zmeny, záloha a obnova.

## Ukladanie reportov do sieťového priečinka

1. Pripojte sieťový disk v tablete (napr. v aplikácii Súbory na Androide) – prihlasovacie údaje zadáva
   používateľ priamo v tablete, aplikácia ich nevidí.
2. V aplikácii: **Nastavenia → Report → Vybrať priečinok** a vo výbere priečinka zvoľte priečinok pre reporty.
   Voliteľne vyplňte popis cesty pre majstrov.
3. Pri **Uzavrieť zmenu** sa report uloží rovno do tohto priečinka (prvýkrát sa tablet môže spýtať na povolenie).
   Ak priečinok nie je dostupný, zmena sa aj tak uzavrie a report sa dá uložiť znova alebo poslať cez Zdieľať.

Vyžaduje prehliadač s podporou výberu priečinka (aktuálny Chrome na Androide). Inak zostáva Zdieľať.

## Záloha

Dáta sú len v tablete – vymazanie dát prehliadača ich zmaže. V **Nastavenia → Záloha** si pravidelne ukladajte
zálohu (aplikácia pripomenie po 7 dňoch). Zálohu (`.json`) viete obnoviť na tom istom alebo inom tablete.

## Vývoj

```bash
npm install
npm run dev        # vývojový server
npx vitest run     # testy
npm run build      # produkčný build do dist/
```

Nasadenie: GitHub Actions (`.github/workflows/deploy.yml`) pri pushi do `main` spustí testy, zostaví aplikáciu
s `BASE_PATH=/<názov-repa>/` a nasadí ju na GitHub Pages (v nastaveniach repa: Pages → Source: GitHub Actions).
