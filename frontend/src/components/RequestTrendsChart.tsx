export function RequestTrendsChart() {
  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Request Trends</h3>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
            Hour
          </button>
          <button className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors">
            Day
          </button>
        </div>
      </div>
      
      {/* Simple Chart Visualization */}
      <div className="relative h-64">
        <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1="0" x2="400" y2="0" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1="0" y1="50" x2="400" y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1="0" y1="100" x2="400" y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1="0" y1="150" x2="400" y2="150" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1="0" y1="200" x2="400" y2="200" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          
          {/* Trend line */}
          <path
            d="M 0 180 L 50 175 L 100 170 L 150 165 L 200 150 L 250 120 L 300 80 L 350 40 L 400 20"
            fill="none"
            stroke="#22D3EE"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Gradient fill */}
          <defs>
            <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M 0 180 L 50 175 L 100 170 L 150 165 L 200 150 L 250 120 L 300 80 L 350 40 L 400 20 L 400 200 L 0 200 Z"
            fill="url(#trendGradient)"
          />
        </svg>
        
        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-slate-500 px-2">
          <span>00:00</span>
          <span>04:00</span>
          <span>08:00</span>
          <span>12:00</span>
          <span>16:00</span>
          <span>20:00</span>
          <span>00:00</span>
        </div>
        
        {/* Y-axis labels */}
        <div className="absolute top-0 left-0 bottom-8 flex flex-col justify-between text-xs text-slate-500">
          <span>80</span>
          <span>60</span>
          <span>40</span>
          <span>20</span>
          <span>0</span>
        </div>
      </div>
    </div>
  );
}
