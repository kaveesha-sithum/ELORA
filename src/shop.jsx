import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, money, imgsOf, thumbOf, useFullImgs, makeThumb, calcOffers, offerText } from './firebase'
import { downloadPDF, ownerWA } from './receipt'
import './style.css'

const readCache = k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
const writeCache = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

/* ---------- 3D viewer (drag / swipe to rotate) ---------- */
function Viewer3D({ imgs }) {
  const n = imgs.length, step = n >= 2 ? 360 / n : 0, k = n >= 3 ? 0.5 / Math.tan(Math.PI / n) : 0
  const [ang, setAng] = useState(0), [drag, setDrag] = useState(false)
  const auto = useRef(true), last = useRef(0)
  useEffect(() => {
    if (n < 2) return
    const t = setInterval(() => auto.current && setAng(a => a + 0.4), 30)
    return () => clearInterval(t)
  }, [n])
  const clamp = a => (n < 2 ? Math.max(-35, Math.min(35, a)) : a)
  const turn = d => { auto.current = false; setAng(a => (n < 2 ? clamp(a + d * 30) : Math.round(a / step) * step + d * step)) }
  return (
    <div className="v3dwrap">
      <div className="v3d"
        onPointerDown={e => { auto.current = false; setDrag(true); last.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId) }}
        onPointerMove={e => { if (!drag) return; const dx = e.clientX - last.current; last.current = e.clientX; setAng(a => clamp(a + dx * (n < 2 ? 0.4 : 0.6))) }}
        onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}>
        <div className={'stage' + (drag ? '' : ' t')} style={{ transform: `translateZ(calc(var(--w) * ${-k})) rotateY(${ang}deg)` }}>
          {imgs.map((s, i) => <div className="face" key={i} style={{ '--a': `${i * step}deg`, '--k': k }}><img src={s} draggable={false} alt="" /></div>)}
        </div>
      </div>
      <div className="v3dctl"><button onClick={() => turn(-1)}>◀</button><span>👆 Drag to rotate 3D</span><button onClick={() => turn(1)}>▶</button></div>
    </div>
  )
}

/* ---------- product detail ---------- */
function ProductModal({ p, onClose, onAdd, onBuy }) {
  const [size, setSize] = useState(''), [qty, setQty] = useState(1)
  const item = () => {
    if (p.sizes?.length && !size) { alert('Please select a size'); return null }
    return { id: p.id, size, qty }
  }
  const add = () => { const it = item(); if (it) { onAdd(it); onClose() } }
  const buy = () => { const it = item(); if (it) onBuy(it) }
  return (
    <div className="modal" onClick={onClose}><div className="box sheet" onClick={e => e.stopPropagation()}>
      <button className="x" onClick={onClose}>✕</button>
      <Viewer3D imgs={useFullImgs(p)} />
      <h3 style={{ marginTop: 6 }}>{p.name}</h3>
      <div style={{ color: 'var(--pink2)', fontWeight: 600, fontSize: 18 }}>{money(p.price)}</div>
      {p.desc && <p style={{ fontSize: 13, color: 'var(--mute)', margin: '6px 0' }}>{p.desc}</p>}
      {p.sizes?.length > 0 && <><label>Size *</label>
        <div className="chips">{p.sizes.map(s => <button key={s} className={'chip' + (size === s ? ' on' : '')} onClick={() => setSize(s)}>{s}</button>)}</div></>}
      <label>Quantity</label>
      <div className="qty"><button onClick={() => setQty(Math.max(1, qty - 1))}>−</button><b>{qty}</b><button onClick={() => setQty(qty + 1)}>+</button></div>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn o" onClick={add}>🛒 Add to Cart</button>
        <button className="btn glow" onClick={buy}>⚡ Buy Now</button>
      </div>
    </div></div>
  )
}

