#!/usr/bin/env node
'use strict';
// UserPromptSubmit hook: detects ambiguous umbrella terms in the user's prompt
// that require a clarification BEFORE work starts — the one rule class that
// can't be gated by a test, because it is pure disambiguation. Injects a short
// context hint (additionalContext), blocks nothing.
//
// The mechanism comes from schreibwerkstatt, where "the editor" could mean three
// independent editors and "the chat" three independent chats. A fresh template
// has no such collision, so CATEGORIES starts EMPTY. The moment your app gets
// two things users call by the same word (two editors, two lists called "board",
// a public and an internal "profile"), add a category here AND a rule
// "<X>-Spezifikation Pflicht" in CLAUDE.md naming the variants.
//
// Per category it fires only if the GENERIC term appears AND NO specifying term
// is named — once the user (or a file path in the prompt) names the variant,
// the hint stays silent.
//
// Example entry:
//   {
//     key: 'editor',
//     generic: [/\beditor\b/i],            // \b: doesn't match inside "bookeditor"
//     specifiers: [/\bnote[-\s]?editor/i, /\bfocus\b/i],
//     hint: 'Editor ambiguous → the app has TWO editors: note editor (…) and focus '
//       + 'mode (…). Clarify which one first — don\'t guess (CLAUDE.md "Editor-Spezifikation").',
//   },

const CATEGORIES = [];

function hintsFor(prompt, categories = CATEGORIES) {
  const hints = [];
  for (const cat of categories) {
    if (!cat.generic.some((re) => re.test(prompt))) continue;
    if (cat.specifiers.some((re) => re.test(prompt))) continue;
    hints.push('• ' + cat.hint);
  }
  return hints;
}

module.exports = { CATEGORIES, hintsFor };

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    let prompt = '';
    try {
      prompt = String(JSON.parse(raw || '{}').prompt || '');
    } catch {
      process.exit(0);
    }
    const hints = prompt.trim() ? hintsFor(prompt) : [];
    if (hints.length) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: '[disambiguation] Clarify the variant before working:\n' + hints.join('\n'),
        },
      }));
    }
    process.exit(0);
  });
}
