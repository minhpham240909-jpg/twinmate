'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import PartnerAvatar from '@/components/PartnerAvatar'

interface OnlinePartner {
  id: string
  name: string
  avatarUrl: string | null
  onlineStatus: string
  activityType?: string
  activityDetails?: Record<string, unknown> | null
}

interface DashboardPartnersSectionProps {
  partnersCount: number
  onlinePartners: OnlinePartner[]
  loadingOnlinePartners: boolean
}

export default function DashboardPartnersSection({
  partnersCount,
  onlinePartners,
  loadingOnlinePartners,
}: DashboardPartnersSectionProps) {
  const router = useRouter()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')

  const getActivityDisplay = (activityType?: string) => {
    switch (activityType) {
      case 'studying':
        return { icon: '📚', text: 'Studying', color: 'text-blue-500' }
      case 'in_call':
        return { icon: '📞', text: 'In Call', color: 'text-green-500' }
      case 'with_ai':
        return { icon: '🤖', text: 'With AI', color: 'text-purple-500' }
      case 'idle':
        return { icon: '💤', text: 'Away', color: 'text-yellow-500' }
      default:
        return { icon: '🟢', text: 'Online', color: 'text-emerald-500' }
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
      {/* Study Partners Card - Takes 2 columns */}
      <div className="lg:col-span-2">
        <button
          onClick={() => router.push('/dashboard/partners')}
          className="w-full h-full p-5 sm:p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-neutral-900 dark:text-white shadow-sm hover:shadow-lg hover:scale-[1.01] transition-all duration-300 group cursor-pointer text-left"
        >
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-100 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold mb-2">{t('studyPartners')}</h2>
              <p className="text-4xl sm:text-5xl font-black mb-3">{partnersCount}</p>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm sm:text-base leading-relaxed mb-4 sm:mb-6">Connect with study partners and collaborate on your learning journey</p>
            </div>
            <div className="flex items-center gap-2 text-blue-500 dark:text-blue-400">
              <span className="text-sm font-medium">View all partners</span>
              <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </button>
      </div>

      {/* Online Partners Card - Takes 1 column */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm p-4 sm:p-6 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-neutral-900 dark:text-white text-base sm:text-lg">{t('onlinePartners')}</h3>
              {!loadingOnlinePartners && onlinePartners.length > 0 && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{onlinePartners.length} online</p>
              )}
            </div>
            {!loadingOnlinePartners && onlinePartners.length > 0 && (
              <span className="px-2.5 py-1 bg-gradient-to-r from-blue-100 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-full">
                {onlinePartners.length}
              </span>
            )}
          </div>

          {/* Loading State */}
          {loadingOnlinePartners ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 sm:py-12">
              <div className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">{tCommon('loading')}</p>
            </div>
          ) : onlinePartners.length === 0 ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center py-8 sm:py-12">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-neutral-500 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-neutral-600 dark:text-neutral-400 font-medium text-xs sm:text-sm">{t('noPartnerOnline')}</p>
            </div>
          ) : (
            /* Online Partners List with Activity Status */
            <div className="flex-1 space-y-2 overflow-y-auto max-h-72 sm:max-h-[400px]">
              {onlinePartners.map((partner) => {
                const activity = getActivityDisplay(partner.activityType)

                return (
                  <button
                    key={partner.id}
                    onClick={() => router.push(`/profile/${partner.id}`)}
                    className="w-full flex items-center gap-3 p-2.5 sm:p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all duration-200 text-left group"
                  >
                    <PartnerAvatar
                      avatarUrl={partner.avatarUrl}
                      name={partner.name}
                      size="md"
                      onlineStatus={partner.onlineStatus as 'ONLINE' | 'OFFLINE'}
                      showStatus={true}
                      className="ring-2 ring-neutral-200 dark:ring-neutral-700 group-hover:ring-neutral-400 dark:group-hover:ring-neutral-500 transition-all"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neutral-900 dark:text-white truncate group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors text-xs sm:text-sm">{partner.name}</p>
                      <p className={`text-xs ${activity.color} flex items-center gap-1`}>
                        <span>{activity.icon}</span>
                        <span>{activity.text}</span>
                      </p>
                    </div>
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400 dark:text-neutral-500 group-hover:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
