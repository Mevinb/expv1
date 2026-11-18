import type { Animal, Input, Snapshot } from '@beast/shared/protocol'

export const LOCAL_ID = 'local'
export type LocalCommand =
  | { type: 'launch'; name: string; animal: Animal; cup: boolean }
  | { type: 'input'; input: Input }
  | { type: 'pause'; paused: boolean }
  | { type: 'select'; animal: Animal }
  | { type: 'start' | 'rematch' | 'lobby' }

export type LocalUpdate =
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'error'; message: string; fatal: boolean }
