import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { ObjectTree } from './components/ObjectTree';
import { Viewport } from './components/Viewport';
import { PropertiesPanel } from './components/PropertiesPanel';
import { SequenceEditor } from './components/SequenceEditor';
import { StatusBar } from './components/StatusBar';
import { useSimStore } from './store/useSimStore';

export default function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const s = useSimStore.getState();
      if (e.code === 'Space') {
        e.preventDefault();
        s.playing ? s.pause() : s.play();
      } else if (e.key === 'ArrowRight' && !s.playing) s.stepOnce();
      else if (e.key.toLowerCase() === 'r' && e.shiftKey) s.reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="h-full flex flex-col bg-ps-bg text-ps-text font-ui">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <ObjectTree />
        <Viewport />
        <PropertiesPanel />
      </div>
      <SequenceEditor />
      <StatusBar />
    </div>
  );
}