/* ---------- cart drawer ---------- */
function Drawer({ lines, total, off, ready, onClose, onQty, onRemove, onCheckout }) {
  return (
    <div className="dbg" onClick={onClose}><div className="drawer" onClick={e => e.stopPropagation()}>
      <div className="dh"><h3>My Cart 🛒</h3><button className="x2" onClick={onClose}>✕</button></div>
      <div className="dbody">
        {lines.length === 0 ? <div className="empty">Your cart is empty 💖</div> : lines.map(l => (
          <div className="cl" key={l.id + l.size}>
            <img src={thumbOf(l.p)} alt="" />
            <div style={{ flex: 1 }}>
              <b style={{ fontSize: 14 }}>{l.p.name}</b>
              <div className="sz">{l.size ? 'Size: ' + l.size : ''}</div>
              <div style={{ color: 'var(--pink2)', fontSize: 14 }}>{money(l.p.price * l.qty)}</div>
              <div className="qty sm"><button onClick={() => onQty(l, -1)}>−</button><b>{l.qty}</b><button onClick={() => onQty(l, 1)}>+</button></div>
            </div>
            <button className="x2" onClick={() => onRemove(l)}>🗑</button>
          </div>))}
      </div>
      {lines.length > 0 && <div className="df">
        {off.hints.map((h, i) => <div className="hint" key={i}>🎁 {h}</div>)}
        {off.applied.map((a, i) => <div className="applied" key={i}>✓ {a}</div>)}
        <div className="tot sm"><span>Subtotal</span><span>{money(total)}</span></div>
        {off.discount > 0 && <div className="tot sm"><span>Discount</span><span>- {money(off.discount)}</span></div>}
        <div className="tot sm"><span>Delivery</span><span>{!ready ? '…' : off.delivery === 0 ? 'FREE' : money(off.delivery)}</span></div>
        <div className="tot"><span>Total</span><b>{ready ? money(total - off.discount + off.delivery) : '…'}</b></div>
        <button className="btn full" disabled={!ready} onClick={onCheckout}>Checkout</button></div>}
    </div></div>
  )
}

/* ---------- checkout ---------- */
const blank = { name: '', address: '', phone1: '', phone2: '', town: '', note: '' }
function Checkout({ lines, total, off, ready, onClose, onDone }) {
  const [f, setF] = useState(blank), [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const orderNo = useRef('ELR-' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10))
  const set = k => e => setF({ ...f, [k]: e.target.value })
  async function submit() {
    if (sending.current || !ready) return
    if (!f.name.trim() || !f.address.trim() || !f.phone1.trim() || !f.phone2.trim() || !f.town.trim()) return alert('Please fill in all required fields')
    sending.current = true; setBusy(true)
    try {
      const items = await Promise.all(lines.map(async l => ({ id: l.id, name: l.p.name, price: Number(l.p.price), size: l.size || '', qty: l.qty, image: l.p.thumb || await makeThumb(imgsOf(l.p)[0]) })))
      const order = { orderNo: orderNo.current, name: f.name.trim(), address: f.address.trim(), phone1: f.phone1.trim(), phone2: f.phone2.trim(), town: f.town.trim(), note: f.note.trim(), items, subtotal: total, discount: off.discount, offers: off.applied, delivery: off.delivery, total: total - off.discount + off.delivery, status: 'Pending' }
      await setDoc(doc(db, 'orders', order.orderNo), { ...order, createdAt: serverTimestamp() })
      onDone({ ...order, date: new Date().toLocaleString() })
    } catch (e) { console.error(e); alert('Could not place your order. Please try again.'); sending.current = false; setBusy(false) }
  }
  return (
    <div className="modal"><div className="box sheet">
      <h3>Checkout</h3>
      <div className="sum">{lines.map(l => <div key={l.id + l.size}><span>{l.p.name}{l.size && ` (${l.size})`} × {l.qty}</span><span>{money(l.p.price * l.qty)}</span></div>)}
        <div><span>Subtotal</span><span>{money(total)}</span></div>
        {off.discount > 0 && <div><span>Discount</span><span>- {money(off.discount)}</span></div>}
        <div><span>Delivery</span><span>{!ready ? '…' : off.delivery === 0 ? 'FREE 🎉' : money(off.delivery)}</span></div>
        <div className="tot"><span>Total</span><b>{ready ? money(total - off.discount + off.delivery) : '…'}</b></div></div>
      <label>Full Name *</label><input value={f.name} onChange={set('name')} />
      <label>Address *</label><textarea rows="2" value={f.address} onChange={set('address')} />
      <div className="row">
        <div><label>Phone Number 1 *</label><input type="tel" value={f.phone1} onChange={set('phone1')} /></div>
        <div><label>Phone Number 2 *</label><input type="tel" value={f.phone2} onChange={set('phone2')} /></div>
      </div>
      <label>Nearest Town *</label><input value={f.town} onChange={set('town')} />
      <label>Notes (optional)</label><input value={f.note} onChange={set('note')} />
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn o" onClick={onClose}>Back</button>
        <button className="btn" disabled={busy || !ready} onClick={submit}>{busy ? 'Please wait…' : 'Confirm Order'}</button>
      </div>
    </div></div>
  )
}

