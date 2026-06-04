// Terminal theme definitions: each theme bundles UI background + full xterm color scheme
export const THEMES = {
  // ── 深色主题 ──────────────────────────────────────────────────────────────
  cyber: {
    bg: '#070A08',
    term: { background:'#070A08', foreground:'#DDE7DF', cursor:'#7CFF6B', cursorAccent:'#071108', black:'#0A0F0C', red:'#FF6B6B', green:'#7CFF6B', yellow:'#F5D76E', blue:'#62A8FF', magenta:'#C084FC', cyan:'#43D9C8', white:'#DDE7DF', brightBlack:'#425046', brightRed:'#FF8A8A', brightGreen:'#A7FF96', brightYellow:'#FFE28A', brightBlue:'#8BC0FF', brightMagenta:'#D8B4FE', brightCyan:'#7DF4E5', brightWhite:'#F4FFF7' },
  },
  mocha: {
    bg: '#101116',
    term: { background:'#101116', foreground:'#E6E7EC', cursor:'#C4B5FD', cursorAccent:'#101116', black:'#151721', red:'#F87171', green:'#86EFAC', yellow:'#FACC15', blue:'#93C5FD', magenta:'#C4B5FD', cyan:'#67E8F9', white:'#E6E7EC', brightBlack:'#545866', brightRed:'#FCA5A5', brightGreen:'#BBF7D0', brightYellow:'#FDE68A', brightBlue:'#BFDBFE', brightMagenta:'#DDD6FE', brightCyan:'#A5F3FC', brightWhite:'#FFFFFF' },
  },
  gruvbox: {
    bg: '#130F0B',
    term: { background:'#130F0B', foreground:'#F4E7D2', cursor:'#FFB86B', cursorAccent:'#130F0B', black:'#1B1510', red:'#F97373', green:'#A3E635', yellow:'#FBBF24', blue:'#60A5FA', magenta:'#F0ABFC', cyan:'#5EEAD4', white:'#F4E7D2', brightBlack:'#6B5B4B', brightRed:'#FCA5A5', brightGreen:'#BEF264', brightYellow:'#FDE68A', brightBlue:'#93C5FD', brightMagenta:'#F5D0FE', brightCyan:'#99F6E4', brightWhite:'#FFF7ED' },
  },
  nord: {
    bg: '#0F1720',
    term: { background:'#0F1720', foreground:'#D9E5EF', cursor:'#7DD3FC', cursorAccent:'#0F1720', black:'#15202B', red:'#FB7185', green:'#A3E635', yellow:'#FCD34D', blue:'#7DD3FC', magenta:'#C4B5FD', cyan:'#67E8F9', white:'#D9E5EF', brightBlack:'#536270', brightRed:'#FDA4AF', brightGreen:'#BEF264', brightYellow:'#FDE68A', brightBlue:'#BAE6FD', brightMagenta:'#DDD6FE', brightCyan:'#A5F3FC', brightWhite:'#F8FAFC' },
  },
  dracula: {
    bg: '#130D16',
    term: { background:'#130D16', foreground:'#F8F1F6', cursor:'#FF6BAA', cursorAccent:'#130D16', black:'#1B1220', red:'#FF6B8A', green:'#6EE7B7', yellow:'#F9D86A', blue:'#8AB4FF', magenta:'#FF6BAA', cyan:'#67E8F9', white:'#F8F1F6', brightBlack:'#65536B', brightRed:'#FFA1B5', brightGreen:'#A7F3D0', brightYellow:'#FDE68A', brightBlue:'#BFDBFE', brightMagenta:'#FFB1D2', brightCyan:'#A5F3FC', brightWhite:'#FFFFFF' },
  },
  solarized: {
    bg: '#071818',
    term: { background:'#071818', foreground:'#D7E6E2', cursor:'#2DD4BF', cursorAccent:'#071818', black:'#0C2323', red:'#F87171', green:'#34D399', yellow:'#FBBF24', blue:'#38BDF8', magenta:'#A78BFA', cyan:'#2DD4BF', white:'#D7E6E2', brightBlack:'#4D6663', brightRed:'#FCA5A5', brightGreen:'#86EFAC', brightYellow:'#FDE68A', brightBlue:'#7DD3FC', brightMagenta:'#C4B5FD', brightCyan:'#99F6E4', brightWhite:'#F0FDFA' },
  },
  carbon: {
    bg: '#080A0D',
    term: { background:'#080A0D', foreground:'#DDE3EA', cursor:'#DDE3EA', cursorAccent:'#080A0D', black:'#0E1116', red:'#FF5C6C', green:'#A3E635', yellow:'#EAB308', blue:'#60A5FA', magenta:'#C084FC', cyan:'#22D3EE', white:'#DDE3EA', brightBlack:'#5B6470', brightRed:'#FB7185', brightGreen:'#BEF264', brightYellow:'#FDE047', brightBlue:'#93C5FD', brightMagenta:'#DDD6FE', brightCyan:'#67E8F9', brightWhite:'#FFFFFF' },
  },
  ember: {
    bg: '#140A06',
    term: { background:'#140A06', foreground:'#F8E8D8', cursor:'#FF7A3D', cursorAccent:'#140A06', black:'#1D0F09', red:'#F43F5E', green:'#84CC16', yellow:'#FFD166', blue:'#38BDF8', magenta:'#FB7185', cyan:'#2DD4BF', white:'#F8E8D8', brightBlack:'#75584B', brightRed:'#FDA4AF', brightGreen:'#BEF264', brightYellow:'#FDE68A', brightBlue:'#7DD3FC', brightMagenta:'#FDA4AF', brightCyan:'#99F6E4', brightWhite:'#FFF7ED' },
  },
  aurora: {
    bg: '#07111C',
    term: { background:'#07111C', foreground:'#E6F6FF', cursor:'#22D3EE', cursorAccent:'#07111C', black:'#0B1724', red:'#FB7185', green:'#6EE7B7', yellow:'#FDE047', blue:'#38BDF8', magenta:'#A78BFA', cyan:'#22D3EE', white:'#E6F6FF', brightBlack:'#536579', brightRed:'#FDA4AF', brightGreen:'#A7F3D0', brightYellow:'#FEF08A', brightBlue:'#7DD3FC', brightMagenta:'#C4B5FD', brightCyan:'#67E8F9', brightWhite:'#FFFFFF' },
  },
  orchid: {
    bg: '#120A1A',
    term: { background:'#120A1A', foreground:'#F7EDFF', cursor:'#D946EF', cursorAccent:'#120A1A', black:'#1A0F25', red:'#F43F5E', green:'#34D399', yellow:'#FACC15', blue:'#60A5FA', magenta:'#D946EF', cyan:'#22D3EE', white:'#F7EDFF', brightBlack:'#665070', brightRed:'#FB7185', brightGreen:'#86EFAC', brightYellow:'#FDE68A', brightBlue:'#93C5FD', brightMagenta:'#F0ABFC', brightCyan:'#67E8F9', brightWhite:'#FFFFFF' },
  },
  matrix: {
    bg: '#030805',
    term: { background:'#030805', foreground:'#E5FFF1', cursor:'#00FF87', cursorAccent:'#030805', black:'#07120A', red:'#FF5F72', green:'#00FF87', yellow:'#D9F99D', blue:'#38BDF8', magenta:'#A78BFA', cyan:'#00B8A9', white:'#E5FFF1', brightBlack:'#3F6A52', brightRed:'#FB7185', brightGreen:'#7CFFB2', brightYellow:'#ECFCCB', brightBlue:'#7DD3FC', brightMagenta:'#C4B5FD', brightCyan:'#5EEAD4', brightWhite:'#FFFFFF' },
  },
  neon: {
    bg: '#050712',
    term: { background:'#050712', foreground:'#EEF8FF', cursor:'#00E5FF', cursorAccent:'#050712', black:'#080B1C', red:'#FF4D8D', green:'#7CFF6B', yellow:'#FDE047', blue:'#38BDF8', magenta:'#FF2BD6', cyan:'#00E5FF', white:'#EEF8FF', brightBlack:'#566382', brightRed:'#FB7185', brightGreen:'#A7FF96', brightYellow:'#FEF08A', brightBlue:'#7DD3FC', brightMagenta:'#F0ABFC', brightCyan:'#67E8F9', brightWhite:'#FFFFFF' },
  },

  // ── 浅色主题 ──────────────────────────────────────────────────────────────
  // Canvas: warm light workstation
  latte: {
    bg: '#F6F4EF',
    term: { background:'#F6F4EF', foreground:'#262A32', cursor:'#6D5EF6', cursorAccent:'#F6F4EF', black:'#31343C', red:'#C2415D', green:'#1B7F59', yellow:'#9A6412', blue:'#2563EB', magenta:'#6D5EF6', cyan:'#0E7490', white:'#D5D2C8', brightBlack:'#757B86', brightRed:'#E11D48', brightGreen:'#15803D', brightYellow:'#B7791F', brightBlue:'#1D4ED8', brightMagenta:'#7C3AED', brightCyan:'#0891B2', brightWhite:'#FFFFFF' },
  },
  // Paper: 纸白极简，黑白为主
  paper: {
    bg: '#FBFBF8',
    term: { background:'#FBFBF8', foreground:'#1F2933', cursor:'#0E7490', cursorAccent:'#FBFBF8', black:'#252A31', red:'#B91C1C', green:'#166534', yellow:'#A16207', blue:'#1D4ED8', magenta:'#6B21A8', cyan:'#0E7490', white:'#E5E1D8', brightBlack:'#6B7280', brightRed:'#DC2626', brightGreen:'#15803D', brightYellow:'#CA8A04', brightBlue:'#2563EB', brightMagenta:'#7E22CE', brightCyan:'#0891B2', brightWhite:'#FFFFFF' },
  },
  // Day: 亮白高对比，GitHub/VSCode Light 风格
  day: {
    bg: '#FFFFFF',
    term: { background:'#FFFFFF', foreground:'#1B2430', cursor:'#2563EB', cursorAccent:'#FFFFFF', black:'#242A33', red:'#CF222E', green:'#116329', yellow:'#6F4E00', blue:'#2563EB', magenta:'#7C3AED', cyan:'#0E7490', white:'#E5E7EB', brightBlack:'#57606A', brightRed:'#A40E26', brightGreen:'#1A7F37', brightYellow:'#8A5A00', brightBlue:'#1D4ED8', brightMagenta:'#6D28D9', brightCyan:'#0891B2', brightWhite:'#F9FAFB' },
  },
  mist: {
    bg: '#F3F8FA',
    term: { background:'#F3F8FA', foreground:'#1F2A32', cursor:'#0891B2', cursorAccent:'#F3F8FA', black:'#24313A', red:'#BE123C', green:'#166534', yellow:'#A16207', blue:'#0E7490', magenta:'#7C3AED', cyan:'#0891B2', white:'#DCE8EC', brightBlack:'#64748B', brightRed:'#E11D48', brightGreen:'#15803D', brightYellow:'#CA8A04', brightBlue:'#0284C7', brightMagenta:'#9333EA', brightCyan:'#0E7490', brightWhite:'#FFFFFF' },
  },
  sage: {
    bg: '#F3F7F0',
    term: { background:'#F3F7F0', foreground:'#23302A', cursor:'#2F855A', cursorAccent:'#F3F7F0', black:'#27332C', red:'#B91C1C', green:'#2F855A', yellow:'#8A5A00', blue:'#2563EB', magenta:'#7C3AED', cyan:'#0F766E', white:'#DCE8D6', brightBlack:'#647568', brightRed:'#DC2626', brightGreen:'#15803D', brightYellow:'#B7791F', brightBlue:'#1D4ED8', brightMagenta:'#6D28D9', brightCyan:'#0E7490', brightWhite:'#FFFFFF' },
  },
  pearl: {
    bg: '#FCF7FB',
    term: { background:'#FCF7FB', foreground:'#2B2430', cursor:'#C026D3', cursorAccent:'#FCF7FB', black:'#312A35', red:'#BE123C', green:'#15803D', yellow:'#A16207', blue:'#2563EB', magenta:'#C026D3', cyan:'#0891B2', white:'#E9DCE8', brightBlack:'#716678', brightRed:'#E11D48', brightGreen:'#16A34A', brightYellow:'#CA8A04', brightBlue:'#1D4ED8', brightMagenta:'#D946EF', brightCyan:'#0E7490', brightWhite:'#FFFFFF' },
  },
  contrast: {
    bg: '#FAFAFA',
    term: { background:'#FAFAFA', foreground:'#111827', cursor:'#111827', cursorAccent:'#FAFAFA', black:'#111827', red:'#B91C1C', green:'#166534', yellow:'#854D0E', blue:'#1D4ED8', magenta:'#6B21A8', cyan:'#0E7490', white:'#E5E7EB', brightBlack:'#374151', brightRed:'#DC2626', brightGreen:'#15803D', brightYellow:'#A16207', brightBlue:'#2563EB', brightMagenta:'#7E22CE', brightCyan:'#0891B2', brightWhite:'#FFFFFF' },
  },
  ivory: {
    bg: '#FFFDF7',
    term: { background:'#FFFDF7', foreground:'#2A241C', cursor:'#9A3412', cursorAccent:'#FFFDF7', black:'#2A241C', red:'#B91C1C', green:'#166534', yellow:'#A16207', blue:'#2563EB', magenta:'#7C3AED', cyan:'#0F766E', white:'#F0E3CB', brightBlack:'#786C5E', brightRed:'#DC2626', brightGreen:'#15803D', brightYellow:'#CA8A04', brightBlue:'#1D4ED8', brightMagenta:'#6D28D9', brightCyan:'#0E7490', brightWhite:'#FFFFFF' },
  },
  skyline: {
    bg: '#F7FBFF',
    term: { background:'#F7FBFF', foreground:'#17212B', cursor:'#0369A1', cursorAccent:'#F7FBFF', black:'#17212B', red:'#B91C1C', green:'#166534', yellow:'#8A5A00', blue:'#0369A1', magenta:'#7C3AED', cyan:'#0E7490', white:'#DFEEF8', brightBlack:'#617586', brightRed:'#DC2626', brightGreen:'#15803D', brightYellow:'#A16207', brightBlue:'#0284C7', brightMagenta:'#6D28D9', brightCyan:'#0891B2', brightWhite:'#FFFFFF' },
  },
};
