(function (global, factory) {
  /* global module, define */

  'use strict'

  var i18n = factory()

  if (typeof (module) === 'object' && typeof (module.exports) === 'object') {
    module.exports = i18n
  } else if (typeof (define) === 'function') {
    define([], i18n)
  } else {
    global.i18n = i18n
  }
}(this, function () {
  'use strict'

  var languageDialect = (function (lang) {
    window.location.search.slice(1).split('&').some(function (searchTerm) {
      if (searchTerm.indexOf('lang=') === 0) {
        lang = searchTerm.split('=').slice(1).join('=')
        return true
      }
    })

    return lang.toLowerCase()
  })(window.navigator.userLanguage || window.navigator.language)
  var language = languageDialect.split('-')[0]
  var findByPath = function (obj, path) {
    return path.split('.').reduce(function (obj, key) {
      return obj ? obj[key] : undefined
    }, obj)
  }
  var Translations = (function () {
    var scope = '_scope'

    function Translations (language, o) {
      this.language = language
      this[scope] = o
    }

    Translations.prototype.find = function (path) {
      return findByPath(this[scope], path)
    }

    Translations.prototype.translate = function (ele) {
      if (getLang(ele) === this.language) {
        if (!ele.hasAttribute('data-i18n')) {
          [].slice.call(ele.querySelectorAll('[lang]:not([lang="' + this.language + '"])')).forEach(this.translate, this)
        }
      } else if (ele.hasAttribute('data-i18n')) {
        applyTranslationToElement(ele, this)
      } else {
        [].slice.call(ele.querySelectorAll('[data-i18n]')).map(function (match) {
          if (getLang(match, ele) !== this.language) {
            applyTranslationToElement(match, this)
          }
        }, this)
      }

      return ele
    }

    return Translations
  }())
  var Localisations = (function () {
    var scope = '_scope'

    function Format (str) {
      var tmp = ''
      var strs = []
      var parts = []
      var wasPercent = false
      var open = false

      str.split('').forEach(function (chr) {
        if (wasPercent) {
          if (chr === '%') {
            tmp += '%'
          } else {
            strs.push(tmp)
            tmp = ''

            if (chr === '{') {
              open = true
            } else {
              parts.push(chr)
            }
          }
          wasPercent = false
        } else if (chr === '%') {
          wasPercent = true
        } else if (open && chr === '}') {
          parts.push(tmp)
          tmp = ''
          open = false
        } else {
          tmp += chr
        }
      })

      if (strs.length === parts.length) {
        strs.push(tmp)
      }

      this.parts = parts
      this.strs = strs
    }

    Format.prototype.apply = function (obj) {
      return new AppliedFormat(this, obj)
    }

    Format.parse = function (any) {
      var ret

      if (typeof (any) === 'object') {
        if (Array.isArray(any)) {
          return any.map(Format.parse.bind(Format))
        } else {
          ret = {}
          Object.keys(any).forEach(function (key) {
            ret[key] = Format.parse(any[key])
          })
          return ret
        }
      } else {
        return new Format(String(any))
      }
    }

    function AppliedFormat (format, obj) {
      this.strs = format.strs
      this.values = format.parts.map(function (name) {
        return typeof (obj[name]) === 'function' ? obj[name]() : obj[name]
      })
    }

    AppliedFormat.prototype.toString = function () {
      var t = this

      return this.values.map(function (val, i) {
          return t.strs[i] + val
        }).join('') + this.strs[this.strs.length - 1]
    }

    function Localisations (language, o) {
      this.language = language
      this[scope] = o

      if ('time' in o) {
        Object.keys(o.time).forEach(function (key) {
          var val = o.time[key]
          var val2
          var def

          if (typeof (val) === 'object' && 'default' in val) {
            def = val.default
            delete val.default
          }
          val = Format.parse(val)
          if (typeof (def) !== 'undefined') {
            val2 = findByPath(val, def)
            Object.keys(val).forEach(function (key) {
              val2[key] = val[key]
            })
            val = val2
          }
          o.time[key] = val
        })
      }
    }

    Localisations.prototype.localise = function (node, type) {
      var isEle = node.nodeType === window.Node.ELEMENT_NODE
      var attr = node.tagName === 'DATA' ? 'value' : node.tagName === 'TIME' ? 'datetime' : (isEle && node.hasAttribute('data-i18n-original')) ? 'data-i18n-original' : undefined
      var val = attr ? node.getAttribute(attr) : isEle ? node.innerHTML : node.nodeValue

      if (!attr && isEle) {
        node.setAttribute('data-i18n-original', val)
      }

      if (!type && isEle) {
        type = node.getAttribute('data-i18n-localise-as')
      }

      if (!type) {
        throw new Error('Localisations.prototype.localise: missing type')
      }

      switch (type) {
        case 'number':
          val = this.localiseNumber(val)
        break

        case 'date':
          val = this.localiseDate(val)
        break

        case 'time':
          val = this.localiseTime(val)
        break

        default:
          throw new Error('Localisations.prototype.localise: missing or invalidtype')
      }

      if (isEle) {
        node.innerHTML = val
      } else {
        node.nodeValue = val
      }
    }

    Localisations.prototype.localiseNumber = function (number) {
      var separator = [this[scope].number.thousands, this[scope].number.thousandths]

      return parseFloat(number).toString().split('.').map(function (part, i) {
        var chrs = part.split('')
        var length = chrs.length
        var ret = []
        var i2

        if (length < 4) {
          return part
        }

        if (!i) {
          chrs.reverse()
        }

        for (i2 = 0; i2 < length; i2 += 3) {
          ret.push(chrs[i2], chrs[i2 + 1], chrs[i2 + 2])
          if (i2 + 3 < length) {
            ret.push(separator[i])
          }
        }

        if (!i) {
          ret.reverse()
        }

        return ret.join('')
      }).join(this[scope].number.decimal)
    }

    function padStr (str, len) {
      str = String(str)
      if (str.length >= len) {
        return str
      }
      return new Array(len - str.length + 1).join('0') + str
    }

    Localisations.prototype.localiseDate = function (date, format) {
      date = new Date(date)

      if (format) {
        format = findByPath(this[scope].time.date, format)
      } else {
        format = this[scope].time.date
      }
      return format.apply({
        'Y': function () {
          return padStr(date.getFullYear(), 4)
        },
        'm': function () {
          return padStr(date.getMonth() + 1, 2)
        },
        'd': function () {
          return padStr(date.getDate(), 2)
        }
      }).toString()
    }

    Localisations.prototype.localiseTime = function (time, format) {
      time = new Date('2014-01-01T' + time)

      if (format) {
        format = findByPath(this[scope].time.time, format)
      } else {
        format = this[scope].time.time
      }
      return format.apply({
        'H': function () {
          return padStr(time.getHours(), 2)
        },
        'i': function () {
          return padStr(time.getMinutes(), 2)
        },
        's': function () {
          return padStr(time.getSeconds(), 2)
        }
      }).toString()
    }

    return Localisations
  }())
  var debug = (function () {
    var debug = {
      enabled: false
    }

    ;['info', 'warn', 'error'].forEach(function (name) {
      debug[name] = function () {
        if (this.enabled) {
          console[name].apply(console, arguments)
        }
      }
    })

    return debug
  }())
  var i18n

  function applyTranslationToElement (ele, obj) {
    if (ele.hasAttribute('data-i18n')) {
      applyTranslation(ele, ele.getAttribute('data-i18n'), obj)
    }
  }

  function applyTranslation (ele, path, obj) {
    var translated = obj.find(path)

    if (typeof translated === 'object' && !Array.isArray(translated)) {
      debug.warn('Could not translate %o: path "%s" is of type object', ele, path)
    } else if (typeof (translated) !== 'undefined') {
      clean(ele)
      ele.appendChild(toDom(translated))
      ele.lang = language
    }
  }

  function getLang (ele, threshold) {
    do {
      if (ele.lang) {
        return ele.lang.toLowerCase()
      }
    } while ((ele = ele.parentElement) && ele !== threshold)
  }

  function clean (ele) {
    var child
    while ((child = ele.firstChild)) {
      ele.removeChild(child)
    }
  }

  function toDom (content) {
    if (Array.isArray(content)) {
      return content.reduce(function (frag, text) {
        var ele = document.createElement('p')
        ele.textContent = text
        frag.appendChild(ele)

        return frag
      }, document.createDocumentFragment())
    }
    return document.createTextNode(content)
  }

  function getJson (url) {
    return window.fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    }).then(function (res) {
      if (res.status >= 200 && res.status < 300) {
        return res.json()
      }

      // TODO add error object instead of false
      return Promise.reject(false)
    })
  }

  i18n = {
    translations: {
      base: (document.documentElement.getAttribute('data-i18n-base') || 'locales/'),
      set: (document.documentElement.getAttribute('data-i18n-set') || 'translation'),

      load: function (lang, set, base) {
        var url
        base = base || this.base || ''
        lang = lang || language
        set = set || this.set
        url = base + lang + '/' + set + '.json'

        debug.info('loading translations for %s from: %s', lang, url)

        return getJson(url).then(function (obj) {
          debug.info('successfully loaded translations for %s', lang)
          return new Translations(lang || language, obj)
        }).catch(function (err) {
          debug.error('Error loading translations for %s: %o', lang, err)
          return Promise.reject(err)
        })
      },
      loadDefault: function () {
        return this.loaded || (this.loaded = this.load())
      },
      reloadDefault: function () {
        return this.loaded && (this.loaded = this.load())
      },

      apply: function (ele) {
        return this.loadDefault().then(function (translations) {
          return translations.translate(ele)
        })
      },
      applyAll: function () {
        this.appliedAll = true
        return this.apply(document.documentElement)
      },

      get: function (path) {
        this.loadDefault()

        return this.loaded.then(function (obj) {
          return obj.find(path)
        })
      }
    },

    localisations: {
      base: (document.documentElement.getAttribute('data-i18n-localisations-base') || 'localisations/'),
      load: function (lang, base) {
        var url
        base = base || this.base || ''
        lang = lang || language
        url = base + lang + '.json'

        debug.info('loading localisations for %s from: %s', lang, url)

        return getJson(url).then(function (obj) {
          debug.info('successfully loaded localisations for %s', lang)
          return new Localisations(lang || language, obj)
        }).catch(function (err) {
          debug.error('Error loading localisations for %s: %o', lang, err)
          return Promise.reject(err)
        })
      },
      loadDefault: function () {
        return this.loaded || (this.loaded = this.load())
      },
      reloadDefault: function () {
        return this.loaded && (this.loaded = this.load())
      },

      apply: function (ele) {
        return this.loadDefault().then(function (localisations) {
          return localisations.localise(ele)
        })
      },
      applyAll: function () {
        this.appliedAll = true
        return this.loadDefault().then(function (localisations) {
          [].slice.call(document.querySelectorAll('[data-i18n-localise-as]')).forEach(function (ele) {
            localisations.localise(ele)
          })
          return document.documentElement
        })
      }
    },

    set language (lang) {
      lang = String(lang)

      if (lang !== language) {
        language = lang

        if (this.translations.loaded) {
          this.translations.reloadDefault()
        }
        if (this.translations.appliedAll) {
          this.translations.applyAll()
        }
        if (this.localisations.loaded) {
          this.localisations.reloadDefault()
        }
        if (this.localisations.appliedAll) {
          this.localisations.applyAll()
        }
      }
    },
    get language () {
      return language
    },

    get debug () {
      return debug.enabled
    },
    set debug (val) {
      debug.enabled = Boolean(val)
    }
  }

  if (!document.documentElement.hasAttribute('data-i18n-disable-auto')) {
    i18n.translations.applyAll()
    i18n.localisations.applyAll()
  }

  return i18n
}))
