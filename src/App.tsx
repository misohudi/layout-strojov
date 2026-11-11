import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShiftPicker } from './ui/ShiftPicker';
import { LayoutView } from './ui/LayoutView';
import { CloseShiftDialog } from './ui/CloseShiftDialog';
import { HistoryView } from './ui/HistoryView';
import { SettingsView } from './ui/settings/SettingsView';
import { useDB } from './ui/useDB';
import { getMeta } from './db/db';
import { isBackupDue } from './backup/backup';
import './ui/styles.css';

type Screen = 'picker' | 'layout' | 'close' | 'history' | 'settings' | 'backup';

export default function App() {
  const db = useDB();
  const [screen, setScreen] = useState<Screen>('picker');
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [settingsFromStart, setSettingsFromStart] = useState(false);
  const backupDue = useLiveQuery(async () => {
    if ((await db.records.count()) === 0) return false;
    return isBackupDue(await getMeta<string>(db, 'lastBackupAt'), new Date());
  }, [db]);

  if (settingsFromStart) {
    return <SettingsView initialTab="shifts" onBack={() => setSettingsFromStart(false)} />;
  }

  if (screen === 'picker' || !shiftId) {
    return (
      <ShiftPicker
        onPicked={(id) => {
          setShiftId(id);
          setScreen('layout');
        }}
        onSettings={() => setSettingsFromStart(true)}
      />
    );
  }

  if (screen === 'history') return <HistoryView onBack={() => setScreen('layout')} />;
  if (screen === 'settings' || screen === 'backup') {
    return <SettingsView initialTab={screen === 'backup' ? 'backup' : 'people'} onBack={() => setScreen('layout')} />;
  }

  return (
    <>
      <LayoutView
        shiftId={shiftId}
        onChangeShift={() => setScreen('picker')}
        onHistory={() => setScreen('history')}
        onSettings={() => setScreen('settings')}
        onCloseShift={() => setScreen('close')}
        banner={
          backupDue && (
            <div className="notice notice--warn">
              Odporúčame uložiť zálohu dát (posledná je staršia ako 7 dní).
              <button className="btn btn--small" onClick={() => setScreen('backup')}>Uložiť zálohu teraz</button>
            </div>
          )
        }
      />
      {screen === 'close' && (
        <CloseShiftDialog
          shiftId={shiftId}
          onCancel={() => setScreen('layout')}
          onClosed={() => {
            setShiftId(null);
            setScreen('picker');
          }}
        />
      )}
    </>
  );
}
