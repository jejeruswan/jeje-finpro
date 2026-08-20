import { Animator } from './screens/Animator/Animator'
import { Director } from './screens/Director/Director'
import { Mirage } from './screens/Mirage/Mirage'

// The hi-fi Mirage flow (prompt → corkboard → script → frames) is the default.
// Earlier prototypes stay reachable for side-by-side comparison:
//   ?screen=animator — the standalone timeline editor
//   ?screen=director — the LoFi three-altitude wireframe
export default function App() {
  const screen = new URLSearchParams(window.location.search).get('screen')
  if (screen === 'animator') return <Animator />
  if (screen === 'director') return <Director />
  return <Mirage />
}
