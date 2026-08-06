const fs = require('fs');
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');

// 1. Remove border, shadow, nested backgrounds for top bar
const topBarRegex = /<div className="flex items-center gap-2 bg-black\/80 backdrop-blur-md border border-red-900\/60 rounded-xl p-2 shadow-lg min-w-\[140px\] sm:min-w-\[200px\]">[\s\S]*?<\/div>\n\s*<\/div>/;
const newTopBar = `<div className="flex flex-col min-w-[140px] sm:min-w-[200px]">
          <div className="flex justify-between items-end mb-1 font-mono">
            <span className="text-[#ff3300] uppercase text-xs">HP</span>
            <span className={\`text-xl leading-none \${stats.hp <= 30 ? 'text-[#ff3300] animate-pulse' : 'text-white'}\`}>
              {stats.hp}
            </span>
          </div>
          <div className="w-full bg-zinc-900 h-1">
            <div
              className={\`h-full transition-all duration-300 \${stats.hp <= 30 ? 'bg-[#ff3300]' : 'bg-white'}\`}
              style={{ width: \`\${hpPercent}%\` }}
            ></div>
          </div>
        </div>`;
code = code.replace(topBarRegex, newTopBar);

// 2. Mode Stats Badges
const statsRegex = /\{mode === 'PLAY' \? \([\s\S]*?\) : \([\s\S]*?\}\)/;
const newStats = `{mode === 'PLAY' ? (
          <div className="flex items-center gap-6 font-mono text-sm uppercase">
            <div className="flex flex-col">
              <span className="text-gray-500">Wave</span>
              <span className="text-white text-xl leading-none">{stats.wave}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">Kills</span>
              <span className="text-[#ff3300] text-xl leading-none">{stats.kills}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-6 font-mono text-sm uppercase">
            <div className="flex flex-col">
              <span className="text-gray-500">Score</span>
              <span className="text-white text-xl leading-none">{stats.practiceScore}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500">Hits</span>
              <span className="text-white text-xl leading-none">{stats.practiceTargetsHit}</span>
            </div>
          </div>
        )}`;
code = code.replace(statsRegex, newStats);

// 3. Quick Control Action Buttons (no background, no borders)
const buttonsRegex = /className="p-2 sm:px-3 sm:py-2 rounded-xl bg-red-950\/90 hover:bg-red-900 border border-red-600\/80 text-red-300 transition shadow-lg active:scale-95 flex items-center justify-center min-w-\[44px\] min-h-\[44px\]"/g;
code = code.replace(buttonsRegex, 'className="p-2 text-gray-500 hover:text-white transition-colors"');

const buttonsRegex2 = /className="p-2 sm:px-3 sm:py-2 rounded-xl bg-zinc-800\/90 hover:bg-zinc-700 border border-zinc-600 text-gray-200 transition min-w-\[44px\] min-h-\[44px\] flex items-center justify-center"/g;
code = code.replace(buttonsRegex2, 'className="p-2 text-gray-500 hover:text-white transition-colors"');

const buttonsRegex3 = /className="p-2 rounded-xl bg-zinc-800\/90 hover:bg-zinc-700 border border-zinc-600 text-gray-200 transition"/g;
code = code.replace(buttonsRegex3, 'className="p-2 text-gray-500 hover:text-white transition-colors"');

const buttonsRegex4 = /className="p-2 rounded-xl bg-red-900\/90 hover:bg-red-800 border border-red-700 text-white transition shadow-lg"/g;
code = code.replace(buttonsRegex4, 'className="p-2 text-gray-500 hover:text-white transition-colors"');

