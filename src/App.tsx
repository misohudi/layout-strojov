import { useState } from 'react';
import { ShiftPicker } from './ui/ShiftPicker';
import { LayoutView } from './ui/LayoutView';
import { CloseShiftDialog } from './ui/CloseShiftDialog';
import { HistoryView } from './ui/HistoryView';
import './ui/styles.css';

type Screen = 'picker' | 'layout' | 'close' | 'history' | 'settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('picker');
  const [shiftId, setShiftId] = useState<string | null>(null);

  if (screen === 'picker' || !shiftId) {
    return (
      <ShiftPicker
        onPicked={(id) => {
          setShiftId(id);
          setScreen('layout');
        }}
      />
    );
  }

  if (screen === 'history') return <HistoryView onBack={() => setScreen('layout')} />;

  return (
    <>
      <LayoutView
        shiftId={shiftId}
        onChangeShift={() => setScreen('picker')}
        onHistory={() => setScreen('history')}
        onSettings={() => setScreen('settings')}
        onCloseShift={() => setScreen('close')}
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
