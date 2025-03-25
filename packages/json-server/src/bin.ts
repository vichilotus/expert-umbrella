#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { extname } from 'node:path'
import { parseArgs } from 'node:util'

import chalk from 'chalk'
import { watch } from 'chokidar'
import JSON5 from 'json5'
import { type Adapter, Low } from 'lowdb'
import { DataFile, JSONFile } from 'lowdb/node'
import type { PackageJson } from 'type-fest'

import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { Observer } from './observer.js'
import type { Data } from './service.js'

function help() {
  console.log(`Usage: json-server [options] <file>

Options:
  -p, --port <port>  Port (default: 3000)
  -h, --host <host>  Host (default: localhost)
  -s, --static <dir> Static files directory (multiple allowed)
  --help             Show this message
  --version          Show version number
`)
}

// Parse args
function args(): {
  files: string[]
  port: number
  host: string
  static: string[]
} {
  try {
    const { values, positionals } = parseArgs({
      options: {
        port: {
          type: 'string',
          short: 'p',
          default: process.env['PORT'] ?? '3000',
        },
        host: {
          type: 'string',
          short: 'h',
          default: process.env['HOST'] ?? 'localhost',
        },
        static: {
          type: 'string',
          short: 's',
          multiple: true,
          default: [],
        },
        help: {
          type: 'boolean',
        },
        version: {
          type: 'boolean',
        },
      },
      allowPositionals: true,
    })

    if (values.version) {
      const pkg = JSON.parse(
        readFileSync(
          fileURLToPath(new URL('../package.json', import.meta.url)),
          'utf-8',
        ),
      ) as PackageJson
      console.log(pkg.version)
      process.exit()
    }

    if (values.help || positionals.length === 0) {
      help()
      process.exit()
    }

    return {
      files: positionals,
      port: Number.parseInt(values.port as string),
      host: values.host as string,
      static: values.static as string[],
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
      console.log(chalk.red((e as NodeJS.ErrnoException).message.split('.')[0]))
      help()
      process.exit(1)
    } else {
      throw e
    }
  }
}

const { files, port, host, static: staticArr } = args()

// Check if all files exist
for (const file of files) {
  if (!existsSync(file)) {
    console.log(chalk.red(`File ${file} not found`))
    process.exit(1)
  }

  // Handle empty string JSON files
  if (readFileSync(file, 'utf-8').trim() === '') {
    writeFileSync(file, '{}')
  }
}

// Merge data from all files
let mergedData: Data = {}
for (const file of files) {
  let adapter: Adapter<Data>
  if (extname(file) === '.json5') {
    adapter = new DataFile<Data>(file, {
      parse: JSON5.parse,
      stringify: JSON5.stringify,
    })
  } else {
    adapter = new JSONFile<Data>(file)
  }

  const tempDb = new Low<Data>(adapter, {})
  await tempDb.read()
  mergedData = { ...mergedData, ...tempDb.data }
}

// Set up database
const observer = new Observer(new JSONFile<Data>('in-memory-db.json'))
const db = new Low<Data>(observer, mergedData)
await db.read()

// Create app
const app = createApp(db, { logger: false, static: staticArr })

function logRoutes(data: Data) {
  console.log(chalk.bold('Endpoints:'))
  if (Object.keys(data).length === 0) {
    console.log(chalk.gray("No endpoints found, try adding some data to the files"))
    return
  }
  console.log(
    Object.keys(data)
      .map(
        (key) => `${chalk.gray(`http://${host}:${port}/`)}${chalk.blue(key)}`,
      )
      .join('\n'),
  )
}

const kaomojis = ['♡⸜(˶˃ ᵕ ˂˶)⸝♡', '♡( ◡‿◡ )', '( ˶ˆ ᗜ ˆ˵ )', '(˶ᵔ ᵕ ᵔ˶)']

function randomItem(items: string[]): string {
  const index = Math.floor(Math.random() * items.length)
  return items.at(index) ?? ''
}

app.listen(port, () => {
  console.log(
    [
      chalk.bold(`JSON Server started on PORT :${port}`),
      chalk.gray('Press CTRL-C to stop'),
      chalk.gray(`Watching files: ${files.join(', ')}`),
      '',
      chalk.magenta(randomItem(kaomojis)),
      '',
      chalk.bold('Index:'),
      chalk.gray(`http://localhost:${port}/`),
      '',
      chalk.bold('Static files:'),
      chalk.gray('Serving ./public directory if it exists'),
      '',
    ].join('\n'),
  )
  logRoutes(db.data)
})

// Watch files for changes
if (process.env['NODE_ENV'] !== 'production') {
  let writing = false
  let prevEndpoints = ''

  observer.onWriteStart = () => {
    writing = true
  }
  observer.onWriteEnd = () => {
    writing = false
  }
  observer.onReadStart = () => {
    prevEndpoints = JSON.stringify(Object.keys(db.data).sort())
  }
  observer.onReadEnd = (data) => {
    if (data === null) {
      return
    }

    const nextEndpoints = JSON.stringify(Object.keys(data).sort())
    if (prevEndpoints !== nextEndpoints) {
      console.log()
      logRoutes(data)
    }
  }

  for (const file of files) {
    watch(file).on('change', async () => {
      if (!writing) {
        let updatedData: Data = {}
        for (const file of files) {
          let adapter: Adapter<Data>
          if (extname(file) === '.json5') {
            adapter = new DataFile<Data>(file, {
              parse: JSON5.parse,
              stringify: JSON5.stringify,
            })
          } else {
            adapter = new JSONFile<Data>(file)
          }

          const tempDb = new Low<Data>(adapter, {})
          await tempDb.read()
          updatedData = { ...updatedData, ...tempDb.data }
        }
        db.data = updatedData
        db.write().catch((e) => {
          if (e instanceof SyntaxError) {
            return console.log(
              chalk.red(['', 'Error parsing files', e.message].join('\n')),
            )
          }
          console.log(e)
        })
      }
    })
  }
}
