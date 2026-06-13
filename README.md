<div align="center">

# ◈ State Space

### A sliding-block puzzle that sat on a hard drive for **twelve years** — reborn as a tiny, addictive game that secretly teaches you *how computers think.*

**[▶ Play it now](https://postlagerkarte.github.io/puzzle/)** — no install, runs in your browser.

</div>

---

## The 90-second story

In **2014** I wrote a sliding-block puzzle in WPF. Windows-only, wooden blocks, MVVM. It worked. Then it sat untouched in this exact repo for **twelve years.** (First commit: `Hello World`, September 2014 — it's still down there in the log.)

In **2026** I handed the whole thing to **Fable 5** and said: *make it cool.*

The clever bit isn't that the AI rewrote a decade-old C# solver into TypeScript + three.js, wired up a BFS that mints fresh, perfectly-ramped levels *while you play*, and synthesized every blip and whoosh from scratch — though it did all that in an afternoon. 

But the real value wasn't the code generation. Because I wasn't bogged down building boilerplate code, I could focus on game feel. I spent my time playtests and tuning the invisible variables that make a game click.

It is, at the end of the day, still just a weekend project with plenty of rough edges, but getting to focus entirely on the fun parts made all the difference.



---

## What the game has

| | | |
|---|---|---|
| ⚡ **Rush** | Play against a draining clock. Solving puzzles refunds time and builds combos. Levels are generated on the fly and dynamically ramp up in difficulty based on your current streak. |
| 🧘 **Zen** | A relaxed mode without a timer. Includes standard features like undo and hints. If you get completely stuck, it hooks into the built-in solver to highlight the optimal next move. |
| 👁 **Watch** | Oddly beautiful. | The game watches *itself* think — breadth-first search rippling out in colored waves across every possible board. |
| 🏁 **Race** | BFS vs DFS vs A*, side by side. | Watch A\* smugly find in ~3,000 steps what plain BFS slogs through ~26,000 to reach. |

You came for a puzzle. You'll leave knowing what A\* is.

---

## Run it locally

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

Curious how it's wired? The [technical README](web/README.md) maps every TypeScript module back to its 2014 C# ancestor, line for line.

---

<div align="center">

**drop a ⭐** — it's the only score that counts on this side of the screen.

<sub>Built on the bones of a 2014 WPF app · reborn with Fable 5 · still just a guy and some sliding blocks.</sub>

</div>
