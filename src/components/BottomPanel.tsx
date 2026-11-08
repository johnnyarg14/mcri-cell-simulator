import { SequenceEditor } from './SequenceEditor';
import { AnimationEditor } from './AnimationEditor';
import { useSimStore } from '../store/useSimStore';

/** panoul de jos: Sequence Editor (Gantt) sau Animație (keyframes) */
export function BottomPanel() {
  const { bottomTab, setBottomTab, bottomCollapsed, setFlag, layout } = useSimStore();
  if (bottomCollapsed)
    return (
      <div className="h-7 shrink-0 flex items-center gap-2 px-2 bg-ps-panel border-t border-ps-border">
        <button className="ps-btn" onClick={() => setFlag('bottomCollapsed', false)}>
          ▴ {bottomTab === 'sequence' ? 'Sequence Editor' : 'Animație'}
        </button>
      </div>
    );
  return (
    <div className="h-[240px] shrink-0 flex flex-col bg-ps-panel border-t border-ps-border">
      <div className="flex items-center h-6 bg-ps-panel2 border-b border-ps-border">
        {layout === 'mcri' && (
          <button className={`px-3 h-full text-[11px] uppercase tracking-wider font-semibold ${bottomTab === 'sequence' ? 'text-white border-b-2 border-ps-accent' : 'text-ps-muted'}`} onClick={() => setBottomTab('sequence')}>
            Sequence Editor
          </button>
        )}
        <button className={`px-3 h-full text-[11px] uppercase tracking-wider font-semibold ${bottomTab === 'animation' || layout === 'empty' ? 'text-white border-b-2 border-ps-accent' : 'text-ps-muted'}`} onClick={() => setBottomTab('animation')}>
          Animație (cadre)
        </button>
        <button className="ml-auto ps-btn mr-1 h-5 py-0" onClick={() => setFlag('bottomCollapsed', true)}>
          ▾
        </button>
      </div>
      {bottomTab === 'sequence' && layout === 'mcri' ? <SequenceEditor /> : <AnimationEditor />}
    </div>
  );
}
