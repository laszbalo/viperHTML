'use strict';

/*! (C) 2017 Andrea Giammarchi @WebReflection (MIT) */

// friendly destructuring
viper.viper = viper;

// magic entry point for most operations (bind, wire)
function viper(HTML) {
  return arguments.length < 2 ?
    (HTML == null || typeof HTML === 'string' ?
      render.bind({}) :
      ('raw' in HTML ?
        render.bind({})(HTML) :
        wireWeakly(HTML, 'html'))) :
    ('raw' in HTML ?
      render.bind({}) : viper.wire
    ).apply(null, arguments);
}

// viperHTML \o/
//
// var render = viperHTML.bind(object);
// render`
//  <h1>⚡️ viperHTML ⚡️</h1>
//  <p>
//    ${(new Date).toLocaleString()}
//  </p>
// `;
function render(template) {
  var viper = vipers.get(this);
  if (
    !viper ||
    viper.template !== template
  ) {
    viper = upgrade.apply(this, arguments);
    vipers.set(this, viper);
  }
  return (this instanceof Async ? this.update : update)
          .apply(viper, arguments);
}

// A wire ➰ is a shortcut to relate a specific object,
// or a runtime created one, to a specific template.
//
// var render = viperHTML.wire();
// render`
//  <div>Hello Wired!</div>
// `;
viper.wire = function wire(obj, type) {
  return arguments.length < 1 || obj == null ?
    render.bind({}) :
    wireWeakly(obj, type || 'html');
};

// An asynchronous wire ➰ is a weakly referenced callback,
// to be invoked right before the template literals
// to return a rendered capable of resolving chunks.
viper.async = function getAsync(obj) {
  return arguments.length < 1 ?
    createAsync() :
    (asyncs.get(obj) || set(asyncs, obj, createAsync()));
};

const Component = require('./Component.js')(render);
viper.Component = Component;

// - - - - - - - - - - - - - - - - - -  - - - - -

// -------------------------
// Helpers
// -------------------------

// used to produce a buffer output
function asBuffer(output) {
  return Buffer.from(output.join(''));
}

// used to force html output
function asHTML(html) {
  return {html: html};
}

// instrument a wire to work asynchronously
// passing along an optional resolved chunks
// interceptor callback
function createAsync() {
  var
    wired = new Async,
    wire = render.bind(wired),
    chunksReceiver
  ;
  wired.update = function () {
    this.callback = chunksReceiver;
    return chunks.apply(this, arguments);
  };
  return function (callback) {
    chunksReceiver = callback || String;
    return wire;
  };
}

// ensure String value and escape it
function escape(s) {
  return htmlEscape(String(s));
}

// given a list of updates
// create a copy with the right update for HTML
function fixUpdates(updates) {
  for (var
    update,
    i = 0,
    length = updates.length,
    out = [];
    i < length; i++
  ) {
    update = updates[i];
    out.push(update === getUpdateForHTML ? update.call(this) : update);
  }
  return out;
}

// if an interpolated value is an Array
// return Promise or join by empty string
function getUpdateForHTML() {
  return this instanceof Async ? identity : asTemplateValue;
}

// pass along a generic value
function identity(value) {
  return value;
}

// use a placeholder and resolve with the right callback
function invokeAtDistance(value, asTPV) {
  var after = asTPV ? asTemplateValue : identity;
  if ('text' in value) {
    return Promise.resolve(value.text).then(String).then(after);
  } else if ('any' in value) {
    return Promise.resolve(value.any).then(after);
  } else if ('html' in value) {
    return Promise.resolve(value.html).then(asHTML).then(after);
  } else {
    return Promise.resolve(invokeTransformer(value)).then(after);
  }
}

// last attempt to transform content
function invokeTransformer(object) {
  for (var key, i = 0, length = transformersKeys.length; i < length; i++) {
    key = transformersKeys[i];
    if (object.hasOwnProperty(key)) {
      // noop is passed to respect hyperHTML API but it won't have
      // any effect at distance for the time being
      return transformers[key](object[key], noop);
    }
  }
}

// literally
function noop() {}

