import { createElement, useEffect, useMemo, useState } from 'react';

const PORTALS = [
  { match: /^\/(admin|admin\.html|dashboard)$/, file: 'admin.html' },
  { match: /^\/(citizen|citizen\.html)$/, file: 'citizen.html' },
  { match: /^\/worker(\.html)?$/, file: 'worker.html' },
  { match: /^\/(tracker|tracker\.html|track\/\d+)$/, file: 'tracker.html' },
];

function getPortalFile(pathname) {
  return PORTALS.find((portal) => portal.match.test(pathname))?.file || 'index.html';
}

function reactProps(element) {
  const props = {};
  for (const attribute of element.attributes) {
    const name = attribute.name.toLowerCase();
    if (name.startsWith('on')) {
      const eventName = name.slice(2);
      const handlerName = {
        click: 'onClick',
        change: 'onChange',
        input: 'onInput',
        submit: 'onSubmit',
        keydown: 'onKeyDown',
        keyup: 'onKeyUp',
        load: 'onLoad',
        error: 'onError',
      }[eventName];
      if (handlerName) props[handlerName] = makeLegacyHandler(attribute.value);
      continue;
    }

    const propName = {
      class: 'className',
      for: 'htmlFor',
      tabindex: 'tabIndex',
      readonly: 'readOnly',
      maxlength: 'maxLength',
      colspan: 'colSpan',
      rowspan: 'rowSpan',
      crossorigin: 'crossOrigin',
      autocomplete: 'autoComplete',
      autofocus: 'autoFocus',
      cellpadding: 'cellPadding',
      cellspacing: 'cellSpacing',
      contenteditable: 'contentEditable',
      novalidate: 'noValidate',
      datetime: 'dateTime',
      srcset: 'srcSet',
      usemap: 'useMap',
      frameborder: 'frameBorder',
      viewbox: 'viewBox',
      preserveaspectratio: 'preserveAspectRatio',
      'stroke-width': 'strokeWidth',
      'stroke-linecap': 'strokeLinecap',
      'stroke-linejoin': 'strokeLinejoin',
      'stroke-dasharray': 'strokeDasharray',
      'stroke-dashoffset': 'strokeDashoffset',
      'stroke-miterlimit': 'strokeMiterlimit',
      'stroke-opacity': 'strokeOpacity',
      'fill-rule': 'fillRule',
      'fill-opacity': 'fillOpacity',
      'clip-rule': 'clipRule',
      clippath: 'clipPath',
      'text-anchor': 'textAnchor',
      'dominant-baseline': 'dominantBaseline',
    }[name] || name;

    if (name === 'style') {
      props.style = parseStyle(attribute.value);
    } else if (name === 'checked' || name === 'selected' || name === 'multiple' || name === 'disabled' || name === 'required' || name === 'autofocus' || name === 'readonly' || name === 'hidden' || name === 'novalidate') {
      props[propName] = true;
    } else {
      props[propName] = attribute.value;
    }
  }
  return props;
}

function parseStyle(styleText) {
  const style = {};
  for (const declaration of styleText.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator < 0) continue;
    const property = declaration.slice(0, separator).trim();
    const value = declaration.slice(separator + 1).trim();
    if (!property || !value) continue;
    const reactProperty = property.startsWith('--')
      ? property
      : property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    style[reactProperty] = value;
  }
  return style;
}

