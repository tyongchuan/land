import { config as configEnv } from "https://deno.land/x/dotenv/mod.ts";
import {
  bold,
  italic,
  underline,
  cyan,
  yellow,
  magenta,
  blue,
  green,
} from "https://deno.land/std/fmt/colors.ts";
import { BufReader } from "https://deno.land/std/io/bufio.ts";
import { parse as parseArgs } from "https://deno.land/std/flags/mod.ts";

interface ChineseWord {
  word_name: string;
  symbols: Array<{
    word_symbol: string; // pinyin
    symbol_mp3: string;
    parts: Array<{
      part_name: string;
      means: Array<{ word_mean: string; has_mean: string; split: number }>;
    }>;
  }>;
}

interface EnglishWord {
  word_name: string;
  is_CRI: number;
  exchange?: {
    word_pl: string;
    word_past: string[];
    word_done: string[];
    word_ing: string[];
    word_third: string[];
    word_er: string[];
    word_est: string[];
  };
  symbols: Array<{
    ph_en: string;
    ph_am: string;
    ph_other: string;
    ph_en_mp3: string;
    ph_am_mp3: string;
    ph_tts_mp3: string;
    parts: Array<{
      part: string;
      means: string[];
    }>;
  }>;
  items: string[];
}

configEnv({
  path: [Deno.env.get("HOME"), ".mydict/.env"].join("/"),
  export: true,
});
const apiUrl = "http://dict-co.iciba.com/api/dictionary.php";
const appVersion = "0.1.0";

const banner = `
                 ___     __    ___ 
  __ _  __ _____/ (_)___/ /_  |_  |
 /  '  / // / _  / / __/ __/ / __/ 
/_/_/_/ _, / _,_/_/ __/ __/ /____/ 
      /___/                        
`;

if (import.meta.main) {
  main();
}

function main() {
  const args = parseArgs(Deno.args);
  if (args.d || args.debug) {
    Deno.env.set("DEBUG", "1");
  }
  if (args.h || args.help) {
    help();
    Deno.exit();
  }
  if (args.v || args.version) {
    console.log(appVersion);
    Deno.exit();
  }
  if (args.i || args.interactive) {
    inquireWord();
  }
  if (args._.length) {
    inquireWord(args._[0] as string);
  }
  if (!args.i && !args.interactive && !args._.length) {
    help();
    Deno.exit(1);
  }
}

function help() {
  console.log(yellow(bold(banner)));
  console.log(
`NANE:
  mydict2 - translate between english chinese

USAGE:
  mydict2 [options] <word>

OPTIONS:
  -d, --debug       Display debug info
  -i, --interactive Enter interactive mode
  -h, --help        Display this help info
  -v, --version     Display version`,
  );
}

async function search(word: string) {
  const res = await fetch(`${apiUrl}?key=${Deno.env.get("API_KEY")}&type=json&w=${encodeURIComponent(word)}`);
  const data = await res.json();
  if (Deno.env.get("DEBUG") === "1") {
    console.log(Deno.inspect(data, { depth: Infinity }));
  }
  return data;
}

function display(data: any) {
  if (!data || !data.word_name) return;
  const alphabetOnly = /[ A-Za-z]+/.test(data.word_name);
  console.log(bold(underline(magenta(`# ${data.word_name}`))));
  if (!data.symbols) return;
  if (alphabetOnly) {
    const { exchange, symbols } = data as EnglishWord;
    if (exchange) {
      const { word_third, word_past, word_done, word_ing } = exchange;
      if (word_third || word_past || word_done || word_ing) {
        console.log(italic(blue(` 时态 -> ${word_third}; ${word_past}; ${word_done}; ${word_ing}`)));
      }
    }
    for (const symbol of symbols) {
      console.log(` 英[${yellow(symbol["ph_en"])}] 美[${yellow(symbol["ph_am"])}]`);
      for (const part of symbol.parts) {
        console.log(` ${green("◆")} ${cyan(part.part + part.means)}`);
      }
    }
  } else {
    (data as ChineseWord).symbols.forEach((explain) => {
      console.log(italic(blue(` 拼音: ${explain.word_symbol}`)));
      for (const part of explain.parts) {
        const means = part.means.map((item) => item.word_mean);
        console.log((green(` 翻译: ${means}`)));
      }
    });
  }
}

async function inquireWord(w?: string) {
  if (w) {
    const translations = await search(w);
    display(translations);
    return;
  }

  console.log(yellow(bold(banner)));
  const prompt = new TextEncoder().encode("> ");
  const reader = BufReader.create(Deno.stdin);

  while (true) {
    Deno.stdout.write(prompt);
    let input = await reader.readString("\n");
    if (input === null) return;
    const word = input.slice(0, input.length - 1);
    const translations = await search(word);
    display(translations);
  }
}
