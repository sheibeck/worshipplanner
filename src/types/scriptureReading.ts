import type { Timestamp } from 'firebase/firestore'
import type { ScriptureRef } from './service'
import type { CongregationalSection, ScriptureSlide } from './slide'

export interface ScriptureReading {
  id: string
  reference: ScriptureRef
  displayReference: string
  rawText: string
  readingMode: 'normal' | 'congregational'
  slides: ScriptureSlide[]
  congregationalSections?: CongregationalSection[]
  createdAt: Timestamp
  updatedAt: Timestamp
}