// multiple content joined as single string
function asTemplateValue(value, isAttribute) {
  var presuf = isAttribute ? '' : createHyperComment();
  switch(typeof value) {
    case 'string': return presuf + escape(value) + presuf;
    case 'boolean':
    case 'number': return presuf + value + presuf;
    case 'object':
      if (value instanceof Buffer) return presuf + value + presuf;
      if (value instanceof Component) return asTemplateValue(value.render(), isAttribute);
    case 'undefined':
      if (value == null) return presuf + '' + presuf;
    default:
      if (isArray(value)) {
        for (var i = 0, length = value.length; i < length; i++) {
          if (value[i] instanceof Component) {
            value[i] = value[i].render();
          }
        }
        return presuf + value.join('') + presuf;
      }
      if ('placeholder' in value) return invokeAtDistance(value, true);
      if ('text' in value) return presuf + escape(value.text) + presuf;
      if ('any' in value) return asTemplateValue(value.any, isAttribute);
      if ('html' in value) return presuf + [].concat(value.html).join('') + presuf;
      return asTemplateValue(invokeTransformer(value), isAttribute);
  }
}

// weakly relate a generic object to a generic value
function set(map, object, value) {
  map.set(object, value);
  return value;
}

// same as escape but specific for attributes
function updateAttribute(s) {
  return htmlEscape(String(s));
}

function updateAttributeIntent(name) {
  return function (any) {
    var result = intentAttributes[name](null, any);
    return result == null ? '' : htmlEscape(String(result));
  };
}

// return the right callback to update a boolean attribute
// after modifying the template to ignore such attribute if falsy
function updateBoolean(name) {
  name = ' ' + name;
  function update(value) {
    switch (value) {
      case true:
      case 'true':
        return name;
    }
    return '';
  }
  update[UID] = true;
  return update;
}

function ized($0, $1, $2) {
  return $1 + '-' + $2.toLowerCase();
}

function asCSSValue(key, value) {
  return typeof value === 'number' &&
          !IS_NON_DIMENSIONAL.test(key) ? (value + 'px') : value;
}

function updateStyle(value) {
  if (typeof value === 'object') {
    for (var
      key,
      css = [],
      keys = Object.keys(value),
      i = 0, length = keys.length; i < length; i++
    ) {
      key = keys[i];
      css.push(
        key.replace(hyphen, ized),
        ':',
        asCSSValue(key, value[key]),
        ';'
      );
    }
    return htmlEscape(css.join(''));
  } else {
    return htmlEscape(value);
  }
}

// return the right callback to invoke an event
// stringifying the callback and invoking it
// to simulate a proper DOM behavior
function updateEvent(value) {
  switch (typeof value) {
    case 'function': return 'return (' + escape(
      JS_SHORTCUT.test(value) && !JS_FUNCTION.test(value) ?
        ('function ' + value) :
        value
    ) + ').call(this, event)';
    case 'object': return '';
    default: return escape(value || '');
  }
}

// -------------------------
// Template setup
// -------------------------

// resolves through promises and
// invoke a notifier per each resolved chunk
// the context will be a viper
function chunks() {
  for (var
    update,
    out = [],
    updates = this.updates,
    template = this.chunks,
    callback = this.callback,
    all = Promise.resolve(template[0]),
    chain = function (after) {
      return all.then(function (through) {
                  notify(through);
                  return after;
                });
    },
    getSubValue = function (value) {
      if (isArray(value)) {
        value.forEach(getSubValue);
      } else {
        all = chain(
          Promise.resolve(value)
                 .then(resolveArray)
        );
      }
    },
    getValue = function (value) {
      if (isArray(value)) {
        var hc = Promise.resolve(createHyperComment());
        all = chain(hc);
        value.forEach(getSubValue);
        all = chain(hc);
      } else {
        all = chain(
          Promise.resolve(value)
                 .then(resolveAsTemplateValue(update))
                 .then(update === asTemplateValue ? identity : update)
        );
      }
    },
    notify = function (chunk) {
      out.push(chunk);
      callback(chunk);
    },
    i = 1,
    length = arguments.length; i < length; i++
  ) {
    update = updates[i - 1];
    getValue(arguments[i]);
    all = chain(template[i]);
  }
  return all.then(notify).then(function () { return out; });
}

