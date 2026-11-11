import { useLiveQuery } from 'dexie-react-hooks';
import { useDB } from '../useDB';
import { loadTheme, saveTheme, THEMES } from '../theme';

export function AppearanceSettings() {
  const db = useDB();
  const current = useLiveQuery(() => loadTheme(db), [db]);
  return (
    <div className="card stack">
      <h3>Vzhľad</h3>
      <div className="row" role="group" aria-label="Vzhľad aplikácie">
        {THEMES.map((t) => (
          <button
            key={t.value}
            className={`btn ${current === t.value ? 'btn--primary' : ''}`}
            aria-pressed={current === t.value}
            onClick={() => saveTheme(db, t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="muted">„Podľa zariadenia“ sa prepína podľa nastavenia tabletu (napr. v noci tmavý).</p>
    </div>
  );
}