function makeLegacyHandler(source) {
  const handler = source.trim();
  const clickById = handler.match(/^document\.getElementById\((['"])([^'"]+)\1\)\.click\(\)\s*;?$/);
  if (clickById) {
    return (event) => {
      if (event.target?.id !== clickById[2]) document.getElementById(clickById[2])?.click();
    };
  }
  const confirmation = handler.match(/^if\s*\(\s*confirm\(\s*(['"])(.*?)\1\s*\)\s*\)\s*([A-Za-z_$][\w$]*)\(\s*\)\s*;?$/);
  if (confirmation) {
    return () => {
      if (window.confirm(confirmation[2])) window[confirmation[3]]?.();
    };
  }

  const call = handler.match(/^([A-Za-z_$][\w$]*)\s*\((.*)\)\s*;?$/s);
  if (!call) return undefined;
  const functionName = call[1];
  const args = splitArguments(call[2]);
  return (event) => {
    const callback = window[functionName];
    if (typeof callback !== 'function') {
      console.error(`Portal action "${functionName}" is not available.`);
      return;
    }
    callback(...args.map((argument) => {
      if (argument === 'event' || argument === 'e') return event;
      if (/^(['"]).*\1$/s.test(argument)) return argument.slice(1, -1);
      if (argument === 'true') return true;
      if (argument === 'false') return false;
      if (argument === 'null') return null;
      if (/^-?\d+(\.\d+)?$/.test(argument)) return Number(argument);
      return undefined;
    }));
  };
}

function splitArguments(source) {
  const args = [];
  let current = '';
  let quote = '';
  let escaped = false;
  for (const character of source) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === '\\' && quote) {
      current += character;
      escaped = true;
    } else if (quote) {
      current += character;
      if (character === quote) quote = '';
    } else if (character === '"' || character === "'") {
      current += character;
      quote = character;
    } else if (character === ',') {
      args.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function nodeToReact(node, key) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const tagName = node.tagName.toLowerCase();
  if (tagName === 'script' || tagName === 'style') return null;
  const children = Array.from(node.childNodes).map((child, index) => nodeToReact(child, index));
  return createElement(tagName, { ...reactProps(node), key }, ...children);
}

function PortalPage({ file }) {
  const [template, setTemplate] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setTemplate(null);
    setError('');
    fetch(`/static/${file}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load the ${file} portal (${response.status}).`);
        return response.text();
      })
      .then(setTemplate)
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message);
      });
    return () => controller.abort();
  }, [file]);

  useEffect(() => {
    if (!template) return undefined;
    const page = new DOMParser().parseFromString(template, 'text/html');
    const oldTitle = document.title;
    const oldTheme = document.documentElement.getAttribute('data-theme');
    const oldBodyClass = document.body.className;
    const portalBodyClass = `portal-${file.replace(/\.html$/, '')}`;
    const oldViewport = document.querySelector('meta[name="viewport"]');
    const oldViewportContent = oldViewport?.getAttribute('content');

    document.title = page.title;
    document.body.classList.add(portalBodyClass);
    if (page.documentElement.hasAttribute('data-theme')) {
      document.documentElement.setAttribute('data-theme', page.documentElement.getAttribute('data-theme'));
    }
    if (page.body.className) document.body.className = page.body.className;
    const pageViewport = page.querySelector('meta[name="viewport"]')?.getAttribute('content');
    if (oldViewport && pageViewport) oldViewport.setAttribute('content', pageViewport);

    const additions = [];
    page.head.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"], link[rel="preload"], style').forEach((source) => {
      const element = source.cloneNode(true);
      if (element.tagName === 'LINK') {
        const href = element.getAttribute('href');
        if (href && !href.startsWith('http')) {
          element.href = new URL(href, `${window.location.origin}/static/${file}`).href;
        }
      }
      element.dataset.reactPortalStyle = file;
      document.head.appendChild(element);
      additions.push(element);
    });

    const scripts = Array.from(page.querySelectorAll('script'));
    const loadScripts = async () => {
      for (const source of scripts) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          for (const attribute of source.attributes) {
            if (attribute.name === 'src') {
              script.src = new URL(attribute.value, `${window.location.origin}/static/${file}`).href;
            } else {
              script.setAttribute(attribute.name, attribute.value);
            }
          }
          script.dataset.reactPortalScript = file;
          if (!source.src) script.textContent = source.textContent;
          if (source.src) {
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Unable to load portal script: ${source.src}`));
          }
          document.body.appendChild(script);
          additions.push(script);
          if (!source.src) resolve();
        });
      }
      document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    };
    loadScripts().catch((scriptError) => {
      console.error(`Failed to initialize ${file}.`, scriptError);
      setError(scriptError.message);
    });

    return () => {
      additions.forEach((element) => element.remove());
      document.title = oldTitle;
      document.body.className = oldBodyClass;
      document.body.classList.remove(portalBodyClass);
      if (oldTheme === null) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', oldTheme);
      if (oldViewport && oldViewportContent !== null) oldViewport.setAttribute('content', oldViewportContent);
    };
  }, [file, template]);

  const content = useMemo(() => {
    if (!template) return null;
    const page = new DOMParser().parseFromString(template, 'text/html');
    return Array.from(page.body.childNodes).map((node, index) => nodeToReact(node, index));
  }, [template]);

  if (error) return <main className="portal-load-error" role="alert">{error}</main>;
  if (!template) return <main className="portal-loading" aria-live="polite">Loading SwachhVision…</main>;
  return <div className="react-portal-content">{content}</div>;
}

export default function App() {
  const file = getPortalFile(window.location.pathname);
  return <PortalPage key={`${file}${window.location.search}`} file={file} />;
}
