import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PanelStatus, View } from '../types'

/**
 * Undoable, beside the chat. Reads `undoable status --json` after every tool call and shows what was
 * backed up, what asked you, what your rules stopped and what's waiting for your OK, with Undo,
 * Approve and Block buttons that run the same `undoable` commands you would type. It never changes
 * how Undoable decides anything.
 */

const PANE = 'undoable'
const empty: View = { status: null, problem: null, message: null, isConfirmingSession: false }
const view = atom({ plugin: 'undoable', key: 'view' } as const, empty, { shape: 'view-1' })

const INSTALL_WIN = 'irm https://raw.githubusercontent.com/ganeshuppula02/get/main/install.ps1 | iex'
const INSTALL_SH = 'curl -fsSL https://raw.githubusercontent.com/ganeshuppula02/get/main/install.sh | sh'

const ICON: Record<string, string> = {
  'backed up': '💾',
  ran: '✓',
  'asked you': '✋',
  stopped: '🚫',
  undone: '↶',
  expired: '·',
}

// On Windows `undoable` is a .cmd file, which only cmd starts; elsewhere it runs as it is.
let isWindows: boolean | null = null

async function undoable($: EngineInterface, args: string[]) {
  if (isWindows === null) isWindows = (await $.session.info()).platform === 'windows'
  const argv = isWindows ? ['cmd', '/c', 'undoable', ...args] : ['undoable', ...args]
  return $.process.run(argv, { cwd: await $.session.cwd(), timeoutMs: 60_000 })
}

/** Read Undoable's status for the panel and the status line. */
async function refresh($: EngineInterface) {
  let ran: Awaited<ReturnType<typeof undoable>> | null
  try {
    ran = await undoable($, ['status', '--json'])
  } catch {
    ran = null
  }
  if (!ran || ran.exitCode !== 0 || !ran.stdout.trim().startsWith('{')) {
    const out = `${ran?.stdout ?? ''}${ran?.stderr ?? ''}`
    const problem =
      !ran || /not recognized|not found|No such file|ENOENT/i.test(out)
        ? `Undoable isn't installed here. Install it with:\n${isWindows ? INSTALL_WIN : INSTALL_SH}`
        : /Unknown command|Usage|undo button for AI agents/i.test(out)
          ? 'This panel needs Undoable 0.18 or newer: run the install line again to update.'
          : `Undoable didn't answer: ${out.trim().slice(0, 200)}`
    await update($, view, v => ({ ...v, status: null, problem }))
    $.ui.status(undefined)
    return
  }
  const status = JSON.parse(ran.stdout) as PanelStatus
  await update($, view, v => ({ ...v, status, problem: null }))
  const w = status.week
  const waiting = status.pending.length
  $.ui.status(`🛡️ Undoable: ${w.backedUp} backed up${w.stopped ? ` · ${w.stopped} stopped` : ''}${waiting ? ` · ${waiting} waiting for you` : ''}`)
}

/** A button: run the same undoable command a person would type, show its answer, then refresh. */
async function act($: EngineInterface, args: string[]) {
  const ran = await undoable($, [...args, '--yes'])
  const said = (ran.stdout + ran.stderr).trim().split('\n').slice(0, 3).join('\n')
  await update($, view, v => ({ ...v, message: said || (ran.exitCode === 0 ? 'Done.' : "It didn't work."), isConfirmingSession: false }))
  $.ui.toast(said.split('\n')[0] || 'Done.')
  await refresh($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'undoable', description: "Show Undoable's panel: what was backed up, what's waiting, Undo buttons" })
    void $.ui.open({ id: PANE, title: 'Undoable' })
    void refresh($)
    return started
  })

  on('command.run', { command: 'undoable' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Undoable' })
    await refresh($)
    return { text: 'Undoable panel opened.' }
  })

  // After every tool call: what did Undoable just do? (Read without slowing the agent down.)
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    void refresh($)
    return ran
  }).catch(($, e, next) => next(e)) // the panel failing must never stop the agent's tool call

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const v = await read($, view)
    const room = Math.max(3, (e.viewport?.rows ?? 30) - 14)

    if (v.problem) {
      return (
        <Box flexDirection="column">
          <Text bold>🛡️ Undoable</Text>
          <Text>{v.problem}</Text>
          <Button key="refresh" label="Check again" onPress={() => refresh($)} />
        </Box>
      )
    }
    const st = v.status
    if (!st) return <Text dimColor>🛡️ Reading Undoable…</Text>
    const w = st.week

    return (
      <Box flexDirection="column">
        <Text bold>🛡️ Undoable · {st.project}</Text>
        <Text dimColor>
          This week: {w.checked} checked · {w.backedUp} backed up · {w.waiting} asked · {w.stopped} stopped · {w.undone} undone
          {w.promptsSaved ? ` · ${w.promptsSaved} prompts saved` : ''}
        </Text>

        {st.pending.length > 0 && <Text bold>Waiting for your OK</Text>}
        {st.pending.map(r => (
          <Box key={`p-${r.id}`} flexDirection="column">
            <Text>
              ✋ {r.id} {r.what.length > 70 ? `${r.what.slice(0, 69)}…` : r.what}
            </Text>
            <Text dimColor>   {r.reason}{r.why ? ` · why: ${r.why}` : ''}</Text>
            <Box>
              <Button key={`approve-${r.id}`} label={`Approve ${r.id}`} onPress={() => act($, ['approve', r.id])} />
              <Button key={`block-${r.id}`} label={`Block ${r.id}`} onPress={() => act($, ['reject', r.id])} />
            </Box>
          </Box>
        ))}

        <Text bold>Recent</Text>
        {st.actions.length === 0 && <Text dimColor>Nothing yet: Undoable records from the moment it's set up.</Text>}
        {st.actions.slice(0, room).map(a => (
          <Box key={`a-${a.id}`}>
            <Text dimColor={a.state === 'ran' || a.state === 'undone' || a.state === 'expired'}>
              {ICON[a.state] ?? '·'} {a.id} {a.what.length > 48 ? `${a.what.slice(0, 47)}…` : a.what}
              {a.helper ? ` (helper: ${a.helper})` : ''}{' '}
            </Text>
            {a.canUndo && <Button key={`undo-${a.id}`} label={`Undo ${a.id}`} onPress={() => act($, ['undo', a.id])} />}
          </Box>
        ))}

        {st.lastSession && (
          <Box>
            {v.isConfirmingSession ? (
              <>
                <Text>Put back everything from the last session ({st.lastSession.actions} actions)? </Text>
                <Button key="session-yes" label="Yes, undo it" onPress={() => act($, ['undo', '--session', 'last'])} />
                <Button key="session-no" label="Cancel" onPress={() => update($, view, x => ({ ...x, isConfirmingSession: false }))} />
              </>
            ) : (
              <Button key="session" label="Undo this session" onPress={() => update($, view, x => ({ ...x, isConfirmingSession: true }))} />
            )}
          </Box>
        )}
        {v.message && <Text dimColor>{v.message}</Text>}
        <Button key="refresh" label="Refresh" onPress={() => refresh($)} />
      </Box>
    )
  })
}
