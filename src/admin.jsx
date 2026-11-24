import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { collection, query, orderBy, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { db, auth, money, imgsOf, itemsOf } from './firebase'
import { downloadPDF } from './receipt'
import './style.css'

const STATUS = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled']
const useList = (name) => {
  const [l, setL] = useState([])
  useEffect(() => onSnapshot(query(collection(db, name), orderBy('createdAt', 'desc')),
    s => setL(s.docs.map(d => ({ id: d.id, ...d.data() }))), console.error), [])
  return l
}

function Login() {
  const [e, setE] = useState(''), [p, setP] = useState('')
  const go = () => signInWithEmailAndPassword(auth, e.trim(), p).catch(() => alert('Incorrect email or password'))
  return (
    <div className="box" style={{ margin: '40px auto' }}>
      <h3>Admin Login</h3>
      <label>Email</label><input type="email" value={e} onChange={x => setE(x.target.value)} />
      <label>Password</label><input type="password" value={p} onChange={x => setP(x.target.value)} onKeyDown={x => x.key === 'Enter' && go()} />
      <button className="btn full" style={{ marginTop: 16 }} onClick={go}>Login</button>
    </div>
  )
}

function Orders() {
  const orders = useList('orders')
  const date = o => o.createdAt ? o.createdAt.toDate().toLocaleString() : ''
  const wa = o => {
    let n = o.phone1.replace(/\D/g, ''); if (n.startsWith('0')) n = '94' + n.slice(1)
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(`Hello ${o.name}, your ELORA order ${o.orderNo} is now ${o.status}. Thank you! 💖`)}`, '_blank')
  }
  if (!orders.length) return <div className="empty">No orders yet.</div>
  return orders.map(o => (
    <div className="ord" key={o.id}>
      <div className="i">
        <b>{o.orderNo}</b> <span className="badge">{o.status}</span><br />
        <b>Name:</b> {o.name}<br /><b>Address:</b> {o.address}<br />
        <b>Phone:</b> {o.phone1} / {o.phone2}<br /><b>Town:</b> {o.town}<br />
        <div className="items">{itemsOf(o).map((it, i) => (
          <div className="it" key={i}><img src={it.image} alt="" />
            <div><b>{it.name}</b><br />{it.size && `Size: ${it.size} • `}Qty: {it.qty} • {money(it.price)}</div></div>))}</div>
        {o.note && <><b>Note:</b> {o.note}<br /></>}
        {o.delivery != null && <><b>Delivery:</b> {money(o.delivery)}<br /></>}
        <b>Total:</b> {money(o.total)}<br /><small style={{ color: 'var(--mute)' }}>{date(o)}</small>
        <div className="acts">
          <select value={o.status} onChange={e => updateDoc(doc(db, 'orders', o.id), { status: e.target.value })}>
            {STATUS.map(s => <option key={s}>{s}</option>)}</select>
          <button className="btn g s" onClick={() => wa(o)}>WhatsApp</button>
          <button className="btn o s" onClick={() => downloadPDF({ ...o, date: date(o) })}>PDF</button>
          <button className="btn r s" onClick={() => confirm('Delete this order?') && deleteDoc(doc(db, 'orders', o.id))}>Delete</button>
        </div>
      </div></div>))
}

function Settings() {
  const [d, setD] = useState(''), [saved, setSaved] = useState(false)
  useEffect(() => onSnapshot(doc(db, 'settings', 'shop'), s => { const v = s.data()?.delivery; setD(v != null ? String(v) : '450') }, () => setD('450')), [])
  async function save() {
    const n = Number(d)
    if (d === '' || !(n >= 0)) return alert('Enter a valid delivery charge')
    try { await setDoc(doc(db, 'settings', 'shop'), { delivery: n }, { merge: true }); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    catch (e) { console.error(e); alert('Could not save. Please check your Firestore rules for "settings".') }
  }
  return (
    <div className="box" style={{ margin: 0 }}>
      <h3>Delivery Charge</h3>
      <label>Delivery charge per order (Rs.)</label>
      <input type="number" min="0" value={d} onChange={e => setD(e.target.value)} />
      <button className="btn full" style={{ marginTop: 16 }} onClick={save}>Save</button>
      {saved && <p style={{ marginTop: 10, color: '#2e7d32' }}>✓ Saved. The shop now uses this charge.</p>}
    </div>
  )
}

function ProductForm({ p, onClose }) {
  const [f, setF] = useState(p || { name: '', price: '', desc: '', image: '' })
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const [sz, setSz] = useState((p?.sizes || []).join(', '))
  const [imgs, setImgs] = useState(p ? imgsOf(p) : [])
  function pick(e) { // up to 4 photos, compressed and stored as base64
    const files = [...e.target.files].slice(0, 4 - imgs.length)
    files.forEach(file => {
      const r = new FileReader()
      r.onload = ev => {
        const im = new Image()
        im.onload = () => {
          const k = Math.min(1, 650 / Math.max(im.width, im.height)), c = document.createElement('canvas')
          c.width = im.width * k; c.height = im.height * k
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height)
          setImgs(x => x.length < 4 ? [...x, c.toDataURL('image/jpeg', 0.72)] : x)
        }
        im.src = ev.target.result
      }
      r.readAsDataURL(file)
    })
    e.target.value = ''
  }
  async function save() {
    if (!f.name.trim() || !Number(f.price) || !imgs.length) return alert('Name, price and at least one photo are required')
    const data = { name: f.name.trim(), price: Number(f.price), desc: f.desc || '', image: imgs[0], images: imgs, sizes: sz.split(',').map(x => x.trim()).filter(Boolean) }
    if (p?.id) await updateDoc(doc(db, 'products', p.id), data)
    else await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() })
    onClose()
  }
  return (
    <div className="modal"><div className="box">
      <h3>{p?.id ? 'Edit' : 'Add'} Product</h3>
      <label>Product Name *</label><input value={f.name} onChange={set('name')} />
      <label>Price (Rs.) *</label><input type="number" value={f.price} onChange={set('price')} />
      <label>Description</label><textarea rows="2" value={f.desc} onChange={set('desc')} />
      <label>Sizes (separate with commas)</label><input value={sz} onChange={e => setSz(e.target.value)} placeholder="S, M, L, XL" />
      <div className="chips">{['S, M, L, XL', 'S, M, L, XL, XXL', '28, 30, 32, 34', 'Free Size'].map(x => <button key={x} type="button" className="chip" onClick={() => setSz(x)}>{x}</button>)}</div>
      <label>Photos * (up to 4 — front, back, side… used for the 3D view)</label>
      <input type="file" accept="image/*" multiple onChange={pick} disabled={imgs.length >= 4} />
      <div className="chips" style={{ marginTop: 8 }}>{imgs.map((x, i) => (
        <div key={i} style={{ position: 'relative' }}><img src={x} style={{ width: 70, height: 92, objectFit: 'cover', borderRadius: 8 }} />
          <button type="button" className="x2" style={{ position: 'absolute', top: -6, right: -6, background: '#c0213a', borderRadius: '50%', width: 22, height: 22, fontSize: 11 }} onClick={() => setImgs(imgs.filter((_, j) => j !== i))}>✕</button></div>))}</div>
      <div className="row" style={{ marginTop: 18 }}><button className="btn o" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></div>
    </div></div>
  )
}

function Products() {
  const list = useList('products'), [edit, setEdit] = useState(null)
  return (
    <>
      <button className="btn" onClick={() => setEdit({})}>+ Add New Product</button>
      <div className="grid" style={{ marginTop: 18 }}>{list.map(p => (
        <div className="card" key={p.id}><img src={p.image} alt="" />
          <div className="b"><h3>{p.name}</h3><div className="p">{money(p.price)}</div>
            <div className="sz">{p.sizes?.length ? 'Sizes: ' + p.sizes.join(', ') : 'No sizes'}</div>
            <div className="acts"><button className="btn s" onClick={() => setEdit(p)}>Edit</button>
              <button className="btn r s" onClick={() => confirm('Delete this product?') && deleteDoc(doc(db, 'products', p.id))}>Delete</button></div></div></div>))}</div>
      {edit && <ProductForm p={edit.id ? edit : null} onClose={() => setEdit(null)} />}
    </>
  )
}

function App() {
  const [user, setUser] = useState(undefined), [tab, setTab] = useState('O')
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  if (user === undefined) return <div className="empty">Loading…</div>
  return (
    <>
      <header><a href="/" className="logo"><img src="/logo.jpeg" alt="" onError={e => e.target.style.display = 'none'} />E<span>L</span>ORA <small style={{ fontSize: 12, color: 'var(--mute)' }}>ADMIN</small></a>
        {user && <button className="btn o s" onClick={() => signOut(auth)}>Logout</button>}</header>
      <div className="wrap">
        {!user ? <Login /> : <>
          <div className="tabs">
            <button className={tab === 'O' ? 'on' : ''} onClick={() => setTab('O')}>📦 Orders</button>
            <button className={tab === 'P' ? 'on' : ''} onClick={() => setTab('P')}>👗 Products</button>
            <button className={tab === 'S' ? 'on' : ''} onClick={() => setTab('S')}>⚙️ Settings</button>
          </div>
          {tab === 'O' ? <Orders /> : tab === 'P' ? <Products /> : <Settings />}
        </>}
      </div>
    </>
  )
}
createRoot(document.getElementById('root')).render(<App />)
