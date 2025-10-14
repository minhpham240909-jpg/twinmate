'use client'

import { useState } from 'react'

interface TimerPreset {
  name: string
  studyDuration: number // minutes
  breakDuration: number // minutes
  description: string
}

const TIMER_PRESETS: TimerPreset[] = [
  {
    name: 'Pomodoro',
    studyDuration: 25,
    breakDuration: 5,
    description: 'Classic 25/5 Pomodoro technique',
  },
  {
    name: 'Extended Focus',
    studyDuration: 50,
    breakDuration: 10,
    description: 'Longer study sessions for deep work',
  },
  {
    name: 'Study Block',
    studyDuration: 45,
    breakDuration: 15,
    description: 'Balanced study with longer breaks',
  },
  {
    name: 'Quick Sprint',
    studyDuration: 15,
    breakDuration: 3,
    description: 'Short focused bursts',
  },
]

interface TimerSettingsProps {
  onSave: (studyDuration: number, breakDuration: number) => void
  onCancel: () => void
  initialStudyDuration?: number
  initialBreakDuration?: number
}

export default function TimerSettings({
  onSave,
  onCancel,
  initialStudyDuration,
  initialBreakDuration,
}: TimerSettingsProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [customStudy, setCustomStudy] = useState(initialStudyDuration || 25)
  const [customBreak, setCustomBreak] = useState(initialBreakDuration || 5)

  const handlePresetSelect = (preset: TimerPreset) => {
    setSelectedPreset(preset.name)
    setCustomStudy(preset.studyDuration)
    setCustomBreak(preset.breakDuration)
  }

  const handleCustomChange = () => {
    setSelectedPreset(null)
  }

  const handleSave = () => {
    if (customStudy < 1 || customStudy > 240) {
      alert('Study duration must be between 1 and 240 minutes')
      return
    }
    if (customBreak < 1 || customBreak > 60) {
      alert('Break duration must be between 1 and 60 minutes')
      return
    }
    onSave(customStudy, customBreak)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Timer Settings</h2>
          <p className="text-sm text-gray-600 mt-1">
            Choose a preset or customize your study and break durations
          </p>
        </div>

        <div className="p-6">
          {/* Presets */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Preset Timers
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TIMER_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePresetSelect(preset)}
                  className={`p-4 border-2 rounded-lg text-left transition ${
                    selectedPreset === preset.name
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">
                    {preset.name}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {preset.studyDuration} min study / {preset.breakDuration}{' '}
                    min break
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Settings */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Custom Timer
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Study Duration (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="240"
                  value={customStudy}
                  onChange={(e) => {
                    setCustomStudy(parseInt(e.target.value) || 1)
                    handleCustomChange()
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <p className="text-xs text-gray-500 mt-1">1-240 minutes</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Break Duration (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={customBreak}
                  onChange={(e) => {
                    setCustomBreak(parseInt(e.target.value) || 1)
                    handleCustomChange()
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <p className="text-xs text-gray-500 mt-1">1-60 minutes</p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Preview
            </h4>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                Study: {customStudy} min
              </span>
              <span className="text-gray-400">→</span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                Break: {customBreak} min
              </span>
              <span className="text-gray-400">→ Repeat</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
