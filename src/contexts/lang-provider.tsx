'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode, useMemo } from 'react'
import en from '@/i18n/messages/en.json'
import ar from '@/i18n/messages/ar.json'

type Lang = 'en' | 'ar'
type Messages = Record<string, any>

const messages: Record<Lang, Messages> = { en, ar }

interface LangContextType {
  lang: Lang
  t: (key: string) => string
  setLang: (l: Lang) => void
  isRtl: boolean
}

export const LangContext = createContext<LangContextType>({
  lang: 'en',
  t: (k) => k,
  setLang: () => {},
  isRtl: false,
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const saved = localStorage.getItem('Safwan-lang')
    if (saved === 'ar' || saved === 'en') setLangState(saved)
  }, [])

  useEffect(() => {
    if (lang === 'ar') {
      document.documentElement.dir = 'rtl'
      document.documentElement.lang = 'ar'
    } else {
      document.documentElement.dir = 'ltr'
      document.documentElement.lang = 'en'
    }
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem('Safwan-lang', l)
  }, [])

  const t = useCallback((key: string): string => {
    const keys = key.split('.')
    let val: any = messages[lang]
    for (const k of keys) {
      if (val == null) return key
      val = val[k]
    }
    return typeof val === 'string' ? val : key
  }, [lang])

  return (
    <LangContext.Provider value={{ lang, t, setLang, isRtl: lang === 'ar' }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
