export function RateLimitsSection() {
  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Rate Limits</h3>
        <button className="text-xs text-slate-400 hover:text-white transition-colors">
          Usage Period
        </button>
      </div>
      
      <div className="space-y-5">
        {/* OpenAI */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-500/15">
              <div className="w-4 h-4 rounded-full bg-cyan-400" />
            </div>
            <span className="text-sm font-medium text-white">OpenAI</span>
          </div>
          <div className="space-y-2 pl-11">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">5 hour usage limit</span>
                <span className="font-mono text-slate-300">0.3k / 50000k</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full" style={{ width: '100%' }} />
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-emerald-400 font-medium">100% remaining</span>
                <span className="text-slate-500">Reset Today 02:48 AM</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Weekly usage limit</span>
                <span className="font-mono text-slate-300">0.00 / 8800000</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400 rounded-full" style={{ width: '100%' }} />
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-emerald-400 font-medium">100% remaining</span>
                <span className="text-slate-500">Reset Wed, Jan 31 2000 AM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Anthropic */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-500/15">
              <div className="w-4 h-4 rounded-full bg-violet-400" />
            </div>
            <span className="text-sm font-medium text-white">Anthropic</span>
          </div>
          <div className="space-y-2 pl-11">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">5 hour usage limit</span>
                <span className="font-mono text-slate-300">0.03 / 80000k</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-violet-400 rounded-full" style={{ width: '95%' }} />
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-emerald-400 font-medium">95% remaining</span>
                <span className="text-slate-500">Reset Wed, Jan 31 2000 AM</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Weekly usage limit</span>
                <span className="font-mono text-slate-300">XEGsm / 28000k</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-violet-400 rounded-full" style={{ width: '95%' }} />
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-emerald-400 font-medium">95% remaining</span>
                <span className="text-slate-500">XEGsm / 20000 AM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Google */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/15">
              <div className="w-4 h-4 rounded-full bg-blue-400" />
            </div>
            <span className="text-sm font-medium text-white">Google</span>
          </div>
          <div className="space-y-2 pl-11">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">5 hour usage limit</span>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-medium text-xs">♾️ Unlimited</span>
                </div>
              </div>
              <p className="text-xs text-slate-500">No limit</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
