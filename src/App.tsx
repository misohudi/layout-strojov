import { useState } from 'react';
import { ShiftPicker } from './ui/ShiftPicker';
import { LayoutView } from './ui/LayoutView';
import './ui/styles.css';

type Screen = 'picker' | 'layout' | 'history' | 'settings' | 'close';

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

  return (
    <LayoutView
      shiftId={shiftId}
      onChangeShift={() => setScreen('picker')}
      onHistory={() => setScreen('history')}
      onSettings={() => setScreen('settings')}
      onCloseShift={() => setScreen('close')}
    />
  );
}
