'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { BookOpen, Phone, Bot, Moon, Circle, Flame, Users, ChevronRight } from 'lucide-react'
import PartnerAvatar from '@/components/PartnerAvatar'

interface OnlinePartner {
  id: string
  name: string
  avatarUrl: string | null
  onlineStatus: string
  activityType?: string
  activityDetails?: Record<string, unknown> | null
  streak?: number
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

  const studyingPartners = onlinePartners.filter(p =>
    p.activityType === 'studying' || p.activityType === 'in_call' || p.activityType === 'with_ai'
  )

  const getActivityDisplay = (activityType?: string, activityDetails?: Record<string, unknown> | null) => {
    const subject = activityDetails?.subject as string | undefined

    switch (activityType) {
      case 'studying':
        return {
          icon: <BookOpen className="w-3 h-3" />,
          text: subject ? `Studying ${subject}` : 'Studying',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/30',
          pulse: true
        }
      case 'in_call':
        return {
          icon: <Phone className="w-3 h-3" />,
          text: 'In call',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/30',
          pulse: true
        }
      case 'with_ai':
        return {
          icon: <Bot className="w-3 h-3" />,
          text: 'AI Partner',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/30',
          pulse: true
        }
      case 'idle':
        return {
          icon: <Moon className="w-3 h-3" />,
          text: 'Away',
          color: 'text-neutral-500',
          bgColor: 'bg-neutral-100 dark:bg-neutral-800',
          pulse: false
        }
      default:
        return {
          icon: <Circle className="w-2.5 h-2.5 fill-current" />,
          text: 'Online',
          color: 'text-neutral-600 dark:text-neutral-400',
          bgColor: 'bg-neutral-100 dark:bg-neutral-800',
          pulse: false
        }
    }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Study Partners Card */}
      <div className="lg:col-span-2">
        <button
          onClick={() => router.push('/dashboard/partners')}
          className="w-full h-full p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-left hover:border-neutral-300 dark:hover:border-neutral-700 transition-all group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-1">{t('studyPartners')}</h2>
          <p className="text-4xl font-black text-neutral-900 dark:text-white mb-2">{partnersCount}</p>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Connect with study partners</p>
        </button>
      </div>

      {/* Online Partners Card */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Circle className="w-4 h-4 text-white fill-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-neutral-900 dark:text-white">{t('onlinePartners')}</h3>
              {!loadingOnlinePartners && onlinePartners.length > 0 && (
                <p className="text-xs text-neutral-500">
                  {studyingPartners.length > 0 ? (
                    <span className="text-blue-600 dark:text-blue-400 font-medium">{studyingPartners.length} studying</span>
                  ) : (
                    `${onlinePartners.length} online`
                  )}
                </p>
              )}
            </div>
            {!loadingOnlinePartners && onlinePartners.length > 0 && (
              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-600 text-white">
                {onlinePartners.length}
              </span>
            )}
          </div>

          {/* Studying now banner */}
          {!loadingOnlinePartners && studyingPartners.length > 0 && (
            <div className="mb-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                </span>
                {studyingPartners.length === 1
                  ? `${studyingPartners[0].name} is studying`
                  : `${studyingPartners.length} partners studying`
                }
              </p>
            </div>
          )}

          {/* Loading State */}
          {loadingOnlinePartners ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-neutral-900 dark:border-white border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-xs text-neutral-500">{tCommon('loading')}</p>
            </div>
          ) : onlinePartners.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-neutral-400" />
              </div>
              <p className="text-neutral-500 text-sm">{t('noPartnerOnline')}</p>
            </div>
          ) : (
            <div className="flex-1 space-y-1 overflow-y-auto max-h-64">
              {onlinePartners.map((partner) => {
                const activity = getActivityDisplay(partner.activityType, partner.activityDetails)

                return (
                  <button
                    key={partner.id}
                    onClick={() => router.push(`/profile/${partner.id}`)}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-colors text-left group"
                  >
                    <PartnerAvatar
                      avatarUrl={partner.avatarUrl}
                      name={partner.name}
                      size="md"
                      onlineStatus={partner.onlineStatus as 'ONLINE' | 'OFFLINE'}
                      showStatus={true}
                      className="ring-2 ring-neutral-200 dark:ring-neutral-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-neutral-900 dark:text-white truncate text-sm">{partner.name}</p>
                        {partner.streak && partner.streak >= 3 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-full">
                            <Flame className="w-3 h-3 text-neutral-600 dark:text-neutral-400" />
                            <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400">{partner.streak}</span>
                          </span>
                        )}
                      </div>
                      <div className={`inline-flex items-center gap-1 text-xs ${activity.color} ${activity.bgColor} px-1.5 py-0.5 rounded-full mt-0.5`}>
                        {activity.pulse && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current"></span>
                          </span>
                        )}
                        {activity.icon}
                        <span className="font-medium">{activity.text}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-400 transition-colors flex-shrink-0" />
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
