import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'undoable',
  component: 'Pane',
  requestId: 'undoable',
  props: { title: 'Undoable', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

const STATUS = {
  project: 'test-shop',
  actions: [
    { id: 's2', at: '2026-11-26T10:01:00Z', what: 'rm -rf ~', state: 'asked you', reason: 'Deletes ~', canUndo: false },
    { id: 's1', at: '2026-11-26T10:00:00Z', what: 'rm -rf build', state: 'backed up', reason: 'Deletes build', canUndo: true },
  ],
  pending: [{ id: 'r1', what: 'git push --force', reason: 'Force-push', why: 'Ship the fix' }],
  lastSession: { id: 'abc', actions: 2 },
  week: { checked: 2, backedUp: 1, waiting: 1, stopped: 0, undone: 0, promptsSaved: 0 },
}

function engine(on: any, platform = 'linux', missing: string[] = []) {
  const ran: string[][] = []
  const status: (string | undefined)[] = []
  on('command.register', () => ({ value: { command: 'undoable' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  on('session.info', () => ({ value: { platform } }))
  on('session.cwd', () => ({ value: '/proj' }))
  on('ui.status', (_: unknown, e: any) => {
    status.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }))
  on('process.run', (_: unknown, e: any) => {
    ran.push([...e.argv])
    if (missing.includes(e.argv[0])) return { value: { exitCode: 1, stdout: '', stderr: "'undoable' is not recognized as an internal or external command" } }
    const isStatus = e.argv.join(' ').includes('status')
    return { value: { exitCode: 0, stdout: isStatus ? JSON.stringify(STATUS) : '↶ Undone s1: rm -rf build', stderr: '' } }
  })
  return { ran, status }
}

test('the panel shows what Undoable did, with Undo, Approve and Block buttons', async ($, on) => {
  const { ran, status } = engine(on)
  await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  await $.command.run({ command: 'undoable', args: '' } as never) // reads the status and waits for it

  expect(ran.some(a => a.join(' ') === 'undoable status --json')).toBe(true)
  expect(status.filter(Boolean).at(-1)).toBe('🛡️ 1 backed up · 1 waiting for you')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /rm -rf build/ }))?.text).toMatch(/💾 s1 rm -rf build/)
  expect(await ui.find({ type: 'Button', key: 'undo-s2' })).toBeUndefined() // can't be undone: no button
  expect(await ui.find({ type: 'Button', key: 'approve-r1' })).toBeDefined()

  await ui.press({ key: 'undo-s1' })
  expect(ran.some(a => a.join(' ') === 'undoable undo s1 --yes')).toBe(true)
  await ui.unmount()
})

test('undoing a whole session asks to confirm first', async ($, on) => {
  const { ran } = engine(on)
  await $.session.start({ cwd: '/proj', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'undoable', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'session' })
  expect(ran.some(a => a.includes('--session'))).toBe(false)
  await ui.press({ key: 'session-yes' })
  expect(ran.some(a => a.join(' ') === 'undoable undo --session last --yes')).toBe(true)
  await ui.unmount()
})

test('on Windows it starts undoable through cmd (it is a .cmd file there)', async ($, on) => {
  const { ran } = engine(on, 'windows')
  await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'undoable', args: '' } as never)
  expect(ran.some(a => a.join(' ') === 'cmd /d /s /c undoable status --json')).toBe(true)
})

test('on Windows, when cmd cannot find undoable, it tries PowerShell', async ($, on) => {
  const { ran } = engine(on, 'windows', ['cmd', 'cmd.exe'])
  await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'undoable', args: '' } as never)
  expect(ran.some(a => a[0] === 'powershell.exe' && a.at(-1) === 'undoable status --json')).toBe(true)
})
