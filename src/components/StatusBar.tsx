import { useSimStore } from '../store/useSimStore';

export function StatusBar() {
  const { fps, snapshot, statusMessage, selectedId } = useSimStore();
  const collision = snapshot.robots.find((r) => r.collision);
  return (
    <div className="h-6 shrink-0 flex items-center gap-4 px-3 bg-ps-panel2 border-t border-ps-border text-[11px] text-ps-muted">
      <span>
        FPS <span className="font-mono text-ps-text">{fps}</span>
      </span>
      <span>
        Corpuri <span className="font-mono text-ps-text">{snapshot.bodies}</span>
      </span>
      <span>
        Pași <span className="font-mono text-ps-text">{snapshot.tick}</span>
      </span>
      <span>
        Selecție <span className="text-ps-text">{selectedId ?? '–'}</span>
      </span>
      <span className={`ml-auto truncate ${collision ? 'text-red-400 font-semibold' : 'text-ps-text'}`}>{collision ? `⚠ Coliziune: Gripper ${collision.id === 'ROBOT_1' ? 'R1' : 'R2'} ↔ ${collision.collision}` : statusMessage}</span>
    </div>
  );
}
