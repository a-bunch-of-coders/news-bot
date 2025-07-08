// parser.ts

const HTML_REGEX = /<[^>]*>/g;
const CDATA_REGEX = /<!\[CDATA\[(.*?)\]\]>/g;
const SCRIPT_REGEX = /<script[^>]*>[\s\S]*?<\/script>/gi;
const STYLE_REGEX = /<style[^>]*>[\s\S]*?<\/style>/gi;
const WHITESPACE_REGEX = /\s+/g;
const WAGTAIL_REGEX = /<wagtail[^>]*>.*?<\/wagtail>|<wagtail\.rich_text\.RichText[^>]*>/gi;
const STRUCT_VALUE_REGEX = /<ListValue:\s*\[StructValue\([^)]*\)\]>|StructValue\([^)]*\)/g;
const ASIDE_BLOCK_REGEX = /aside_block\s+<[^>]*>/g;
const OBJECT_REFERENCE_REGEX = /<[^>]*object at 0x[a-fA-F0-9]+>/g;
const ENCODED_ENTITIES_REGEX = /&#\d+;/g;

// const { createTree } = require('xml-trap');
import Parser from 'rss-parser';


export function clean(input: string): string {
  if (!input) return '';
  let text = strip(input);
  text = decodeEntities(text);
  text = removeArtifacts(text);
  text = normalizeWhitespace(text);
  text = formatText(text);
  return text.trim();
}

function strip(input: string): string {
  let text = input.replace(CDATA_REGEX, '$1');
  text = text.replace(SCRIPT_REGEX, '');
  text = text.replace(STYLE_REGEX, '');
  text = text.replace(HTML_REGEX, '');
  return text;
}

function removeArtifacts(input: string): string {
  let text = input.replace(WAGTAIL_REGEX, '');
  text = text.replace(STRUCT_VALUE_REGEX, '');
  text = text.replace(ASIDE_BLOCK_REGEX, '');
  text = text.replace(OBJECT_REFERENCE_REGEX, '');
  text = text.replace(ENCODED_ENTITIES_REGEX, '');
  return text;
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#8220;/g, '\u201C')
    .replace(/&#8221;/g, '\u201D')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8211;/g, '\u2013')
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8230;/g, '\u2026')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&#160;/g, ' ')
    .replace(/&#8594;/g, '→')
    .replace(/&#8592;/g, '←')
    .replace(/&#8593;/g, '↑')
    .replace(/&#8595;/g, '↓');
}

function normalizeWhitespace(input: string): string {
  return input.trim().replace(WHITESPACE_REGEX, ' ');
}

function formatText(input: string): string {
  const patterns: [RegExp, string][] = [
    [/\[\u2026\]/g, ''],
    [/\[\.\.\.\]/g, ''],
    [/Read More\.\.\..*$/g, ''],
    [/Continue reading.*$/g, ''],
    [/Click here.*$/g, ''],
    [/More info.*$/g, ''],
    [/\s*\.\.\.\s*$/g, ''],
    [/^\s*-\s*/g, ''],
    [/^\s*\*\s*/g, ''],
    [/\{'[^']*'[^}]*\}/g, ''],
    [/\([^)]*'[^']*'[^)]*\)/g, ''],
    [/an\.\.\.$/g, ''],
    [/<[^>]*Value[^>]*>/g, ''],
    [/object at 0x[a-fA-F0-9]+/g, ''],
  ];

  return patterns.reduce((txt, [regex, repl]) => txt.replace(regex, repl), input);
}

export function title(entry: { title?: string }): string {
  return entry.title ? clean(entry.title) : 'Untitled';
}

export function description(entry: {
  summary?: string;
  content?: { body?: string };
}): string {
  let desc: string;
  if (entry.summary) {
    desc = clean(entry.summary);
  } else if (entry.content) {
    if (typeof entry.content === 'string') {
      desc = clean(entry.content);
    } else if (entry.content.body) {
      desc = clean(entry.content.body);
    } else {
      return 'No description available.';
    }
  } else {
    return 'No description available.';
  }

  if (desc.length > 1800) {
    const truncated = desc.slice(0, 1800);
    const lastSentence = truncated.lastIndexOf('.');
    if (lastSentence > 1400) {
      return truncated.slice(0, lastSentence + 1);
    }
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 1400) {
      return truncated.slice(0, lastSpace) + '…';
    }
    return truncated.slice(0, 1797) + '…';
  }

  return desc;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);
  const quarter = Math.floor(maxLength * 3 / 4);

  const lastSentence = truncated.lastIndexOf('.');
  if (lastSentence > quarter) {
    return truncated.slice(0, lastSentence + 1);
  }

  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > quarter) {
    return truncated.slice(0, lastSpace) + '…';
  }

  const puncts = ['.', '!', '?', ',', ';'];
  const lastPunct = Math.max(...puncts.map(p => truncated.lastIndexOf(p)));
  if (lastPunct > quarter) {
    return truncated.slice(0, lastPunct + 1) + '…';
  }

  return truncated.slice(0, maxLength - 1) + '…';
}



export function parseFeed(content: string) {
    // const text = content.trim().replaceAll(/(\s*)([\\]n)(\s*)/g, "").trim()

    const text = content.trim().replace(/\s+/g, ' ').replace(/\\n/g, '\n').replace(/\\t/g, '\t').trim();
    if (!text) {
        throw new Error("Content is empty or whitespace only");
    }
    // const tree = createTree(text);
    const parser = new Parser();
    const tree = parser.parseString(text);
    return tree;
}