const express = require('express')
const methodOverride = require('method-override')
const _ = require('lodash')
const lodashId = require('lodash-id')
const low = require('lowdb')
const Memory = require('lowdb/adapters/Memory')
const FileSync = require('lowdb/adapters/FileSync')
const bodyParser = require('../body-parser')
const validateData = require('./validate-data')
const plural = require('./plural')
const nested = require('./nested')
const singular = require('./singular')
const mixins = require('../mixins')

module.exports = (dbFiles, opts) => {
  opts = Object.assign({ foreignKeySuffix: 'Id', _isFake: false }, opts)

  let db
  if (Array.isArray(dbFiles)) {
    db = low(new Memory())
    for (const file of dbFiles) {
      const tempDb = low(new FileSync(file))
      db.defaults(tempDb.getState()).write()
    }
  } else if (typeof dbFiles === 'string') {
    db = low(new FileSync(dbFiles))
  } else if (!_.has(dbFiles, '__chain__') || !_.has(dbFiles, '__wrapped__')) {
    db = low(new Memory()).setState(dbFiles)
  }

  // Create router
  const router = express.Router()

  // Add middlewares
  router.use(methodOverride())
  router.use(bodyParser)

  validateData(db.getState())

  // Add lodash-id methods to db
  db._.mixin(lodashId)

  // Add specific mixins
  db._.mixin(mixins)

  // Expose database
  router.db = db

  // Expose render
  router.render = (req, res) => {
    res.jsonp(res.locals.data)
  }

  // GET /db
  router.get('/db', (req, res) => {
    res.jsonp(db.getState())
  })

  // Handle /:parent/:parentId/:resource
  router.use(nested(opts))

  // Create routes
  db.forEach((value, key) => {
    if (key === '$schema') {
      // ignore $schema
      return
    }

    if (_.isPlainObject(value)) {
      router.use(`/${key}`, singular(db, key, opts))
      return
    }

    if (_.isArray(value)) {
      router.use(`/${key}`, plural(db, key, opts))
      return
    }

    const sourceMessage = ''
    // if (!_.isObject(source)) {
    //   sourceMessage = `in ${source}`
    // }

    const msg =
      `Type of "${key}" (${typeof value}) ${sourceMessage} is not supported. ` +
      `Use objects or arrays of objects.`

    throw new Error(msg)
  }).value()

  router.use((req, res) => {
    if (!res.locals.data) {
      res.status(404)
      res.locals.data = {}
    }

    router.render(req, res)
  })

  router.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).send(err.stack)
  })

  return router
}