function Done({ order, onClose }) {
  useEffect(() => { downloadPDF(order); setTimeout(() => window.open(ownerWA(order), '_blank'), 600) }, [])
  return (
    <div className="modal"><div className="box" style={{ textAlign: 'center' }}>
      <h3>🎉 Order Placed!</h3>
      <p style={{ color: 'var(--mute)', fontSize: 14, marginBottom: 16 }}>Order No: {order.orderNo}. Your receipt has been downloaded. Please send it to us on WhatsApp.</p>
      <button className="btn full" onClick={() => downloadPDF(order)}>⬇ Download Receipt (PDF)</button>
      <button className="btn g full" style={{ marginTop: 10 }} onClick={() => window.open(ownerWA(order), '_blank')}>Send on WhatsApp</button>
      <button className="btn o full" style={{ marginTop: 10 }} onClick={onClose}>Close</button>
    </div></div>
  )
}

/* ---------- glowing butterfly + magic background ---------- */
const WING = (
  <>
    <path className="w" d="M-4,-6 C-18,-62 -82,-72 -96,-46 C-106,-26 -72,-2 -8,4 Z" />
    <path className="w" d="M-6,6 C-52,6 -88,30 -72,56 C-60,72 -24,56 -4,14 Z" />
    <path className="vn" d="M-6,-2 C-30,-30 -60,-45 -88,-44 M-6,0 C-35,-14 -65,-20 -98,-34 M-6,2 C-35,10 -70,12 -90,5 M-6,8 C-30,22 -50,38 -68,52 M-6,10 C-25,25 -30,38 -30,50" />
  </>
)
// 3D wing flap: each wing hinges at the body and rotates on the Y axis
const Butterfly = () => (
  <div className="bfo"><div className="bfly">
    <svg className="wg l" viewBox="0 0 100 140" aria-hidden="true"><g transform="translate(100 70)">{WING}</g></svg>
    <svg className="wg r" viewBox="0 0 100 140" aria-hidden="true"><g transform="translate(0 70) scale(-1 1)">{WING}</g></svg>
    <svg className="bd" viewBox="0 0 40 140" aria-hidden="true">
      <ellipse className="body" cx="20" cy="70" rx="3.2" ry="26" />
      <path className="vn" d="M19,46 C12,30 4,24 -6,22 M21,46 C28,30 36,24 46,22" />
    </svg>
  </div></div>
)
const RIB = ['M-40,780 C120,640 -60,470 130,340 S330,180 440,40', 'M440,760 C250,640 420,480 230,360 S30,230 -40,80', 'M-40,520 C80,430 40,300 170,220 S330,150 440,200', 'M440,420 C330,350 360,250 250,190 S90,120 -40,160', 'M-40,300 C60,250 110,330 200,260 S340,60 440,120']
const SP = Array.from({ length: 28 }, () => ({ x: Math.random() * 100, y: Math.random() * 100, s: 1 + Math.random() * 2.5, d: Math.random() * 5, t: 2 + Math.random() * 4 }))
const Bg = () => (
  <div className="bg" aria-hidden="true">
    <svg className="rib" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff8fa6" stopOpacity="0" /><stop offset=".5" stopColor="#ffb3d6" /><stop offset="1" stopColor="#ff8fa6" stopOpacity="0" /></linearGradient></defs>
      {RIB.map((d, i) => <g key={i}><path d={d} className="r0" /><path d={d} className="r1" style={{ animationDelay: -i * 2 + 's', animationDuration: 8 + i * 2 + 's' }} /></g>)}
    </svg>
    {SP.map((a, i) => <span key={i} className="sp" style={{ left: a.x + '%', top: a.y + '%', width: a.s, height: a.s, '--d': a.d + 's', '--t': a.t + 's' }} />)}
  </div>
)
const BF = Array.from({ length: 5 }, (_, i) => ({ l: (i * 19 + 8) % 90, d: i * 3.2, t: 17 + (i % 3) * 4, s: 14 + (i % 3) * 6, x: (i % 2 ? 1 : -1) * (50 + i * 9) }))
const Butterflies = () => (
  <div className="bfs" aria-hidden="true">{BF.map((b, i) => (
    <span key={i} className="bf" style={{ left: b.l + '%', '--d': b.d + 's', '--t': b.t + 's', '--s': b.s + 'px', '--x': b.x + 'px' }}><Butterfly /></span>))}</div>
)

