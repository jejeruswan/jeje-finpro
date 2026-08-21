import { Animator } from './screens/Animator/Animator'
import { Mirage } from './screens/Mirage/Mirage'

// The hi-fi Mirage flow (prompt → corkboard → script → frames) is the default.
// The standalone timeline editor stays reachable for side-by-side comparison
// at ?screen=animator.
export default function App() {
  const screen = new URLSearchParams(window.location.search).get('screen')
  if (screen === 'animator') return <Animator />
  return <Mirage />
}
