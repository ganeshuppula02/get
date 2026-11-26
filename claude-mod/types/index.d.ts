/** What `undoable status --json` returns (Undoable 0.18+). */
export type PanelAction = {
  id: string
  at: string
  what: string
  state: 'backed up' | 'ran' | 'asked you' | 'stopped' | 'undone' | 'expired'
  reason: string
  why?: string
  helper?: string
  canUndo: boolean
}

export type PanelStatus = {
  project: string
  actions: PanelAction[]
  pending: { id: string; what: string; reason: string; why?: string }[]
  lastSession?: { id: string; actions: number }
  week: { checked: number; backedUp: number; waiting: number; stopped: number; undone: number; promptsSaved: number }
}

/** The panel's view: Undoable's status, or why it can't be read; the last button result. */
export type View = {
  status: PanelStatus | null
  problem: string | null
  message: string | null
  isConfirmingSession: boolean
}

declare module 'claude-code' {
  interface PluginState {
    undoable: { view: Shaped<View> }
  }
}
