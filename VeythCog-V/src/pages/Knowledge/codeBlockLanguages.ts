/**
 * 知识库代码块的可用语言清单（BlockNote `codeBlock.supportedLanguages` 的数据源）。
 *
 * <p>key 用 Markdown 围栏的标准写法（```js 会被 aliases 归一成 `javascript`），
 * 选中的语言会写入块的 `language` prop，导出 Markdown 时原样落到 ```lang 上。</p>
 */
export const CODE_BLOCK_LANGUAGES: Record<string, { name: string; aliases?: string[] }> = {
  text: { name: 'PlainText', aliases: ['plaintext', 'txt', 'none'] },

  // Web
  javascript: { name: 'JavaScript', aliases: ['js', 'mjs', 'cjs'] },
  typescript: { name: 'TypeScript', aliases: ['ts'] },
  jsx: { name: 'JSX' },
  tsx: { name: 'TSX' },
  html: { name: 'HTML' },
  css: { name: 'CSS' },
  scss: { name: 'SCSS' },
  less: { name: 'Less' },
  vue: { name: 'Vue' },
  svelte: { name: 'Svelte' },

  // 数据 / 配置
  json: { name: 'JSON' },
  jsonc: { name: 'JSONC' },
  yaml: { name: 'YAML', aliases: ['yml'] },
  toml: { name: 'TOML' },
  ini: { name: 'INI' },
  xml: { name: 'XML', aliases: ['svg'] },
  markdown: { name: 'Markdown', aliases: ['md'] },

  // 后端 / 系统语言
  java: { name: 'Java' },
  kotlin: { name: 'Kotlin', aliases: ['kt'] },
  scala: { name: 'Scala' },
  groovy: { name: 'Groovy' },
  python: { name: 'Python', aliases: ['py'] },
  go: { name: 'Go', aliases: ['golang'] },
  rust: { name: 'Rust', aliases: ['rs'] },
  c: { name: 'C' },
  cpp: { name: 'C++', aliases: ['c++', 'cc', 'cxx'] },
  csharp: { name: 'C#', aliases: ['cs', 'c#'] },
  php: { name: 'PHP' },
  ruby: { name: 'Ruby', aliases: ['rb'] },
  swift: { name: 'Swift' },
  dart: { name: 'Dart' },
  objc: { name: 'Objective-C', aliases: ['objective-c', 'objectivec'] },
  lua: { name: 'Lua' },
  perl: { name: 'Perl' },
  r: { name: 'R' },
  matlab: { name: 'MATLAB' },
  asm: { name: 'Assembly', aliases: ['assembly'] },

  // Shell / 运维
  bash: { name: 'Bash', aliases: ['sh', 'shell', 'zsh'] },
  powershell: { name: 'PowerShell', aliases: ['ps1', 'pwsh'] },
  bat: { name: 'Batch', aliases: ['batch', 'cmd'] },
  sql: { name: 'SQL' },
  http: { name: 'HTTP' },
  graphql: { name: 'GraphQL', aliases: ['gql'] },
  dockerfile: { name: 'Dockerfile', aliases: ['docker'] },
  nginx: { name: 'Nginx' },
  makefile: { name: 'Makefile', aliases: ['make'] },

  // 其它
  diff: { name: 'Diff', aliases: ['patch'] },
  properties: { name: 'Properties' },
};
