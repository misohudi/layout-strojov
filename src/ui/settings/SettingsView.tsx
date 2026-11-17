import { useState } from 'react';
import { PeopleSettings } from './PeopleSettings';
import { MachineEditor } from './MachineEditor';
import { ShiftSettings } from './ShiftSettings';
import { BackupSettings } from './BackupSettings';
import { AppearanceSettings } from './AppearanceSettings';
import { ReportSettings } from './ReportSettings';
import { BackIcon } from '../icons';

const TABS = [
  { id: 'people', label: 'Ľudia' },
  { id: 'machines', label: 'Stroje' },
  { id: 'shifts', label: 'Zmeny' },
  { id: 'report', label: 'Report' },
  { id: 'backup', label: 'Záloha' },
  { id: 'appearance', label: 'Vzhľad' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function SettingsView({ onBack, initialTab = 'people' }: { onBack(): void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <div className="page">
      <h2 className="visually-hidden">Nastavenia</h2>
      {/* round back button in one row with the tabs */}
      <div className="tabs settings__bar">
        <button type="button" className="chip chip--round" aria-label="Späť" title="Späť" onClick={onBack}>
          <BackIcon />
        </button>
        <div className="tabs" role="tablist" aria-label="Nastavenia">
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
      </div>
      {tab === 'people' && <PeopleSettings />}
      {tab === 'machines' && <MachineEditor />}
      {tab === 'shifts' && <ShiftSettings />}
      {tab === 'report' && <ReportSettings />}
      {tab === 'backup' && <BackupSettings />}
      {tab === 'appearance' && <AppearanceSettings />}
    </div>
  );
}
