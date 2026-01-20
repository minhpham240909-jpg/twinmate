'use client'

import { useState, useEffect } from 'react'
import { 
  Zap, 
  BellOff, 
  Flame, 
  Trophy, 
  Sparkles, 
  Crown,
  BarChart3,
  Calendar
} from 'lucide-react'

interface GamificationSettings {
  proModeEnabled: boolean
  silentModeEnabled: boolean
  showStreakBadges: boolean
  showLeaderboards: boolean
  showXPAnimations: boolean
  showAchievementPopups: boolean
  showStudyCaptainBadge: boolean
  weeklyReflectionEnabled: boolean
  weeklyReflectionDay: string
  weeklyReflectionTime: string
}

interface ProModeSettingsProps {
  settings: Partial<GamificationSettings>
  onUpdate: (updates: Partial<GamificationSettings>) => Promise<void>
  loading?: boolean
}

/**
 * ProModeSettings - Settings for Pro/Silent mode and gamification controls
 * Layer-based gamification - users can customize their experience
 */
export function ProModeSettings({ settings, onUpdate, loading }: ProModeSettingsProps) {
  const [localSettings, setLocalSettings] = useState<Partial<GamificationSettings>>(settings)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  const handleToggle = async (key: keyof GamificationSettings, value: boolean) => {
    const newSettings = { ...localSettings, [key]: value }
    setLocalSettings(newSettings)

    // If enabling Pro Mode, disable all gamification
    if (key === 'proModeEnabled' && value) {
      const proModeSettings = {
        proModeEnabled: true,
        showStreakBadges: false,
        showLeaderboards: false,
        showXPAnimations: false,
        showAchievementPopups: false,
        showStudyCaptainBadge: false,
      }
      setLocalSettings(prev => ({ ...prev, ...proModeSettings }))
      setSaving(true)
      await onUpdate(proModeSettings)
      setSaving(false)
      return
    }

    // If disabling Pro Mode, re-enable all gamification
    if (key === 'proModeEnabled' && !value) {
      const normalSettings = {
        proModeEnabled: false,
        showStreakBadges: true,
        showLeaderboards: true,
        showXPAnimations: true,
        showAchievementPopups: true,
        showStudyCaptainBadge: true,
      }
      setLocalSettings(prev => ({ ...prev, ...normalSettings }))
      setSaving(true)
      await onUpdate(normalSettings)
      setSaving(false)
      return
    }

    // If enabling Silent Mode, disable notifications
    if (key === 'silentModeEnabled' && value) {
      const silentSettings = {
        silentModeEnabled: true,
        showXPAnimations: false,
        showAchievementPopups: false,
      }
      setLocalSettings(prev => ({ ...prev, ...silentSettings }))
      setSaving(true)
      await onUpdate(silentSettings)
      setSaving(false)
      return
    }

    setSaving(true)
    await onUpdate({ [key]: value })
    setSaving(false)
  }

  const handleReflectionChange = async (key: 'weeklyReflectionDay' | 'weeklyReflectionTime', value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }))
    setSaving(true)
    await onUpdate({ [key]: value })
    setSaving(false)
  }

  const isProMode = localSettings.proModeEnabled

  return (
    <div className="space-y-6">
      {/* Pro Mode Toggle */}
      <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 dark:from-neutral-800 dark:to-neutral-700 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Pro Mode</h3>
              <p className="text-sm text-white/70">Minimal UI • No gamification • Pure focus</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={localSettings.proModeEnabled || false}
              onChange={(e) => handleToggle('proModeEnabled', e.target.checked)}
              disabled={loading || saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/20 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-white/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
          </label>
        </div>
        {isProMode && (
          <p className="mt-3 text-sm text-white/60 bg-white/10 rounded-lg p-3">
            Pro Mode hides all streaks, badges, leaderboards, and XP. Just you and your studies.
          </p>
        )}
      </div>

      {/* Silent Mode Toggle */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
              <BellOff className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 dark:text-white">Silent Mode</h3>
              <p className="text-sm text-neutral-500">No celebration popups or animations</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={localSettings.silentModeEnabled || false}
              onChange={(e) => handleToggle('silentModeEnabled', e.target.checked)}
              disabled={loading || saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Gamification Layer Controls */}
      {!isProMode && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
            <h3 className="font-bold text-neutral-900 dark:text-white">Gamification Controls</h3>
            <p className="text-sm text-neutral-500">Customize which elements you see</p>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {/* Streak Badges */}
            <SettingToggle
              icon={<Flame className="w-5 h-5 text-orange-500" />}
              label="Streak Badges"
              description="Show fire badges for study streaks"
              checked={localSettings.showStreakBadges ?? true}
              onChange={(v) => handleToggle('showStreakBadges', v)}
              disabled={loading || saving}
            />

            {/* Leaderboards */}
            <SettingToggle
              icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
              label="Leaderboards"
              description="Show course and circle leaderboards"
              checked={localSettings.showLeaderboards ?? true}
              onChange={(v) => handleToggle('showLeaderboards', v)}
              disabled={loading || saving}
            />

            {/* XP Animations */}
            <SettingToggle
              icon={<Sparkles className="w-5 h-5 text-purple-500" />}
              label="XP Animations"
              description="Show XP gain animations"
              checked={localSettings.showXPAnimations ?? true}
              onChange={(v) => handleToggle('showXPAnimations', v)}
              disabled={loading || saving}
            />

            {/* Achievement Popups */}
            <SettingToggle
              icon={<Trophy className="w-5 h-5 text-yellow-500" />}
              label="Achievement Popups"
              description="Show popups when you unlock achievements"
              checked={localSettings.showAchievementPopups ?? true}
              onChange={(v) => handleToggle('showAchievementPopups', v)}
              disabled={loading || saving}
            />

            {/* Study Captain Badge */}
            <SettingToggle
              icon={<Crown className="w-5 h-5 text-amber-500" />}
              label="Study Captain Badge"
              description="Show captain crown on your profile"
              checked={localSettings.showStudyCaptainBadge ?? true}
              onChange={(v) => handleToggle('showStudyCaptainBadge', v)}
              disabled={loading || saving}
            />
          </div>
        </div>
      )}

      {/* Weekly Reflection Settings */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="font-bold text-neutral-900 dark:text-white">Weekly Reflection</h3>
          <p className="text-sm text-neutral-500">End-of-week reflection prompts</p>
        </div>

        <div className="p-4 space-y-4">
          <SettingToggle
            icon={<Calendar className="w-5 h-5 text-green-500" />}
            label="Weekly Reflection"
            description="Get a reflection prompt at the end of each week"
            checked={localSettings.weeklyReflectionEnabled ?? true}
            onChange={(v) => handleToggle('weeklyReflectionEnabled', v)}
            disabled={loading || saving}
          />

          {localSettings.weeklyReflectionEnabled && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Day
                </label>
                <select
                  value={localSettings.weeklyReflectionDay || 'Sunday'}
                  onChange={(e) => handleReflectionChange('weeklyReflectionDay', e.target.value)}
                  disabled={loading || saving}
                  className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg"
                >
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Time
                </label>
                <select
                  value={localSettings.weeklyReflectionTime || '18:00'}
                  onChange={(e) => handleReflectionChange('weeklyReflectionTime', e.target.value)}
                  disabled={loading || saving}
                  className="w-full px-3 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg"
                >
                  {['09:00', '12:00', '15:00', '18:00', '20:00'].map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {saving && (
        <div className="text-center text-sm text-neutral-500">
          Saving...
        </div>
      )}
    </div>
  )
}

/**
 * SettingToggle - Reusable toggle component for settings
 */
function SettingToggle({
  icon,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h4 className="font-medium text-neutral-900 dark:text-white">{label}</h4>
          <p className="text-sm text-neutral-500">{description}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50"></div>
      </label>
    </div>
  )
}

export default ProModeSettings
