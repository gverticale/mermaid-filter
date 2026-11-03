const pandoc = require('pandoc-filter')
/* global test jest describe expect beforeEach */
describe('mermaid', () => {
  let fs, exec, filter
  beforeEach(() => {
    jest.mock('fs')
    jest.mock('process', () => ({
      env: {}
    }))
    jest.mock('tmp', () => ({
      fileSync: jest.fn().mockReturnValue({
        name: 'tmpfile'
      })
    }))
    jest.mock('child_process', () => ({
      execSync: jest.fn()
    }))
    jest.mock('imgur', () => {
      const upload = jest.fn()
      return { ImgurClient: jest.fn(() => ({ upload })), upload }
    })
    fs = require('fs')
    exec = require('child_process').execSync
    fs.existsSync = jest.fn().mockReturnValue(true)
    filter = require('./filter')

    fs.writeFileSync = jest.fn()
    fs.readFileSync = jest.fn().mockReturnValue('graph TD;\nA-->B;')
    jest.clearAllMocks()
  })
  test('returns null for non code block', async () => {
    const type = 'Paragraph'
    const value = []
    const format = ''
    const meta = {}

    expect(await filter.mermaid(type, value, format, meta)).toBeNull()
  })

  test('returns null if no mermaid class', async () => {
    const type = 'CodeBlock'
    const value = [['id', ['other']], 'graph TD;\nA-->B;']
    const format = ''
    const meta = {}

    expect(await filter.mermaid(type, value, format, meta)).toBeNull()
  })

  test('renders with default options', async () => {
    await filter.mermaid('CodeBlock', [['id', ['mermaid']], 'x'])

    expect(exec).toHaveBeenCalled()
    const cmd = exec.mock.lastCall[0]
    console.log('cmd', cmd)
    expect(cmd).toContain('mmdc')
    expect(cmd).toContain('-s 1')
    expect(cmd).not.toContain(' -f ')
    expect(cmd).toContain('-i "tmpfile"')
    expect(cmd).toContain('-t default')
    expect(cmd).toContain('--size 800')
    expect(cmd).toContain('-b white')
    expect(cmd).toContain('-o "tmpfile.png"')
  })

  test('returns RawBlock for svg inline', async () => {
    const block = await filter.mermaid('CodeBlock', [['id', ['mermaid'], [['format', 'svg']]], 'x'])

    expect(block).toEqual(expect.objectContaining({
      t: 'RawBlock',
      c: ['html', 'graph TD;\nA-->B;']
    }))
    expect(exec).toHaveBeenCalled()
    const cmd = exec.mock.lastCall[0]
    console.log('cmd', cmd)
    expect(cmd).toContain('mmdc')
    expect(cmd).toContain('-s 1')
    expect(cmd).not.toContain(' -f ')
    expect(cmd).toContain('-i "tmpfile"')
    expect(cmd).toContain('-t default')
    expect(cmd).toContain('--size 800')
    expect(cmd).toContain('-b white')
    expect(cmd).toContain('-o "tmpfile.svg"')
  })

  test('sets title as fig: if id starts with fig:', async () => {
    const para = await filter.mermaid('CodeBlock',
      [['fig:someref',
        ['mermaid']], 'x'])

    expect(para).toEqual(expect.objectContaining({
      t: 'Para',
      c: [
        {
          t: 'Image',
          c: [
            ['fig:someref', [], []],
            [pandoc.Str('')],
            [expect.any(String), 'fig:']
          ]
        }
      ]
    }))
  })

  test('sets alt from caption attribute', async () => {
    const para = await filter.mermaid('CodeBlock',
      [['id',
        ['mermaid'],
        [['caption', 'a caption']]], 'x'])

    expect(para).toEqual(expect.objectContaining({
      t: 'Para',
      c: [
        {
          t: 'Image',
          c: [
            ['id', [], []],
            [pandoc.Str('a caption')],
            [expect.any(String), '']
          ]
        }
      ]
    }))

    expect(exec).toHaveBeenCalled()
    const cmd = exec.mock.lastCall[0]
    console.log('cmd', cmd)
    expect(cmd).toContain('mmdc')
    expect(cmd).toContain('-s 1')
    expect(cmd).not.toContain(' -f ')
    expect(cmd).toContain('-i "tmpfile"')
    expect(cmd).toContain('-t default')
    expect(cmd).toContain('--size 800')
    expect(cmd).toContain('-b white')
    expect(cmd).toContain('-o "tmpfile.png"')
  })

  test('uploads to imgur with loc=imgur', async () => {
    const imgur = require('imgur')
    imgur.upload.mockResolvedValue({ success: true, status: 200, data: { link: 'http://i.imgur.com/abc.png' } })

    const fig = await filter.mermaid('CodeBlock', [['id', ['mermaid'], [['loc', 'imgur']]], 'x'])

    expect(imgur.ImgurClient).toHaveBeenCalledWith({ clientId: expect.any(String) })
    expect(imgur.upload).toHaveBeenCalledWith(expect.objectContaining({ type: 'base64' }))
    expect(JSON.stringify(fig)).toContain('"https://i.imgur.com/abc.png"')
  })

  test('throws when the imgur upload fails', async () => {
    const imgur = require('imgur')
    imgur.upload.mockResolvedValue({ success: false, status: 429, data: 'rate limited' })

    await expect(filter.mermaid('CodeBlock', [['id', ['mermaid'], [['loc', 'imgur']]], 'x']))
      .rejects.toThrow('imgur upload failed (429)')
  })
})
