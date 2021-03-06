const { mapKeys, forEachKey, ensureFn, when } = require('@snooty/utils');

const BOOLEAN_ATTRIBUTES = [
  'hidden',
  'checked',
  'required',
  'readonly',
  'selected',
  'disabled',
  'multiple'
];

const ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#x27;',
  '`': '&#x60;'
};

const ENTITIES_RE = new RegExp(Object.keys(ENTITIES).join('|'), 'g');

function escape(unsafe) {
  if (unsafe === null) return '';

  return String(unsafe).replace(ENTITIES_RE, entity => ENTITIES[entity]);
}

function html(tagDescription, ...data) {
  let [tagWithID, ...classes] = tagDescription.split('.');
  let [tag, id] = tagWithID.split('#');
  const content = [];
  const attrs = {};
  let fixedClasses = undefined;

  if (id) attrs.id = id;
  if (classes && classes.length) fixedClasses = classes.join(' ');

  for (const entity of data) {
    if (entity === undefined || entity === null || entity === false) continue;

    switch (typeof entity) {
      case 'function':
      case 'string':
        content.push(entity);
        break;
      case 'object':
        if (entity.constructor.name === 'Date') {
          content.push(entity);
        }
        forEachKey(entity, (key, val) => attrs[key] = val);
        break;
      default:
        throw new Error(`Unsupported parameter of type ${typeof entity}`);
    }
  }

  if (!('class' in attrs) && fixedClasses) attrs.class = '';

  return withBuffer((context, buffer, escaped) => {

    const renderedAttrs = mapKeys(attrs, (id, content) => {
      let rendered;

      if (id === 'class')
        rendered = classRender(fixedClasses, content, context);
      else {
        rendered = renderWith(content, context);

        if (rendered && typeof rendered === 'object')
          rendered = JSON.stringify(renderComplexObject(rendered, context));
      }

      const value = escaped ? rendered : escape(rendered);

      if (BOOLEAN_ATTRIBUTES.includes(id)) {
        return rendered ? id : undefined;
      } else {
        return rendered !== undefined ? `${id}="${value}"` : rendered;
      }
    }).filter(v => v !== undefined).join(' ');

    buffer.push(`<${tag}${renderedAttrs.length ? ' ' : ''}${renderedAttrs}>`);
    content.forEach(entity => render(entity, context, buffer, escaped));
    buffer.push(`</${tag}>`);
  });
}

function renderComplexObject(obj, context) {
  const renderVal = val => (typeof val === 'object')
    ?  renderComplexObject(val, context)
    : renderWith(val, context);

  if (Array.isArray(obj)) return obj.map(renderVal);

  const level = { };

  forEachKey(obj, (key, val) => (level[key] = renderVal(val)));

  return level;
}

function renderWith(content, context) {
  return typeof content === 'function' ? content(context) : content;
}

function withBuffer(fn) {
  return (context, _buffer, escaped) => {
    const buffer = _buffer || [];

    fn.call(null, context, buffer, escaped);

    return _buffer === undefined ? buffer.join('') : '';
  };
}

function render(entity, context, buffer, escaped) {
  if (entity === null || entity === undefined) return;
  if (entity === '' || entity === false) return;

  switch (typeof entity) {
    case 'function':
      render(entity(context, buffer, escaped), context, buffer, escaped);
      break;
    case 'string':
      buffer.push(escaped ? entity : escape(entity));
      break;
    case 'number':
      buffer.push(entity.toString());
      break;
    case 'object':
      if (entity.constructor.name === 'Date') {
        buffer.push(entity.toJSON());
        break;
      }
      for (const obj of entity){
        render(obj, context, buffer, escaped);
      }
      break;
  }
}

html.each = (collectionGetter, ...content) => {
  const getter = ensureFn(collectionGetter);

  return withBuffer((context, buffer, escaped) => {
    const collection = getter(context);

    if (!collection) return;

    collection.forEach((entry, index) =>
      render(content, {
        entry,
        index,
        parent: context,
        '$root': context['$root'] || context
      }, buffer, escaped));
  });
};

html.within = (contextGetter, ...content) => {
  const getter = ensureFn(contextGetter);

  return withBuffer((context, buffer, escaped) => {
    const { $root = context } = context;
    const shiftedContext = { ...getter(context) };
    Object.defineProperty(shiftedContext, '$root', { value: $root });
    Object.defineProperty(shiftedContext, '$parent', { value: context });

    content.forEach(entry =>
      render(entry, shiftedContext, buffer, escaped));
  });
};

html.group = (...content) => {
  return withBuffer((context, buffer, escaped) => {
    content.forEach((entity) =>
      render(entity, context, buffer, escaped));
  });
};

html.safe = (...content) => {
  return withBuffer((context, buffer) =>
    render(content, context, buffer, true));
};

html.if = (conditionGetter, ifTrue, ifFalse) => {
  const condition = typeof conditionGetter === 'object'
    ? when(conditionGetter)
    : ensureFn(conditionGetter);

  return withBuffer((context, buffer, escaped) => {
    const result = condition(context);

    render(result ? ifTrue : ifFalse, context, buffer, escaped);
  });
};

function classRender(fixed, value, context) {
  const classes = fixed ? [fixed] : [];

  switch (typeof value) {
    case 'function':
      classes.push(value(context));
      break;
    case 'string': // FIXME: strange....
      if (value !== '') classes.push(value);
      break;
    case 'object':
      forEachKey(value, (name, toggler) => {
        let toggle = false;

        if (typeof toggler === 'function') toggle = !!toggler(context);
        else toggle = !!toggler;

        if (toggle) classes.push(name);
      });
      break;
  }

  return classes.length ? classes.join(' ') : '';
}

module.exports = html;
