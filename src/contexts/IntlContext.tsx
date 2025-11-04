'use client'

import { createContext, useContext, ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { useSettings } from './SettingsContext'
import enMessages from '../../messages/en.json'
import esMessages from '../../messages/es.json'

const messages = {
  en: enMessages,
  es: esMessages,
}

export function IntlProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()

  // Get language from settings, default to 'en'
  const locale = settings.language || 'en'

  // Ensure locale is valid (en or es)
  const validLocale = locale === 'es' ? 'es' : 'en'

  return (
    <NextIntlClientProvider
      locale={validLocale}
      messages={messages[validLocale]}
      timeZone={settings.timezone || 'UTC'}
    >
      {children}
    </NextIntlClientProvider>
  )
}