/* ---------- category / gender filter chips ---------- */
const ICONS = [[/shoe|sandal|heel|slipper|boot|sneaker/i, '👟'], [/perfume|scent|fragrance|cologne|attar/i, '🧴'], [/belt/i, '🪢'], [/dress|frock|gown/i, '👗'], [/top|shirt|blouse|tee/i, '👚'], [/bag|purse|handbag/i, '👜'], [/watch/i, '⌚'], [/jewel|ring|necklace|earring|bracelet/i, '💍'], [/sunglass|glass/i, '🕶️'], [/cap|hat/i, '🧢'], [/saree|sari/i, '🥻'], [/pant|trouser|jean|short/i, '👖'], [/access/i, '✨']]
const iconOf = n => (ICONS.find(([r]) => r.test(n)) || [0, '🛍️'])[1]
const Chips = ({ items, value, onPick, cls = '' }) => (
  <div className={'fbar ' + cls}>{items.map((c, i) => (
    <button key={c.key} className={'fchip' + (value === c.key ? ' on' : '')} style={{ '--i': i }} onClick={() => onPick(c.key)}>
      <span className="ic">{c.icon}</span><span>{c.label}</span>
    </button>))}</div>
)

/* ---------- offers banner ---------- */
function OfferBar({ offers }) {
  const act = offers.filter(o => o.active !== false)
  if (!act.length) return null
  const row = Array(4).fill(act.map(o => o.title || offerText(o))).flat()
  const half = <span className="mqh">{row.map((t, i) => <span key={i}>🎁 {t}</span>)}</span>
  return <div className="offers"><div className="mq">{half}{half}</div></div>
}