// Simplify pause modal
const pauseModalRegex = /<div id="pause-modal"[\s\S]*?<\/div>\n\s*<\/div>\n\s*<\/div>/;
const newPauseModal = `<div id="pause-modal" className="fixed inset-0 bg-black/90 flex items-center justify-center p-6 z-50 pointer-events-auto font-mono">
          <div className="max-w-sm w-full text-center">
            <h2 className="text-4xl font-display text-white uppercase mb-8">
              PAUSED
            </h2>
            <div className="space-y-6 mb-8 text-left">
              <div>
                <label className="text-sm text-gray-500 uppercase block mb-2">
                  Sensitivity: {settings.sensitivity.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={settings.sensitivity}
                  onChange={e => onUpdateSettings({ sensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-[#ff3300]"
                />
              </div>
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-sm text-gray-300">Mobile Gyro Look</span>
                <button
                  onClick={() => onUpdateSettings({ gyroEnabled: !settings.gyroEnabled })}
                  className={\`text-sm uppercase \${settings.gyroEnabled ? 'text-[#ff3300]' : 'text-gray-600'}\`}
                >
                  {settings.gyroEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <button onClick={onTogglePause} className="w-full py-4 bg-white text-black font-display text-2xl uppercase hover:bg-gray-200 transition-colors">
                RESUME
              </button>
              <button onClick={onExitHome} className="w-full py-4 text-gray-500 font-display text-xl uppercase hover:text-white transition-colors">
                EXIT
              </button>
            </div>
          </div>
        </div>`;
code = code.replace(pauseModalRegex, newPauseModal);

// Simplify Game Over Modal
const gameoverModalRegex = /<div id="gameover-modal"[\s\S]*?<\/div>\n\s*<\/div>\n\s*<\/div>/;
const newGameoverModal = `<div id="gameover-modal" className="fixed inset-0 bg-black/95 flex items-center justify-center p-6 z-50 pointer-events-auto font-mono">
          <div className="max-w-md w-full text-center">
            <h1 className="text-6xl font-display text-[#ff3300] uppercase mb-8 leading-none">
              DEAD
            </h1>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-10 text-left border-y border-zinc-800 py-6">
              <div>
                <div className="text-xs text-gray-500 uppercase">Waves</div>
                <div className="text-2xl text-white mt-1">{stats.wave}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Kills</div>
                <div className="text-2xl text-[#ff3300] mt-1">{stats.kills}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Headshots</div>
                <div className="text-2xl text-white mt-1">{stats.headshots}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Accuracy</div>
                <div className="text-2xl text-white mt-1">
                  {stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0}%
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <button onClick={onRestartGame} className="w-full py-4 bg-[#ff3300] text-black font-display text-2xl uppercase hover:bg-white transition-colors">
                RETRY
              </button>
              <button onClick={onExitHome} className="w-full py-4 text-gray-500 font-display text-xl uppercase hover:text-white transition-colors">
                MENU
              </button>
            </div>
          </div>
        </div>`;
code = code.replace(gameoverModalRegex, newGameoverModal);

// Threat warnings redesign
const warningsRegex = /<div className="absolute top-20 left-1\/2 -translate-x-1\/2 flex flex-col items-center gap-2 pointer-events-none z-20">[\s\S]*?<\/div>\n\s*<\/div>\n\s*<\/div>/;
const newWarnings = `<div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-20 font-mono">
          {behindThreat && (
            <div className="text-[#ff3300] text-sm uppercase tracking-[0.2em] animate-pulse">
              [ BEHIND YOU ]
            </div>
          )}
          {leftThreat && !behindThreat && (
            <div className="text-white text-sm uppercase tracking-[0.2em]">
              [ LEFT THREAT ]
            </div>
          )}
          {rightThreat && !behindThreat && (
            <div className="text-white text-sm uppercase tracking-[0.2em]">
              [ RIGHT THREAT ]
            </div>
          )}
        </div>
      )}
      
      {/* Wave Bonus */}
      {waveBonusMessage && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 font-mono text-center">
          <div className="text-2xl text-white uppercase mb-2">WAVE CLEARED</div>
          <div className="text-sm text-[#ff3300] uppercase tracking-widest">{waveBonusMessage}</div>
        </div>
      )}`;
code = code.replace(/<div className="absolute top-1\/3 left-1\/2 -translate-x-1\/2 -translate-y-1\/2 bg-red-950\/90 border-2 border-red-500 text-red-100 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md flex flex-col items-center animate-bounce z-20">[\s\S]*?<\/div>\n\s*<\/div>/, '');

code = code.replace(/<div className="absolute top-20 left-1\/2 -translate-x-1\/2 flex flex-col items-center gap-2 pointer-events-none z-20">[\s\S]*?<\/div>\n\s*<\/div>/, newWarnings);

fs.writeFileSync('src/components/GameHUD.tsx', code);
console.log("HUD refactored!");
