var UpdateTypes = require('./update-types');

module.exports = function templateInfo(UID) {

  // -------------------------
  // Minifiers
  // -------------------------

  function minifyCSS() {
    return csso.minify.apply(csso, arguments).css;
  }

  function minifyJS(code, options) {
    var result = uglify.minify(code, Object.assign({
       // uglify-js defaults
       output: {comments: /^!/}
    }, options));
    return result.error ? code : result.code;
  }

  // -------------------------
  // Helpers
  // -------------------------

  // parse all comments at once and sanitize them
  function comments($0, $1, $2, $3) {
    return $1 + $2.replace(FIND_ATTRIBUTES, sanitizeAttributes) + $3;
  }

  // splice 0 - length an array and join its content
  function empty(array) {
    return array.splice(0, array.length).join('');
  }

  // sanitizes quotes around attributes
  function sanitizeAttributes($0, $1, $2) {
    return $1 + ($2 || '"') + UID + ($2 || '"');
  }

  // -------------------------
  // local variables
  // -------------------------

  var
    VOID_ELEMENT = /^area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr$/i,
    UIDC = '<!--' + UID + '-->',
    ATTRIBUTE_EVENT = /^on\S+$/,
    SPECIAL_ATTRIBUTE = /^(?:(?:on|allow)[a-z]+|async|autofocus|autoplay|capture|checked|controls|default|defer|disabled|formnovalidate|hidden|ismap|itemscope|loop|multiple|muted|nomodule|novalidate|open|playsinline|readonly|required|reversed|selected|truespeed|typemustmatch|usecache)$/,
    NO = /(<[a-z]+[a-z0-9:_-]*)((?:[^\S]+[a-z0-9:_-]+(?:=(?:'.*?'|".*?"|<.+?>|\S+))?)+)([^\S]*\/?>)/gi,
    FIND_ATTRIBUTES = new RegExp('([^\\S][a-z]+[a-z0-9:_-]*=)([\'"]?)' + UIDC + '\\2', 'gi'),
    csso = require('csso'),
    uglify = require("uglify-js"),
    Parser = require('htmlparser2').Parser
    T = {},
    TL = function (t, intentAttributes) {
      var k = '_' + t.join('_');
      return T[k] || (T[k] = Object.freeze(transform(t, intentAttributes)));
    }
  ;
  // join a template via unique comment
  // look for comments in attributes and content
  // define updates to be invoked for this template
  // sanitize and clean the layout too

  function transform(template, intentAttributes) {
    var tagName = '';
    var isCDATA = false;
    var current = [];
    var chunks = [];
    var updates = [];
    var content = new Parser({
      onopentag: function (name, attributes) {
        tagName = name;
        current.push('<', name);
        for (var key in attributes) {
          if (attributes.hasOwnProperty(key)) {
            var value = attributes[key];
            var isPermutation = value === UID;
            var isSpecial = SPECIAL_ATTRIBUTE.test(key);
            var isEvent = isPermutation && ATTRIBUTE_EVENT.test(key);
            if (isPermutation) {
              if (isSpecial) {
                if (isEvent) {
                  current.push(' ', key, '="');
                  updates.push(UpdateTypes.UPDATE_EVENT);
                } else {
                  updates.push([UpdateTypes.UPDATE_BOOLEAN, key]);
                  }
              } else {
                  current.push(' ', key, '="');
                  updates.push(
                    /style/i.test(key) ?
                      UpdateTypes.UPDATE_STYLE :
                      (key in intentAttributes ?
                        [UpdateTypes.UPDATE_ATTRIBUTE_INTENT, key] :
                        UpdateTypes.UPDATE_ATTRIBUTE)
                  );
              }
              chunks.push(empty(current));
              if (!isSpecial || isEvent) current.push('"');
            } else {
              if (isSpecial && value.length === 0) {
                current.push(' ', key);
              } else {
                var quote = value.indexOf('"') < 0 ? '"' : "'";
                current.push(' ', key, '=', quote, value, quote);
              }
            }
          }
        }
        current.push('>');
      },
      oncdatastart: function () {
        current.push('<![CDATA[');
        isCDATA = true;
      },
      oncdataend: function () {
        current.push(']]>');
        isCDATA = false;
      },
      onprocessinginstruction: function (name, data) {
        current.push('<', data, '>');
      },
      onclosetag: function (name) {
        if (!VOID_ELEMENT.test(name)) {
          current.push('</', name, '>');
        }
        tagName = '';
      },
      ontext: function (text) {
        var length = updates.length - 1;
        switch (true) {
          case isCDATA:
          case /^code|input|textarea|pre$/i.test(tagName):
            current.push(text);
            break;
          case /^script$/i.test(tagName):
            current.push(minifyJS(text));
            break;
          case /^style$/i.test(tagName):
            current.push(minifyCSS(text));
            break;
          default:
            current.push(text);
            break;
        }
      },
      oncomment: function (data) {
        if (data === UID) {
          chunks.push(empty(current));
          updates.push(UpdateTypes.GET_UPDATE_FOR_HTML);
        } else {
          current.push('<!--' + data + '-->');
        }
      },
      onend: function () {
        chunks.push(empty(current));
      }
    }, {
       decodeEntities: false,
       xmlMode: true
    });
    content.write(template.join(UIDC).replace(NO, comments));
    content.end();
    return {
      chunks: chunks,
      updates: updates
    };
  }

  return {
    get(template, intentAttributes) { // returns the transform stuff
      return TL(template, intentAttributes)
    }
  }
}
