import { useState } from 'react'
import { Sparkles, Image as ImageIcon, Palette, Rocket, Github } from 'lucide-react'
import heroImg from './assets/hero.png'
import './App.css'

// Fresh prototype starter. Everything here is frontend-only (no backend):
// use React state for interactions, lucide-react for icons, and put images
// in /public/assets (referenced as "/assets/name.png") or import from src/assets.
const FEATURES = [
  { icon: Sparkles, label: 'Icon library ready — lucide-react' },
  { icon: ImageIcon, label: 'Drop images in public/assets' },
  { icon: Palette, label: 'Style with plain CSS or your design tokens' },
  { icon: Rocket, label: 'Frontend-only — perfect for fast prototypes' },
]

export default function App() {
  const [clicks, setClicks] = useState(0)

  return (
    <main className="wrap">
      <img className="hero" src={heroImg} alt="" width={88} height={88} />
      <h1>jeje-finpro</h1>
      <p className="sub">Prototype starter · React + Vite + TypeScript</p>

      <ul className="features">
        {FEATURES.map(({ icon: Icon, label }) => (
          <li key={label}>
            <Icon size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <button className="cta" type="button" onClick={() => setClicks((c) => c + 1)}>
        <Sparkles size={18} strokeWidth={2} />
        Clicked {clicks} {clicks === 1 ? 'time' : 'times'}
      </button>

      <span className="repo">
        <Github size={15} />
        Ready to push to GitHub
      </span>
    </main>
  )
}