// tweaks asTemplateValue to think the value is an Array
// but without needing to add the suffix.
// Used to place an hyper comment after a group of values has been resolved
// instead of per each resolved value.
function resolveArray(value) {
  return asTemplateValue(isArray(value) ? value : [value], true);
}

// invokes at distance asTemplateValue
// passing the "isAttribute" flag
function resolveAsTemplateValue(update) {
  return function (value) {
    return asTemplateValue(
      value,
      update === updateAttribute ||
      update === updateEvent ||
      UID in update
    );
  };
}

// each known viperHTML update is
// kept as simple as possible.
// the context will be a viper
function update() {
  for (var
    tmp,
    promise = false,
    updates = this.updates,
    template = this.chunks,
    out = [template[0]],
    i = 1,
    length = arguments.length;
    i < length; i++
  ) {
    tmp = arguments[i];
    if (
      (typeof tmp === 'object' && tmp !== null)
      &&
      (typeof tmp.then === 'function' || 'placeholder' in tmp)
    ) {
      promise = true;
      out.push(
        ('placeholder' in tmp ? invokeAtDistance(tmp, false) : tmp)
          .then(updates[i - 1]),
        template[i]
      );
    } else {
      out.push(updates[i - 1](tmp), template[i]);
    }
  }
  return promise ? Promise.all(out).then(asBuffer) : asBuffer(out);
}

var updateMap = [
  updateEvent,
  updateBoolean,
  updateStyle,
  updateAttributeIntent,
  updateAttribute,
  getUpdateForHTML
];

function setupUpdates({chunks, updates, template}) {
  updates = updates.map(update => {
    if(Array.isArray(update)) { // TODO: this context is right?
      return updateMap[update[0]].apply(this, update.slice(1));
    }
    return updateMap[update];
  });
  return {
    chunks,
    updates,
    template
  };
}

// but the first time, it needs to be setup.
// From now on, only update(tempalte) will be called
// unless this context won't be used for other renderings.
function upgrade(template) {
  var info = templates.get(template) ||
      set(templates, template, setupUpdates(templateInfo.get(template, intentAttributes)));
  return {
    template: template,
    updates: fixUpdates.call(this, info.updates),
    chunks: info.chunks
  };
}

// -------------------------
// Wires
// -------------------------

function wireWeakly(obj, id) {
  var wire = wires.get(obj) || set(wires, obj, new Dict);
  return wire[id] || (wire[id] = render.bind({}));
}

function createHyperComment() {
  return adoptable ? ('<!--\x01:' + (++hyperComment).toString(36) + '-->') : '';
}

// -------------------------
// local variables
// -------------------------

var
  VOID_ELEMENT = /^(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)$/i,
  EXPANDO = '_viperHTML: ',
  UID = EXPANDO + (Math.random() * new Date() | 0) + ';',
  JS_SHORTCUT = /^[a-z$_]\S*?\(/,
  JS_FUNCTION = /^function\S*?\(/,
  IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i,
  hyphen = /([^A-Z])([A-Z]+)/g,
  htmlEscape = require('html-escaper').escape,
  templates = new WeakMap(),
  asyncs = new WeakMap(),
  vipers = new WeakMap(),
  wires = new WeakMap(),
  isArray = Array.isArray,
  intentAttributes = {},
  transformers = {},
  transformersKeys = [],
  hyperComment = 0,
  adoptable = false,
  templateInfo = require('./template-info')(UID),
  UpdateTypes = require('./update-types')
;

// traps function bind once (useful in destructuring)
viper.bind = function bind(context) { return render.bind(context); };

viper.define = function define(transformer, callback) {
  if (transformer.indexOf('-') < 0) {
    if (!(transformer in transformers)) {
      transformersKeys.push(transformer);
    }
    transformers[transformer] = callback;
    // TODO: else throw ? console.warn ? who cares ?
  } else {
    intentAttributes[transformer] = callback;
  }
};

Object.defineProperty(viper, 'adoptable', {
  get: function () {
    return adoptable;
  },
  set: function (value) {
    adoptable = !!value;
  }
});

module.exports = viper;

// local class to easily recognize async wires
function Async() {}

// local class to easily create wires
function Dict() {}
Dict.prototype = Object.create(null);
