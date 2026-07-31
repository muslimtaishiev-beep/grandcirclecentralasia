const fs = require('fs');
let code = fs.readFileSync('src/pages/Testing.tsx', 'utf8');

const target = `            <p className="text-slate-500 max-w-sm mx-auto">
              Вы успешно сдали основной блок тестирования. Теперь вам необходимо сдать тест по английскому языку.
            </p>
          </div>

          <div className="flex flex-col gap-4 w-full">
            <button
              onClick={() => {
                setPhase("english");
                if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all"
            >
              Сдать английский сейчас
            </button>
            
            <button
              onClick={() => setPhase("final")}
              className="bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 font-bold py-4 px-6 rounded-xl text-lg transition-all"
            >
              Сдать английский позже (сохранить ID)
            </button>
          </div>
        </div>
      </div>`;

const replacement = `            <p className="text-slate-500 max-w-sm mx-auto">
              Вы успешно сдали основной блок тестирования.
              {test.english && test.english.length > 0 
                ? " Теперь вам необходимо сдать тест по английскому языку." 
                : " Тестирование завершено!"}
            </p>
          </div>

          {test.english && test.english.length > 0 ? (
            <div className="flex flex-col gap-4 w-full">
              <button
                onClick={() => {
                  setPhase("english");
                  if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all"
              >
                Сдать английский сейчас
              </button>
              
              <button
                onClick={() => setPhase("final")}
                className="bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 font-bold py-4 px-6 rounded-xl text-lg transition-all"
              >
                Сдать английский позже (сохранить ID)
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full mt-6">
              <button
                onClick={() => setPhase("final")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all"
              >
                Завершить
              </button>
            </div>
          )}
        </div>
      </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/Testing.tsx', code);
console.log("Patched Testing.tsx");
