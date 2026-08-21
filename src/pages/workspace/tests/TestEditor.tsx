import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Plus, GripVertical, Settings, ShieldAlert, Trash2 } from 'lucide-react';

export default function TestEditor() {
  const { orgId } = useParams();
  const [testName, setTestName] = useState("Untitled Test");
  const [activeTab, setActiveTab] = useState<'questions' | 'settings'>('questions');

  const [questions, setQuestions] = useState([
    { id: '1', text: 'What is the capital of France?', type: 'multiple_choice', options: ['Paris', 'London', 'Berlin', 'Madrid'], correct: 0 },
  ]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { id: Math.random().toString(), text: 'New Question', type: 'multiple_choice', options: ['Option 1', 'Option 2'], correct: 0 }
    ]);
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col pb-10">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to={`/workspace/${orgId}/tests`} className="text-[#888888] hover:text-[#fff] transition p-2 hover:bg-[#111111] rounded">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <input 
            type="text" 
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            className="bg-transparent text-2xl font-bold focus:outline-none focus:border-b focus:border-[#9F7AEA] text-[#fff]"
            placeholder="Test Name"
          />
        </div>
        <button className="flex items-center gap-2 bg-[#9F7AEA] text-[#fff] px-4 py-2 rounded text-sm font-bold hover:bg-[#805ad5] transition">
          <Save className="w-4 h-4" /> Save Test
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#333333] mb-6">
        <button 
          onClick={() => setActiveTab('questions')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'questions' ? 'border-[#9F7AEA] text-[#fff]' : 'border-transparent text-[#888888] hover:text-[#ededed]'}`}
        >
          Questions
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'settings' ? 'border-[#9F7AEA] text-[#fff]' : 'border-transparent text-[#888888] hover:text-[#ededed]'}`}
        >
          Configuration & Proctoring
        </button>
      </div>

      {/* Editor Canvas */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'questions' && (
          <div className="space-y-4">
            {questions.map((q, index) => (
              <div key={q.id} className="bg-[#111111] border border-[#333333] rounded-lg p-6 group relative hover:border-[#555555] transition">
                <div className="absolute top-4 left-2 opacity-0 group-hover:opacity-100 cursor-grab text-[#666666] hover:text-[#fff]">
                  <GripVertical className="w-5 h-5" />
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 flex gap-2">
                   <button className="p-1 text-[#666666] hover:text-[#ff4444] rounded hover:bg-[#221111]">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="pl-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="bg-[#222222] text-[#888888] w-6 h-6 rounded flex items-center justify-center font-mono text-xs">{index + 1}</span>
                    <input 
                      type="text" 
                      value={q.text}
                      className="bg-transparent text-lg font-medium focus:outline-none w-full"
                      placeholder="Enter question text..."
                    />
                  </div>

                  {q.type === 'multiple_choice' && (
                    <div className="space-y-2 ml-9">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-3">
                          <input type="radio" checked={q.correct === oIdx} readOnly className="accent-[#9F7AEA]" />
                          <input 
                            type="text" 
                            defaultValue={opt} 
                            className="bg-[#1a1a1a] border border-[#333333] rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#555555] flex-1"
                          />
                        </div>
                      ))}
                      <button className="text-xs text-[#9F7AEA] hover:underline mt-2 flex items-center gap-1 font-bold">
                        <Plus className="w-3 h-3" /> Add Option
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            <button 
              onClick={addQuestion}
              className="w-full py-4 border-2 border-dashed border-[#333333] rounded-lg text-[#888888] font-bold text-sm hover:border-[#9F7AEA] hover:text-[#9F7AEA] transition flex flex-col items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add New Question
            </button>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-[#111111] border border-[#333333] rounded-lg p-6 space-y-8">
            <div>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#888888]" /> General Settings
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-[#888888] uppercase mb-2">Time Limit (Minutes)</label>
                  <input type="number" defaultValue={60} className="w-full bg-[#0a0a0a] border border-[#333333] rounded px-4 py-2 text-sm focus:outline-none focus:border-[#666666]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#888888] uppercase mb-2">Passing Score (%)</label>
                  <input type="number" defaultValue={70} className="w-full bg-[#0a0a0a] border border-[#333333] rounded px-4 py-2 text-sm focus:outline-none focus:border-[#666666]" />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[#333333]">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-[#9F7AEA]">
                <ShieldAlert className="w-5 h-5" /> AI Proctoring Settings
              </h3>
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer p-4 bg-[#111122] border border-[#222244] rounded-lg">
                  <input type="checkbox" defaultChecked className="mt-1 accent-[#9F7AEA]" />
                  <div>
                    <div className="font-bold text-[#fff]">Enable Video Proctoring</div>
                    <div className="text-xs text-[#888888] mt-1">Requires user to enable webcam. AI will track head pose, gaze direction, and multiple faces.</div>
                  </div>
                </label>
                
                <label className="flex items-start gap-3 cursor-pointer p-4 bg-[#111122] border border-[#222244] rounded-lg">
                  <input type="checkbox" defaultChecked className="mt-1 accent-[#9F7AEA]" />
                  <div>
                    <div className="font-bold text-[#fff]">Screen Tab & Focus Tracking</div>
                    <div className="text-xs text-[#888888] mt-1">Alerts if the user switches tabs, opens another window, or minimizes the browser.</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
