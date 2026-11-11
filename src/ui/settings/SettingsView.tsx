import { useState } from 'react';
import { PeopleSettings } from './PeopleSettings';
import { MachineEditor } from './MachineEditor';
import { ShiftSettings } from './ShiftSettings';
import { BackupSettings } from './BackupSettings';
import { AppearanceSettings } from './AppearanceSettings';

const TABS = [
  { id: 'people', label: 'Ľudia' },
  { id: 'machines', label: 'Stroje' },
  { id: 'shifts', label: 'Zmeny' },
  { id: 'backup', label: 'Záloha' },
  { id: 'appearance', label: 'Vzhľad' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function SettingsView({ onBack, initialTab = 'people' }: { onBack(): void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <div className="page">
      <div className="page__head">
        <button className="btn" onClick={onBack}>← Späť</button>
        <h2>Nastavenia</h2>
        <span />
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`chip ${tab === t.id ? 'chip--on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'people' && <PeopleSettings />}
      {tab === 'machines' && <MachineEditor />}
      {tab === 'shifts' && <ShiftSettings />}
      {tab === 'backup' && <BackupSettings />}
      {tab === 'appearance' && <AppearanceSettings />}
    </div>
  );
}
