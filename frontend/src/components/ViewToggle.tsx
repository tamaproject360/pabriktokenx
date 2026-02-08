import { LayoutGrid, List } from 'lucide-react';

export type ViewMode = 'card' | 'list';

interface ViewToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ viewMode, onChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
      <button
        onClick={() => onChange('card')}
        className={`p-2 rounded-lg transition-all duration-200 ${
          viewMode === 'card'
            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            : 'text-white/40 hover:text-white/60 hover:bg-white/5'
        }`}
        title="Card View"
      >
        <LayoutGrid className="w-4 h-4" strokeWidth={2} />
      </button>
      <button
        onClick={() => onChange('list')}
        className={`p-2 rounded-lg transition-all duration-200 ${
          viewMode === 'list'
            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            : 'text-white/40 hover:text-white/60 hover:bg-white/5'
        }`}
        title="List View"
      >
        <List className="w-4 h-4" strokeWidth={2} />
      </button>
    </div>
  );
}
