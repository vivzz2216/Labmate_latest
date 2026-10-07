import type { ThemeOption } from '@/lib/api'

export const themeOptions: Array<{
  value: ThemeOption
  title: string
  description: string
}> = [
  {
    value: 'idle',
    title: 'Python (IDLE)',
    description: 'Orange + green terminal output that looks handwritten in IDLE.',
  },
  {
    value: 'notepad',
    title: 'Java (Notepad)',
    description: 'Blue keywords, green strings — straight out of college lab PCs.',
  },
  {
    value: 'codeblocks',
    title: 'C (CodeBlocks)',
    description: 'Macro greens, navy keywords, feels like CodeBlocks screenshots.',
  },
  {
    value: 'html',
    title: 'HTML / CSS / JS',
    description: 'Crisp VS Code light theme for front-end assignments.',
  },
  {
    value: 'react',
    title: 'React Projects',
    description: 'Dark VS Code layout with component tree vibes.',
  },
  {
    value: 'node',
    title: 'Node / Express',
    description: 'Console-first VS Code render for backend labs.',
  },
]