/* ---------- app ---------- */
function App() {
  const [products, setProducts] = useState(null), [minT, setMinT] = useState(false)
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem('elora_cart')) || [] } catch { return [] } })
  const [view, setView] = useState(null), [drawer, setDrawer] = useState(false), [checkout, setCheckout] = useState(false)
  const [done, setDone] = useState(null), [toast, setToast] = useState('')
  const [buy, setBuy] = useState(null), [q, setQ] = useState(''), [delivery, setDelivery] = useState(() => readCache('elora_delivery')), [offers, setOffers] = useState(() => readCache('elora_offers'))
  const [cats, setCats] = useState([]), [gender, setGender] = useState('All'), [cat, setCat] = useState('All')

  useEffect(() => { const t = setTimeout(() => setMinT(true), 1500); return () => clearTimeout(t) }, [])
  useEffect(() => onSnapshot(doc(db, 'settings', 'shop'), s => { const v = Number(s.data()?.delivery); const d = s.exists() && Number.isFinite(v) ? v : 450; setDelivery(d); writeCache('elora_delivery', d) }, () => setDelivery(d => d ?? 450)), [])
  useEffect(() => onSnapshot(collection(db, 'offers'), s => { const l = s.docs.map(d => { const { createdAt, ...r } = d.data(); return { id: d.id, ...r } }); setOffers(l); writeCache('elora_offers', l) }, () => setOffers(o => o ?? [])), [])
  useEffect(() => onSnapshot(collection(db, 'categories'), s => setCats(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))), () => {}), [])
  useEffect(() => { try { localStorage.setItem('elora_cart', JSON.stringify(cart)) } catch {} }, [cart])
  useEffect(() => onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc')),
    s => setProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))), e => { console.error(e); setProducts([]) }), [])

  const ready = delivery !== null && offers !== null
  const offs = offers || [], dlv = delivery ?? 450
  const lines = cart.map(c => ({ ...c, p: (products || []).find(x => x.id === c.id) })).filter(l => l.p)
  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0), count = lines.reduce((s, l) => s + l.qty, 0)
  const chk = buy ? [{ ...buy, p: (products || []).find(x => x.id === buy.id) }].filter(l => l.p) : lines
  const chkTotal = chk.reduce((s, l) => s + l.p.price * l.qty, 0)
  const dOff = calcOffers(offs, count, total, dlv)
  const cOff = calcOffers(offs, chk.reduce((s, l) => s + l.qty, 0), chkTotal, dlv)
  const shown = (products || []).filter(p =>
    (p.name + ' ' + (p.desc || '')).toLowerCase().includes(q.trim().toLowerCase()) &&
    (cat === 'All' || p.category === cat) &&
    (gender === 'All' || (p.gender || 'Unisex') === gender || (p.gender || 'Unisex') === 'Unisex'))
  const same = (a, b) => a.id === b.id && a.size === b.size

  function add(it) {
    setCart(c => c.some(x => same(x, it)) ? c.map(x => same(x, it) ? { ...x, qty: x.qty + it.qty } : x) : [...c, it])
    setToast('Added to cart ✓'); setTimeout(() => setToast(''), 1800)
  }

  return (
    <>
      <div className={'splash' + (products !== null && ready && minT ? ' hide' : '')}>
        <img src="/logo.jpeg" alt="ELORA" /><div className="bar"><i /></div><small>Loading your style…</small>
      </div>
      <header>
        <a href="/" className="logo"><img src="/logo.jpeg" alt="" onError={e => e.target.style.display = 'none'} />E<span>L</span>ORA</a>
        <button className="cartbtn" onClick={() => setDrawer(true)}>🛒{count > 0 && <i>{count}</i>}</button>
      </header>
      <OfferBar offers={offs} />
      <Bg /><Butterflies />
      <div className="hero"><div className="herob"><Butterfly /></div><h1>Be Your Own <em>Queen</em></h1><p>ELORA – Elegant fashion for every moment ✨</p></div>
      <div className="wrap">
        <h2 className="t">Our Collection</h2>
        <div className="search"><span>🔍</span><input placeholder="Search dresses, tops, sarees…" value={q} onChange={e => setQ(e.target.value)} />{q && <button onClick={() => setQ('')}>✕</button>}</div>
        <Chips cls="g" value={gender} onPick={setGender} items={[{ key: 'All', label: 'All', icon: '✨' }, { key: 'Men', label: 'Men', icon: '👔' }, { key: 'Women', label: 'Women', icon: '👗' }]} />
        {cats.length > 0 && <Chips value={cat} onPick={setCat} items={[{ key: 'All', label: 'All Categories', icon: '🛍️' }, ...cats.map(c => ({ key: c.name, label: c.name, icon: iconOf(c.name) }))]} />}
        {products === null ? <div className="empty">Loading…</div> :
          products.length === 0 ? <div className="empty">No products yet.</div> :
          shown.length === 0 ? <div className="empty">No products found 🦋</div> :
          <div className="grid">{shown.map((p, i) => (
            <div className="card rise" key={p.id} style={{ animationDelay: Math.min(i, 10) * 70 + 'ms' }}>
              <div className="imgw" onClick={() => setView(p)}><img src={thumbOf(p)} alt="" loading="lazy" /><span className="tag3d">3D</span></div>
              <div className="b"><h3>{p.name}</h3>{p.category && <div className="sz">{p.category}{p.gender && p.gender !== 'Unisex' ? ' • ' + p.gender : ''}</div>}<div className="p">{money(p.price)}</div>
                {p.sizes?.length > 0 && <div className="sz">Sizes: {p.sizes.join(' • ')}</div>}
                <button className="btn full" onClick={() => setView(p)}>View 3D & Add</button></div></div>))}</div>}
      </div>
      <footer>© ELORA • WhatsApp: 0774071805</footer>
      {view && <ProductModal p={view} onClose={() => setView(null)} onAdd={add} onBuy={it => { setView(null); setBuy(it); setCheckout(true) }} />}
      {drawer && <Drawer lines={lines} total={total} off={dOff} ready={ready} onClose={() => setDrawer(false)}
        onQty={(l, d) => setCart(c => c.map(x => same(x, l) ? { ...x, qty: Math.max(1, x.qty + d) } : x))}
        onRemove={l => setCart(c => c.filter(x => !same(x, l)))} onCheckout={() => { setDrawer(false); setCheckout(true) }} />}
      {checkout && <Checkout lines={chk} total={chkTotal} off={cOff} ready={ready} onClose={() => { setCheckout(false); setBuy(null) }} onDone={o => { setCheckout(false); if (!buy) setCart([]); setBuy(null); setDone(o) }} />}
      {done && <Done order={done} onClose={() => setDone(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
createRoot(document.getElementById('root')).render(<App />)
